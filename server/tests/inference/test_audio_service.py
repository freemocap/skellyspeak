"""Authenticated audio route, adapter and ledger integration; no paid requests."""
from dataclasses import replace
import base64
import io
import json
import wave

import httpx
import pytest

from server.app import main
from server.app.inference.synthesis_profiles import profile_id
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(main, "CFG", replace(main.CFG,
        elevenlabs_key="test-elevenlabs-key", elevenlabs_voice_id="fixtureVoice"))


def records(ledger):
    return [v for k, v in ledger.store.items() if "/reservations/" in k]


def test_synthesis_profile_tracks_effective_settings_only():
    original = profile_id(main.CFG)
    assert len(original) == 64
    assert profile_id(replace(main.CFG, elevenlabs_voice_id="otherVoice")) != original
    assert profile_id(replace(main.CFG, tts_model="otherModel")) != original
    assert profile_id(replace(main.CFG, elevenlabs_key="replacement-secret")) == original
    assert profile_id(replace(main.CFG, tts_micros_per_character=999)) == original


@pytest.mark.asyncio
async def test_stale_profile_rejected_before_paid_work(proxy, ledger, monkeypatch):
    def unexpected(request):
        pytest.fail("A stale profile must not reach the provider")
    upstream(monkeypatch, unexpected)
    response = await proxy.post("/v1/audio/speech", json={"model": main.CFG.tts_model,
        "text": "hello", "language": "English", "synthesis_profile": "0" * 64})
    assert response.status_code == 409
    assert response.json()["code"] == "SYNTHESIS_PROFILE_MISMATCH"
    assert not records(ledger)


@pytest.mark.asyncio
async def test_protocol_advertises_profile_without_voice_or_credentials(proxy):
    response = await proxy.get("/v1/protocol")
    assert response.status_code == 200
    assert response.json()["audio"]["synthesis_profile"] == profile_id(main.CFG)
    assert main.CFG.elevenlabs_voice_id not in response.text
    assert main.CFG.elevenlabs_key not in response.text


@pytest.mark.asyncio
async def test_speech_route_converts_request_and_accounts_estimate(proxy, ledger, monkeypatch):
    def respond(request):
        assert request.headers["xi-api-key"] == "test-elevenlabs-key"
        assert "authorization" not in request.headers
        assert request.url.path == "/v1/text-to-speech/fixtureVoice"
        body = json.loads(request.content)
        assert body["text"] == "[Spanish — Mexico accent]\nGracias." and body["model_id"] == "eleven_v3"
        return httpx.Response(200, content=b"\0\0" * 24_000, headers={"content-type": "audio/pcm", "request-id": "speech-receipt"})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={"synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "Gracias."})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["synthesis_profile"] == profile_id(main.CFG)
    assert base64.b64decode(result["audio_base64"]).startswith(b"RIFF")
    assert result["usage"]["cost_micros"] is None
    assert result["usage"]["allowance_basis"] == "estimate"
    row, = records(ledger)
    assert row["status"] == "settled" and row["cost_basis"] == "estimate"
    assert row["actual_micros"] == len("[Spanish — Mexico accent]\nGracias.") * 100
    assert row["provider_id"] == "speech-receipt"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 429, 503])
async def test_audio_error_keeps_reservation_and_original_status(proxy, ledger, monkeypatch, status):
    seen = []
    def respond(request):
        seen.append(request)
        return httpx.Response(status, text="private upstream body")
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={"synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "Hello"})
    assert response.status_code == 502
    assert str(status) in response.text and "private" not in response.text
    assert len(seen) == 1
    row, = records(ledger)
    assert row["status"] == "unknown" and row["actual_micros"] == row["reserved_micros"]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"model": "other", "text": "hello"}, {"model": "eleven_v3", "language": "Spanish — Mexico", "text": " "},
    {"model": "eleven_v3", "language": "Spanish — Mexico", "text": "hello", "voice_id": "unapproved"}])
