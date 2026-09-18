"""ElevenLabs audio adapter; one bounded request, no retries or route selection.

[@elevenlabs_stt_20260917] [@elevenlabs_tts_20260917]
The owner supplies an authenticated provider profile and an HTTP client. Request
and result types are shared with future audio adapters. No model-name routing.
"""
from __future__ import annotations

import asyncio
import io
import json
import math
import re
import wave

import httpx

from server.app.inference.audio_contracts import (
    AudioFailure, AudioReceipt, SynthesisRequest, SynthesisResult,
    TranscriptionRequest, TranscriptionResult, WordTiming,
)

INPUT_RATE = 16_000
OUTPUT_RATE = 24_000
MAX_SECONDS = 120
MAX_PCM_BYTES = min(OUTPUT_RATE * 2 * MAX_SECONDS, 4 * 1024 * 1024 - 44)
MAX_TRANSCRIPT_BYTES = 1_048_576


def _identifier(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_-]{1,256}", value))


def _language(value: str | None, *, synthesis: bool) -> bool:
    return value is None or bool(re.fullmatch(r"[a-z]{2}" if synthesis else r"[a-z]{2,3}", value))


def _number(value: object) -> bool:
    return type(value) in (int, float) and math.isfinite(value)


def _wav(pcm: bytes, sample_rate: int) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(sample_rate)
        writer.writeframes(pcm)
    return output.getvalue()


class ElevenLabs:
    def __init__(self, client: httpx.AsyncClient, *, api_key: str):
        if not api_key or not api_key.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in api_key):
            raise ValueError("Invalid ElevenLabs credential format.")
        self._client = client
        self._key = api_key

    async def _post(self, path: str, receipt: AudioReceipt, *, limit: int,
                    content_types: set[str], **kwargs: object) -> tuple[bytes, AudioReceipt]:
        # Fixed origin prevents callers sending this key to a custom endpoint.
        # The whole read has a deadline, including a slowly trickling response.
        try:
            async with asyncio.timeout(60):
                request = self._client.build_request(
                    "POST", f"https://api.elevenlabs.io/v1/{path}", timeout=60, **kwargs,
                )
                # A shared client must not leak another provider's default auth,
                # cookies or key headers. Retain only HTTP framing/body headers.
                for name in list(request.headers):
                    if name not in {"host", "content-type", "content-length", "transfer-encoding"}:
                        del request.headers[name]
                request.headers["xi-api-key"] = self._key
                response = await self._client.send(
                    request, stream=True, auth=None, follow_redirects=False,
                )
                try:
                    request_id = response.headers.get("request-id")
                    if request_id is not None and not _identifier(request_id):
                        request_id = None
                    receipt = AudioReceipt(receipt.provider, receipt.requested_model, request_id)
                    if not response.is_success:
                        raise AudioFailure("AUDIO_PROVIDER_HTTP", receipt=receipt,
                                           unknown_outcome=response.status_code >= 500,
                                           status=response.status_code)
                    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                    if content_type not in content_types:
                        raise AudioFailure("AUDIO_RESPONSE_TYPE", receipt=receipt, unknown_outcome=True)
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(chunks) + len(chunk) > limit:
                            raise AudioFailure("AUDIO_RESPONSE_LIMIT", receipt=receipt, unknown_outcome=True)
                        chunks.extend(chunk)
                    return bytes(chunks), receipt
                finally:
                    await response.aclose()
        except (httpx.HTTPError, TimeoutError):
            # Drop exception context: HTTP errors can contain URLs or credentials.
            raise AudioFailure("AUDIO_TRANSPORT_UNKNOWN", receipt=receipt, unknown_outcome=True) from None

    async def synthesize(self, request: SynthesisRequest) -> SynthesisResult:
        receipt = AudioReceipt("elevenlabs", request.model)
        if (not _identifier(request.model) or not _identifier(request.voice_id)
                or not request.text.strip() or len(request.text.encode("utf-8")) > 16_384
                or "\0" in request.text or not _language(request.language_code, synthesis=True)):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        payload = {"model_id": request.model, "text": request.text,
                   "apply_text_normalization": "off"}
        if request.language_code is not None:
            payload["language_code"] = request.language_code
        pcm, receipt = await self._post(
            f"text-to-speech/{request.voice_id}", receipt, limit=MAX_PCM_BYTES,
            content_types={"audio/pcm", "audio/x-pcm", "application/octet-stream"},
            params={"output_format": "pcm_24000"}, json=payload,
        )
        if not pcm or len(pcm) % 2:
            raise AudioFailure("AUDIO_RESPONSE_INVALID", receipt=receipt, unknown_outcome=True)
        return SynthesisResult(_wav(pcm, OUTPUT_RATE), len(pcm) / (OUTPUT_RATE * 2), receipt)

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult:
        receipt = AudioReceipt("elevenlabs", request.model)
        duration = len(request.pcm) / (INPUT_RATE * 2)
        if (not _identifier(request.model) or len(request.pcm) % 2 or not 0.1 <= duration <= MAX_SECONDS
                or not _language(request.language_code, synthesis=False)):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        # No prompt, translation, keyterms or clean-up: learner errors are evidence.
        fields = {"model_id": request.model, "timestamps_granularity": "word",
                  "tag_audio_events": "false", "diarize": "false", "no_verbatim": "false"}
        if request.language_code is not None:
            fields["language_code"] = request.language_code
        body, receipt = await self._post(
            "speech-to-text", receipt, limit=MAX_TRANSCRIPT_BYTES,
            content_types={"application/json"}, data=fields,
            files={"file": ("audio.wav", _wav(request.pcm, INPUT_RATE), "audio/wav")},
        )
        return _transcript(body, duration, receipt)


def _transcript(body: bytes, duration: float, receipt: AudioReceipt) -> TranscriptionResult:
    try:
        value = json.loads(body)
        if not isinstance(value, dict):
            raise ValueError()
        text = value["text"]
        if not isinstance(text, str) or len(text) > 20_000 or "\0" in text:
            raise ValueError()
        language = value.get("language_code")
        probability = value.get("language_probability")
        if not _language(language, synthesis=False):
            raise ValueError()
        if probability is not None and (not _number(probability) or not 0 <= probability <= 1):
            raise ValueError()
        raw_words = value["words"]
        if not isinstance(raw_words, list) or len(raw_words) > 20_000:
            raise ValueError()
        words = []
        previous = 0.0
        for word in raw_words:
            if not isinstance(word, dict) or word.get("type") not in {"word", "spacing", "audio_event"}:
                raise ValueError()
            if word["type"] != "word":
                continue
            start, end, token = word["start"], word["end"], word["text"]
            if (not _number(start) or not _number(end) or not previous <= start <= end <= duration
                    or not isinstance(token, str) or not token.strip() or "\0" in token):
                raise ValueError()
            words.append(WordTiming(token, start, end))
            previous = start
        if not text.strip():
            raise AudioFailure("AUDIO_NO_SPEECH", receipt=receipt, unknown_outcome=False)
        # Preserve script and learner wording; do not rewrite low-confidence text.
        return TranscriptionResult(text, duration, tuple(words), language, probability, receipt)
    except (ValueError, TypeError, KeyError, UnicodeError, OverflowError):
        raise AudioFailure("AUDIO_RESPONSE_INVALID", receipt=receipt, unknown_outcome=True) from None
