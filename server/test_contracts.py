"""Request validation rejects billing bypasses before any upstream request."""

from __future__ import annotations

import io
import wave

import httpx
import pytest
from fastapi import HTTPException

import audio_input
import contracts

MODELS = ("google/gemini-2.5-flash", "openai/gpt-audio-mini")


def payload() -> dict[str, object]:
    return {"model": MODELS[0], "messages": [{"role": "user", "content": "Hola"}]}


@pytest.mark.parametrize("field,value", [
    ("models", [MODELS[1]]), ("model", []), ("model", "unpriced/model"),
    ("max_tokens", 0), ("max_tokens", True), ("max_tokens", 32769),
    ("temperature", float("nan")), ("temperature", True),
    ("stream", "true"), ("provider", {"order": ["expensive"]}),
    ("messages", [{"role": [], "content": "hello"}]),
    ("messages", [{"role": "user", "content": [{"type": "image_url"}]}]),
    ("messages", [{"role": "user", "content": "x" * 100_000}]),
])
def test_unsupported_requests_fail_with_400(field: str, value: object) -> None:
    request = payload()
    request[field] = value
    with pytest.raises(HTTPException) as error:
        contracts.chat_request(request, allowed_models=MODELS, max_tokens=32768)
    assert error.value.status_code == 400


def test_missing_cap_is_inserted_and_provider_price_is_pinned() -> None:
    request = contracts.chat_request(payload(), allowed_models=MODELS, max_tokens=32768)
    assert request.payload["max_tokens"] == 32768
    assert request.payload["provider"] == {
        "allow_fallbacks": False, "require_parameters": True, "max_price": {"prompt": 1, "completion": 3, "request": 0},
    }
    assert request.reserve_micros >= 32768 * 3


def upload(seconds: int) -> httpx.Request:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(audio_input.SAMPLE_RATE)
        wav.writeframes(bytes(seconds * audio_input.SAMPLE_RATE * 2))
    return httpx.Request(method="POST", url="https://test.invalid", data={
        "model": "whisper-large-v3", "language": "es", "response_format": "json",
    }, files={"file": ("audio.wav", output.getvalue(), "audio/wav")})


@pytest.mark.parametrize("seconds,charge", [(1, 309), (11, 340), (120, 3700)])
def test_decoded_duration_controls_reservation(seconds: int, charge: int) -> None:
    request = upload(seconds)
    result = audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
    assert len(result.pcm) == seconds * audio_input.SAMPLE_RATE * 2
    assert result.cost_micros == charge


def test_long_recording_is_rejected_without_truncating_it_into_a_billable_request() -> None:
    request = upload(121)
    with pytest.raises(HTTPException, match="120 seconds"):
        audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
