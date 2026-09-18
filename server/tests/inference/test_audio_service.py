"""Authenticated audio route, adapter and ledger integration; no paid requests."""
from dataclasses import replace
import base64
import io
import json
import wave

import httpx
import pytest

from server.app import main
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(main, "CFG", replace(main.CFG, stt_provider="elevenlabs",
        elevenlabs_key="test-elevenlabs-key", elevenlabs_voice_id="fixtureVoice"))


def records(ledger):
    return [v for k, v in ledger.store.items() if "/reservations/" in k]


@pytest.mark.asyncio
async def test_speech_route_converts_request_and_accounts_estimate(proxy, ledger, monkeypatch):
    def respond(request):
        assert request.headers["xi-api-key"] == "test-elevenlabs-key"
        assert "authorization" not in request.headers
        assert request.url.path == "/v1/text-to-speech/fixtureVoice"
        body = json.loads(request.content)
        assert body["text"] == "നന്ദി" and body["model_id"] == "eleven_v3"
        return httpx.Response(200, content=b"\0\0" * 24_000, headers={"content-type": "audio/pcm", "request-id": "speech-receipt"})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={"model": "eleven_v3", "text": "നന്ദി"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert base64.b64decode(result["audio_base64"]).startswith(b"RIFF")
    assert result["usage"]["cost_micros"] is None
    assert result["usage"]["allowance_basis"] == "estimate"
    row, = records(ledger)
    assert row["status"] == "settled" and row["cost_basis"] == "estimate"
    assert row["actual_micros"] == len("നന്ദി") * 100
    assert row["provider_id"] == "speech-receipt"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 429, 503])
async def test_audio_error_keeps_reservation_and_original_status(proxy, ledger, monkeypatch, status):
    seen = []
    def respond(request):
        seen.append(request)
        return httpx.Response(status, text="private upstream body")
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={"model": "eleven_v3", "text": "Hello"})
    assert response.status_code == 502
    assert str(status) in response.text and "private" not in response.text
    assert len(seen) == 1
    row, = records(ledger)
    assert row["status"] == "unknown" and row["actual_micros"] == row["reserved_micros"]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"model": "other", "text": "hello"}, {"model": "eleven_v3", "text": " "},
    {"model": "eleven_v3", "text": "hello", "voice_id": "unapproved"}])
async def test_invalid_speech_is_rejected_before_reservation(proxy, ledger, payload):
    response = await proxy.post("/v1/audio/speech", json=payload)
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_missing_config_fails_without_reservation(proxy, ledger, monkeypatch):
    monkeypatch.setattr(main, "CFG", replace(main.CFG, elevenlabs_voice_id=""))
    assert (await proxy.post("/v1/audio/speech", json={"model": "eleven_v3", "text": "hello"})).status_code == 503
    assert not records(ledger)


@pytest.mark.asyncio
async def test_scribe_normalizes_timing_without_whisper_segments(proxy, ledger, monkeypatch):
    def respond(request):
        assert request.url.path == "/v1/speech-to-text"
        body = request.read()
        assert b'name="language_code"\r\n\r\ngle' in body
        assert b'name="prompt"' not in body
        return httpx.Response(200, json={"text": "Go raibh maith agat", "language_code": "gle",
            "words": [{"type": "word", "text": "Go", "start": 0.1, "end": 0.4}]})
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(16_000)
        writer.writeframes(b"\0\0" * 16_000)
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/transcriptions", data={"model": "scribe_v2", "language": "gle", "response_format": "json"},
                                files={"file": ("audio.wav", output.getvalue(), "audio/wav")})
    assert response.status_code == 200, response.text
    value = response.json()
    assert value["text"] == "Go raibh maith agat"
    assert value["timing"]["words"] == [{"word": "Go", "start": 0.1, "end": 0.4}]
    assert "segments" not in value and value["usage"]["cost_micros"] is None
    row, = records(ledger)
    assert row["cost_basis"] == "estimate" and row["status"] == "settled"


@pytest.mark.asyncio
async def test_speech_requires_authentication():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.post("/v1/audio/speech", json={"model": "eleven_v3", "text": "hello"})
    assert response.status_code == 401