async def test_invalid_speech_is_rejected_before_reservation(proxy, ledger, payload):
    response = await proxy.post("/v1/audio/speech", json={**payload, "synthesis_profile": profile_id(main.CFG)})
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_missing_config_fails_without_reservation(proxy, ledger, monkeypatch):
    monkeypatch.setattr(main, "CFG", replace(main.CFG, elevenlabs_voice_id=""))
    assert (await proxy.post("/v1/audio/speech", json={"synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "hello"})).status_code == 503
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
        response = await client.post("/v1/audio/speech", json={"synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "hello"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_tts_provider_reason_reaches_client_with_secrets_and_source_redacted(proxy, ledger, monkeypatch):
    seen = []
    def respond(request):
        seen.append(request)
        return httpx.Response(401, json={"detail": {
            "status": "missing_permissions",
            "message": "Missing permission text_to_speech. test-elevenlabs-key private learner sentence",
            "request": "private learner sentence", "api_key": "test-elevenlabs-key",
        }})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={
        "synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "private learner sentence",
    })
    assert response.status_code == 502
    assert response.json()["code"] == "ELEVENLABS_HTTP_401"
    detail = response.json()["provider_error"]
    assert detail["code"] == "missing_permissions"
    assert "Missing permission text_to_speech" in detail["message"]
    assert "ElevenLabs missing_permissions (provider HTTP 401)" in response.json()["detail"]
    assert "Missing permission text_to_speech" in response.json()["detail"]
    assert "test-elevenlabs-key" not in response.text
    assert "private learner sentence" not in response.text
    assert set(detail) == {"code", "message"}
    assert len(seen) == 1
    row, = records(ledger)
    assert row["status"] == "unknown"


@pytest.mark.asyncio
@pytest.mark.parametrize("language", [None, "", " ", 42, [], "Spanish [laughs]", "Spanish\nMexico", "x" * 257])
async def test_invalid_variety_fails_before_spending(proxy, ledger, language):
    response = await proxy.post("/v1/audio/speech", json={
        "synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "text": "Gracias.", "language": language,
    })
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_missing_variety_fails_before_spending(proxy, ledger):
    response = await proxy.post("/v1/audio/speech", json={"synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "text": "Gracias."})
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_accent_cue_counts_toward_provider_limit(proxy, ledger):
    response = await proxy.post("/v1/audio/speech", json={
        "synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "text": "a" * 4990, "language": "Spanish — Mexico",
    })
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_provider_busy_reason_is_in_primary_error_without_retry(proxy, ledger, monkeypatch):
    calls = []
    def respond(request):
        calls.append(request)
        return httpx.Response(429, json={"detail": {
            "status": "system_busy", "code": "system_busy", "type": "rate_limit_error",
            "message": "The system is experiencing heavy traffic, please try again.",
            "request_id": "provider-busy-request",
        }})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/audio/speech", json={
        "synthesis_profile": profile_id(main.CFG), "model": "eleven_v3", "language": "Spanish — Mexico", "text": "Gracias.",
    })
    assert response.status_code == 502
    body = response.json()
    assert body["detail"] == "ElevenLabs system_busy (provider HTTP 429): The system is experiencing heavy traffic, please try again."
    assert body["diagnostics"]["detail"]["request_id"] == "provider-busy-request"
    assert len(calls) == 1
    row, = records(ledger)
    assert row["status"] == "unknown"  # HTTP status alone does not prove zero billing.


@pytest.mark.asyncio
@pytest.mark.parametrize('model', ['whisper-large-v3', 'scribe_v2'])
async def test_invalid_optional_timing_does_not_discard_transcript(proxy, ledger, monkeypatch, model):
    def respond(_request):
        word = {'start': .5, 'end': 1.06}
        word.update({'word': 'fixture'} if model == 'whisper-large-v3' else {'type': 'word', 'text': 'fixture'})
        return httpx.Response(200, json={'text': 'fixture', 'words': [word]},
                              headers={'request-id': 'bounded-timing'})
    output = io.BytesIO()
    with wave.open(output, 'wb') as writer:
        writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(16000)
        writer.writeframes(bytes(32000))
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/transcriptions',
        data={'model': model, 'language': 'en', 'response_format': 'verbose_json'},
        files={'file': ('audio.wav', output.getvalue(), 'audio/wav')})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['text'] == 'fixture'
    assert result['timing'] is None
    assert result['usage']['diagnostics']['timing']['status'] == 'unavailable'
    assert result['usage']['diagnostics']['response']['words'][0]['end'] == 1.06
    row, = records(ledger)
    assert row['status'] == 'settled'
    assert row['provider_id'] == 'bounded-timing'
