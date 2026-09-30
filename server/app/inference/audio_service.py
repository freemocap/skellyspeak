"""Hosted audio admission and raw response envelopes; native interprets provider JSON.

Allowance estimates are not provider invoices. Unknown submissions retain their
reservation, even when an error response can be delivered. No retries/fallbacks.
"""
import asyncio
import json
import math
from functools import partial

import anyio
import httpx
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from server.app.inference import audio_input
from server.app.inference.transcription_languages import availability
from server.app.inference.audio_contracts import AudioFailure, SynthesisRequest, TranscriptionRequest
from server.app.inference.elevenlabs import ElevenLabs
from server.app.inference.transcription_profiles import bind, MAX_MICROS_PER_HOUR
from server.app.diagnostics import runtime, observability

_slots = asyncio.Semaphore(8)


class AudioRejection(HTTPException):
    def __init__(self, status, code, detail, *, provider_error=None, diagnostics=None):
        super().__init__(status, detail)
        self.code = code
        self.provider_error = provider_error
        self.diagnostics = diagnostics



def _configured(cfg, *, speech=False):
    if not cfg.elevenlabs_key or (speech and not cfg.elevenlabs_voice_id):
        raise AudioRejection(503, "AUDIO_NOT_CONFIGURED", "ElevenLabs audio is not configured on this server.")


def _model(value, expected):
    if value != expected:
        raise AudioRejection(400, "AUDIO_MODEL_MISMATCH", f"Select {expected} for this server's audio route.")


async def _execute(who, reserve, settle, amount, invoke, *, provider, label, create,
                   reservation=None, raise_cancelled_unknown=False, progress=None):
    cost = 0
    cancelled = False
    provider_id = provider
    try:
        if reservation is None:
            with anyio.CancelScope(shield=True):
                reservation = await anyio.to_thread.run_sync(partial(reserve, who, amount))
        await anyio.lowlevel.checkpoint()
        async with httpx.AsyncClient(timeout=60) as client:
            cost = None
            async with runtime.phase("provider", provider=provider.upper()):
                try:
                    result = await invoke(create(client))
                except AudioFailure as error:
                    provider_id = error.receipt.request_id or provider_id
                    runtime.emit("provider_headers", provider=provider.upper(), status=error.status)
                    if error.code == "AUDIO_INPUT_INVALID":
                        cost = 0  # Adapter refused before HTTP submission.
                    if error.code == "AUDIO_NO_SPEECH":
                        cost = amount  # Recognition completed, with no detected speech.
                    status = 422 if error.code in {"AUDIO_INPUT_INVALID", "AUDIO_NO_SPEECH"} else 502
                    # Preserve the redacted provider reason alongside the fixed HTTP code.
                    suffix = f" (provider HTTP {error.status})" if error.status else ""
                    code = f"{provider.upper()}_HTTP_{error.status}" if error.status else error.code
                    reason = (error.provider_error or {}).get("message")
                    provider_code = (error.provider_error or {}).get("code", error.code)
                    detail = f"{label} {provider_code}{suffix}"
                    if reason:
                        detail += f": {reason}"
                    raise AudioRejection(status, code, detail,
                                         provider_error=error.provider_error, diagnostics={
                                             "provider": error.receipt.provider,
                                             "requested_model": error.receipt.requested_model,
                                             "request_id": error.receipt.request_id,
                                             "receipt": error.receipt.diagnostics,
                                             **(error.diagnostics or {}),
                                         }) from None
            provider_id = result.receipt.request_id or provider_id
            cost = amount
            return result
    except asyncio.CancelledError:
        cancelled = True
        raise
    finally:
        if reservation is not None:
            provider_id = (progress or {}).get('request_id') or provider_id
            await settle(reservation, cost=cost, tokens=0, provider_id=provider_id,
                         cost_basis="estimate", raise_unknown=cancelled and raise_cancelled_unknown)


def _usage(result, allowance):
    return {"provider": result.receipt.provider, "requested_model": result.receipt.requested_model, "actual_model": None,
            "request_id": result.receipt.request_id, "cost_micros": result.receipt.cost_micros,
            "allowance_micros": allowance, "allowance_basis": "estimate", "diagnostics": result.receipt.diagnostics}


