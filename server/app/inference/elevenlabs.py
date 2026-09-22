"""ElevenLabs audio adapter; one bounded request, no retries or route selection.

[@elevenlabs_stt_20260917] [@elevenlabs_tts_20260917]
The owner supplies an authenticated provider profile and an HTTP client. Request
and result types are shared with future audio adapters. No model-name routing.
"""
from __future__ import annotations
from server.app.diagnostics.exceptions import DiagnosticValueError

import asyncio
import io
import json
import math
import re
import wave

import httpx

from server.app.diagnostics import provider_errors

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


def synthesis_text(request: SynthesisRequest) -> str:
    """Provider-only cue; source records remain unchanged.

    [@elevenlabs_accent_tags_20260920] Tags guide rather than guarantee accent.
    Unsupported models fail explicitly instead of silently dropping variety.
    """
    variety = request.language_variety
    if variety is None:
        return request.text
    if (request.model != "eleven_v3" or not isinstance(variety, str)
            or not variety.strip() or len(variety.encode("utf-8")) > 256
            or any(ord(c) < 32 or 127 <= ord(c) <= 159 or c in "[]" for c in variety)):
        raise DiagnosticValueError("Speech requires a valid language variety and an accent-capable model.")
    return f"[{variety} accent]\n{request.text}"


class ElevenLabs:
    def __init__(self, client: httpx.AsyncClient, *, api_key: str):
        if not api_key or not api_key.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in api_key):
            raise DiagnosticValueError("Invalid ElevenLabs credential format.")
        self._client = client
        self._key = api_key

    async def _post(self, path: str, receipt: AudioReceipt, *, limit: int,
                    content_types: set[str], private: tuple[str, ...] = (), **kwargs: object) -> tuple[bytes, AudioReceipt]:
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
                    receipt = AudioReceipt(receipt.provider, receipt.requested_model, request_id,
                                           diagnostics={"status": response.status_code, "response_headers": provider_errors.response_headers(response)})
                    if not response.is_success:
                        cleaned = await provider_errors.capture(
                            response, "ELEVENLABS", {"key": self._key, "request": kwargs, "private": private},
                        )
                        detail = cleaned.get("detail") if isinstance(cleaned, dict) else None
                        provider_error = None
                        if isinstance(detail, dict):
                            code, message = detail.get("status"), detail.get("message")
                            if isinstance(code, str) and re.fullmatch(r"[a-z][a-z0-9_]{0,63}", code):
                                provider_error = {"code": code}
                                if isinstance(message, str) and message.strip():
                                    provider_error["message"] = message[:1024]
                        raise AudioFailure("AUDIO_PROVIDER_HTTP", receipt=receipt,
                                           unknown_outcome=response.status_code >= 500,
                                           status=response.status_code, provider_error=provider_error, diagnostics=cleaned)
                    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                    if content_type not in content_types:
                        raise AudioFailure("AUDIO_RESPONSE_TYPE", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"response_headers", "path":"content_type", "expected":sorted(content_types), "response":receipt.diagnostics})
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(chunks) + len(chunk) > limit:
                            raise AudioFailure("AUDIO_RESPONSE_LIMIT", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"response_body", "limit_bytes":limit, "received_bytes":len(chunks)+len(chunk), "truncated":True, "response":receipt.diagnostics})
                        chunks.extend(chunk)
                    return bytes(chunks), receipt
                finally:
                    await response.aclose()
        except (httpx.HTTPError, TimeoutError) as error:
            from server.app.diagnostics.exceptions import describe
            details = describe(error, private=tuple(provider_errors.request_strings({"key": self._key, "request": kwargs, "private": private})), include_message=True)
            raise AudioFailure("AUDIO_TRANSPORT_UNKNOWN", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"transport", "exception_type":type(error).__name__, "causes":details["causes"], "response":receipt.diagnostics}) from None

    async def synthesize(self, request: SynthesisRequest) -> SynthesisResult:
        receipt = AudioReceipt("elevenlabs", request.model)
        if (not _identifier(request.model) or not _identifier(request.voice_id)
                or not request.text.strip() or len(request.text.encode("utf-8")) > 16_384
                or "\0" in request.text or not _language(request.language_code, synthesis=True)):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        try:
            text = synthesis_text(request)
        except (ValueError, UnicodeError):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False) from None
        if len(text.encode("utf-8")) > 16_384 or (request.model == "eleven_v3" and len(text) > 5_000):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        payload = {"model_id": request.model, "text": text,
                   "apply_text_normalization": "off"}
        if request.language_code is not None:
            payload["language_code"] = request.language_code
        pcm, receipt = await self._post(
            f"text-to-speech/{request.voice_id}", receipt, limit=MAX_PCM_BYTES,
            content_types={"audio/pcm", "audio/x-pcm", "application/octet-stream"},
            params={"output_format": "pcm_24000"}, json=payload, private=(request.text,),
        )
        if not pcm or len(pcm) % 2:
            raise AudioFailure("AUDIO_RESPONSE_INVALID", receipt=receipt, unknown_outcome=True)
        return SynthesisResult(_wav(pcm, OUTPUT_RATE), len(pcm) / (OUTPUT_RATE * 2), receipt)

    async def transcribe(self, request: TranscriptionRequest, *, model: str = "scribe_v2") -> TranscriptionResult:
        receipt = AudioReceipt("elevenlabs", model)
        duration = len(request.pcm) / (INPUT_RATE * 2)
        language = transcription_language(request.language_tag)
        if (not _identifier(model) or len(request.pcm) % 2 or not 0.1 <= duration <= MAX_SECONDS
                or language is None):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        # Preserve learner wording; no corrective prompt or keyterms are supplied.
        # [@elevenlabs_non_verbatim]
        fields = {"model_id": model, "timestamps_granularity": "word",
                  "tag_audio_events": "false", "diarize": "false", "no_verbatim": "false"}
        fields["language_code"] = language
        body, receipt = await self._post(
            "speech-to-text", receipt, limit=MAX_TRANSCRIPT_BYTES,
            content_types={"application/json"}, data=fields,
            files={"file": ("audio.wav", _wav(request.pcm, INPUT_RATE), "audio/wav")},
        )
        return _transcript(body, duration, receipt)


