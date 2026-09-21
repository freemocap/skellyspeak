"""Hosted audio admission and normalized wire results; adapters own provider JSON.

Allowance estimates are not provider invoices. Unknown submissions retain their
reservation, even when an error response can be delivered. No retries/fallbacks.
"""
import asyncio
import base64
import json
import math
from functools import partial

import anyio
import httpx
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from server.app.inference import audio_input
from server.app.inference.audio_contracts import AudioFailure, SynthesisRequest, TranscriptionRequest
from server.app.inference.elevenlabs import ElevenLabs, synthesis_text
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


async def _execute(who, cfg, reserve, settle, amount, invoke):
    reservation = None
    cost = 0
    provider_id = "elevenlabs"
    try:
        with anyio.CancelScope(shield=True):
            reservation = await anyio.to_thread.run_sync(partial(reserve, who, amount))
        await anyio.lowlevel.checkpoint()
        async with httpx.AsyncClient(timeout=60) as client:
            cost = None
            async with runtime.phase("provider", provider="ELEVENLABS"):
                try:
                    result = await invoke(ElevenLabs(client, api_key=cfg.elevenlabs_key))
                except AudioFailure as error:
                    provider_id = error.receipt.request_id or provider_id
                    runtime.emit("provider_headers", provider="ELEVENLABS", status=error.status)
                    if error.code == "AUDIO_INPUT_INVALID":
                        cost = 0  # Adapter refused before HTTP submission.
                    if error.code == "AUDIO_NO_SPEECH":
                        cost = amount  # Recognition completed, with no detected speech.
                    status = 422 if error.code in {"AUDIO_INPUT_INVALID", "AUDIO_NO_SPEECH"} else 502
                    # Preserve the redacted provider reason alongside the fixed HTTP code.
                    suffix = f" (provider HTTP {error.status})" if error.status else ""
                    code = f"ELEVENLABS_HTTP_{error.status}" if error.status else error.code
                    raise AudioRejection(status, code, f"{error.code}{suffix}. No automatic retry was made.",
                                         provider_error=error.provider_error, diagnostics=error.diagnostics) from None
            provider_id = result.receipt.request_id or provider_id
            cost = amount
            return result
    finally:
        if reservation is not None:
            await settle(reservation, cost=cost, tokens=0, provider_id=provider_id,
                         cost_basis="estimate", raise_unknown=False)


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
        if not isinstance(value, dict) or set(value) != {"model", "text", "language"}:
            raise HTTPException(400, "Speech requires model, text and language variety.")
        _model(value["model"], cfg.tts_model)
        text = value["text"]
        try:
            valid = isinstance(text, str) and text.strip() and len(text.encode()) <= 16_384 and "\0" not in text
        except UnicodeError:
            valid = False
        if not valid:
            raise HTTPException(400, "Invalid speech source text.")
        # [@elevenlabs_pricing_20260918] Explicit service rate, not actual billing.
        source = SynthesisRequest(cfg.tts_model, cfg.elevenlabs_voice_id, text,
                                  language_variety=value["language"])
        if source.language_variety is None:
            raise HTTPException(400, "Speech requires a language variety.")
        try:
            provider_text = synthesis_text(source)
            if len(provider_text.encode("utf-8")) > 16_384 or len(provider_text) > 5_000:
                raise ValueError()
        except (ValueError, UnicodeError):
            raise HTTPException(400, "Invalid speech language variety, model or input limit.") from None
        amount = len(provider_text) * cfg.tts_micros_per_character
        result = await _execute(who, cfg, reserve, settle, amount, lambda adapter: adapter.synthesize(source))
        return JSONResponse({"version": 1, "audio_base64": base64.b64encode(result.wav).decode(),
                             "format": "wav", "usage": _usage(result, amount)})


async def transcribe(request, who, cfg, reserve, settle, read_body):
    _configured(cfg)
    if _slots.locked():
        raise observability.Rejection("TRANSCRIPTION_BUSY", "Audio is busy. Try again shortly.", retry=5)
    async with _slots:
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("multipart/form-data"):
            raise HTTPException(400, "Audio must be multipart/form-data.")
        raw = await read_body(request, 8 * 1024 * 1024, "Recording")
        audio = await anyio.to_thread.run_sync(partial(audio_input.decode_upload, raw,
            content_type=content_type, language_code_width=3))
        _model(audio.fields["model"], cfg.stt_model)
        duration = len(audio.pcm) / (2 * audio_input.SAMPLE_RATE)
        amount = math.ceil(max(10, math.ceil(duration)) * cfg.stt_micros_per_hour / 3600)
        source = TranscriptionRequest(cfg.stt_model, audio.pcm, audio.fields.get("language"))
        result = await _execute(who, cfg, reserve, settle, amount, lambda adapter: adapter.transcribe(source))
        return JSONResponse({"version": 1, "text": result.text,
            "timing": {"text": result.text, "duration": result.duration_seconds,
                       "words": [{"word": w.text, "start": w.start, "end": w.end} for w in result.words]},
            "detected_language": result.detected_language, "language_probability": result.language_probability,
            "usage": _usage(result, amount)})