async def synthesize(request, who, cfg, reserve, settle, read_body):
    _configured(cfg, speech=True)
    if _slots.locked():
        raise observability.Rejection("TRANSCRIPTION_BUSY", "Audio is busy. Try again shortly.", retry=5)
    async with _slots:
        raw = await read_body(request, 32_768, "Speech request")
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeError):
            raise HTTPException(400, "Invalid speech request JSON.") from None
        if not isinstance(value, dict) or set(value) != {"model", "text", "language_code"}:
            raise HTTPException(400, "Speech requires model, prepared text and language_code.")
        _model(value["model"], cfg.tts_model)
        code = value["language_code"]
        if code is not None and (not isinstance(code, str) or not code.isascii() or not code.isalpha() or not 2 <= len(code) <= 3):
            raise HTTPException(400, "Invalid provider language code.")
        text = value["text"]
        try:
            valid = isinstance(text, str) and text.strip() and len(text.encode()) <= 16_384 and "\0" not in text
        except UnicodeError:
            valid = False
        if not valid:
            raise HTTPException(400, "Invalid speech source text.")
        # [@elevenlabs_pricing_20260918] Explicit service rate, not actual billing.
        source = SynthesisRequest(cfg.tts_model, cfg.elevenlabs_voice_id, text, language_code=code)
        if len(text) > 5_000:
            raise HTTPException(400, "Speech exceeds provider input limit.")
        amount = len(text) * cfg.tts_micros_per_character
        if request.headers.get('accept') == 'application/x-ndjson':
            from server.app.inference.speech_streaming import response

            async def execute_stream(emit):
                progress = {}

                async def forward(chunk):
                    progress.update(chunk['receipt'])
                    await emit(chunk)

                result = await _execute(who, reserve, settle, amount,
                    lambda adapter: adapter.synthesize(source, on_audio=forward),
                    provider="elevenlabs", label="ElevenLabs",
                    create=lambda client: ElevenLabs(client, api_key=cfg.elevenlabs_key),
                    raise_cancelled_unknown=True, progress=progress)
                return result, _usage(result, amount)

            return response(execute_stream, _slots, (text, cfg.elevenlabs_key))
        result = await _execute(who, reserve, settle, amount, lambda adapter: adapter.synthesize(source),
                                provider="elevenlabs", label="ElevenLabs",
                                create=lambda client: ElevenLabs(client, api_key=cfg.elevenlabs_key))
        return JSONResponse({"version": 3, "response": result.response, "usage": _usage(result, amount)})


async def transcribe(request, who, cfg, reserve, settle, read_body):
    if _slots.locked():
        raise observability.Rejection("TRANSCRIPTION_BUSY", "Audio is busy. Try again shortly.", retry=5)
    async with _slots:
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("multipart/form-data"):
            raise HTTPException(400, "Audio must be multipart/form-data.")
        # Spending admission precedes decoding. A conservative reservation covers either adapter.
        reservation, transferred = None, False
        try:
            maximum = math.ceil(audio_input.MAX_SECONDS * MAX_MICROS_PER_HOUR / 3600)
            with anyio.CancelScope(shield=True):
                reservation = await anyio.to_thread.run_sync(partial(reserve, who, maximum))
            await anyio.lowlevel.checkpoint()
            raw = await read_body(request, 8 * 1024 * 1024, "Recording")
            audio = await anyio.to_thread.run_sync(partial(audio_input.decode_upload, raw,
                content_type=content_type, language_code_width=3))
            language = audio.fields.get("language")
            binding = bind(audio.fields["model"], cfg)
            if not language:
                raise AudioRejection(400, "AUDIO_LANGUAGE_REQUIRED", "The selected model requires an explicit supported language tag.")
            if not binding.configured:
                raise AudioRejection(503, "AUDIO_NOT_CONFIGURED", f"{binding.label} transcription is not configured on this server.")
            duration = audio.duration
            amount = math.ceil(max(10, math.ceil(duration)) * binding.micros_per_hour / 3600)
            source = TranscriptionRequest(audio.wav, language, {k: v for k, v in audio.fields.items() if k not in {"model", "language"}})
            transferred = True
            result = await _execute(who, reserve, settle, amount, lambda transcribe: transcribe(source),
                                    provider=binding.provider, label=binding.label, create=binding.create, reservation=reservation, raise_cancelled_unknown=True)
            return JSONResponse({"version": 3, "response": result.response, "usage": _usage(result, amount)})
        finally:
            if reservation is not None and not transferred:
                await settle(reservation, cost=0, tokens=0, provider_id="", cost_basis="estimate", raise_unknown=False)
