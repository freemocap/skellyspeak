"""Fixed-destination audio transport. Response interpretation belongs to native."""
import asyncio
import json
import re
import httpx
from server.app.diagnostics import provider_errors
from server.app.diagnostics.exceptions import DiagnosticValueError
from server.app.inference.audio_contracts import AudioFailure, AudioReceipt, AudioResult, SynthesisRequest, TranscriptionRequest
from server.app.inference.relay_payload import for_client

def _identifier(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,256}", value) is not None


class ElevenLabs:
    def __init__(self, client: httpx.AsyncClient, *, api_key: str):
        if not api_key or not api_key.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in api_key):
            raise DiagnosticValueError("Invalid ElevenLabs credential format.")
        self._client = client
        self._key = api_key

    async def _post(self, path: str, receipt: AudioReceipt, *, limit: int,
                    content_types: set[str], private: tuple[str, ...] = (), on_chunk=None, **kwargs: object) -> tuple[bytes, AudioReceipt]:
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
                    if content_types != {"application/json"} and content_type not in content_types:
                        raise AudioFailure("AUDIO_RESPONSE_TYPE", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"response_headers", "path":"content_type", "expected":sorted(content_types), "response":receipt.diagnostics})
                    chunks = bytearray()
                    received = 0
                    async for chunk in response.aiter_bytes():
                        received += len(chunk)
                        if received > limit:
                            raise AudioFailure("AUDIO_RESPONSE_LIMIT", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"response_body", "limit_bytes":limit, "received_bytes":received, "truncated":True, "response":receipt.diagnostics})
                        if on_chunk is None:
                            chunks.extend(chunk)
                        else:
                            await on_chunk(chunk, receipt)
                    return bytes(chunks), receipt
                finally:
                    await response.aclose()
        except (httpx.HTTPError, TimeoutError) as error:
            from server.app.diagnostics.exceptions import describe
            details = describe(error, private=tuple(provider_errors.request_strings({"key": self._key, "request": kwargs, "private": private})), include_message=True)
            raise AudioFailure("AUDIO_TRANSPORT_UNKNOWN", receipt=receipt, unknown_outcome=True, diagnostics={"stage":"transport", "exception_type":type(error).__name__, "causes":details["causes"], "response":receipt.diagnostics}) from None

    async def synthesize(self, request: SynthesisRequest, *, on_audio=None) -> AudioResult:
        receipt = AudioReceipt("elevenlabs", request.model)
        if not _identifier(request.voice_id):
            raise AudioFailure("AUDIO_INPUT_INVALID", receipt=receipt, unknown_outcome=False)
        payload = {"model_id": request.model, "text": request.text,
                   "apply_text_normalization": "off"}
        # [@elevenlabs_dialogue_timing20261005] Single-speaker dialogue keeps
        # the same PCM/alignment response contract as the legacy TTS route.
        if request.model == "eleven_v4_turbo":
            payload.pop("text")
            payload["inputs"] = [{"text": request.text, "voice_id": request.voice_id}]
            path = "text-to-dialogue"
        else:
            path = f"text-to-speech/{request.voice_id}"
        if request.language_code is not None:
            payload["language_code"] = request.language_code
        if on_audio is not None:
            from server.app.inference.synthesis_stream import SynthesisStream
            stream = SynthesisStream(on_audio, (self._key,))
            stream.receipt = receipt
            _, receipt = await self._post(
                f"{path}/stream/with-timestamps", receipt,
                limit=8 * 1024 * 1024, content_types={"application/json", "application/x-ndjson"},
                params={"output_format": "pcm_24000"}, json=payload,
                private=(request.text,), on_chunk=stream.feed)
            await stream.finish()
            return AudioResult(None, receipt)
        body, receipt = await self._post(
            f"{path}/with-timestamps", receipt,
            limit=8 * 1024 * 1024, content_types={"application/json"},
            params={"output_format": "pcm_24000"}, json=payload, private=(request.text,))
        return self.result(body, receipt)

    async def transcribe(self, request: TranscriptionRequest, *, model: str) -> AudioResult:
        receipt = AudioReceipt("elevenlabs", model)
        fields = {**request.fields, "model_id": model, "language_code": request.language_tag}
        body, receipt = await self._post("speech-to-text", receipt, limit=1_048_576,
            content_types={"application/json"}, data=fields,
            files={"file": ("audio.wav", request.wav, "audio/wav")})
        return self.result(body, receipt)

    def result(self, body, receipt):
        try:
            value = json.loads(body)
            if not isinstance(value, dict):
                raise ValueError()
            return AudioResult(for_client(value, (self._key,), limit=8 * 1024 * 1024), receipt)
        except (ValueError, UnicodeError, RecursionError):
            raise AudioFailure("AUDIO_RESPONSE_INVALID", receipt=receipt, unknown_outcome=True,
                diagnostics={"stage":"provider_json", "http":receipt.diagnostics}) from None