def transcription_language(tag):
    if not isinstance(tag, str) or len(tag) > 80 or not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*", tag):
        return None
    return tag.split("-")[0]


def _transcript(body: bytes, duration: float, receipt: AudioReceipt) -> TranscriptionResult:
    path = "$"
    value = None
    try:
        value = json.loads(body)
        if not isinstance(value, dict):
            raise ValueError()
        path = "text"
        text = value["text"]
        if not isinstance(text, str) or len(text) > 20_000 or "\0" in text:
            raise ValueError()
        path = "language_code/language_probability"
        language = value.get("language_code")
        probability = value.get("language_probability")
        if not _language(language, synthesis=False):
            raise ValueError()
        if probability is not None and (not _number(probability) or not 0 <= probability <= 1):
            raise ValueError()
        path = "words"
        raw_words = value.get("words")
        if raw_words is not None and (not isinstance(raw_words, list) or len(raw_words) > 20_000):
            raise ValueError()
        words = []
        previous = 0.0
        for index, word in enumerate(raw_words or []):
            path = f"words[{index}]"
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
        receipt = AudioReceipt(receipt.provider, receipt.requested_model, receipt.request_id, receipt.cost_micros,
                               {"http":receipt.diagnostics, "response":provider_errors.sanitize(value), "no_verbatim": False})
        return TranscriptionResult(text, duration, tuple(words) if raw_words is not None else None, receipt)
    except (ValueError, TypeError, KeyError, UnicodeError, OverflowError):
        raise AudioFailure("AUDIO_RESPONSE_INVALID", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"transcription_validation", "path":path, "expected":"valid transcript fields and ordered timing within recording duration", "response":provider_errors.sanitize(value), "http":receipt.diagnostics}) from None
