"""The service validates captured choices; selection belongs to configuration."""
from dataclasses import replace
import httpx
import pytest
from server.app import main
from server.app.inference.transcription_languages import availability
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_audio_service import configured, records


def test_availability_uses_configured_credentials_and_synthesis_voice():
    cfg = replace(main.CFG, groq_key='', elevenlabs_key='', elevenlabs_voice_id='')
    assert availability(cfg)['available_models'] == []
    cfg = replace(cfg, elevenlabs_key='fixture')
    assert availability(cfg)['available_models'] == ['scribe_v2']
    cfg = replace(cfg, elevenlabs_voice_id='voice', tts_model='eleven_v3')
    assert set(availability(cfg)['available_models']) == {'scribe_v2', 'eleven_v3'}


@pytest.mark.asyncio
async def test_synthesis_rejects_malformed_language_before_reservation(proxy, ledger, monkeypatch):
    def respond(_request):
        pytest.fail('Unsupported language must not reach any provider')
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/speech', json={
        'model': 'eleven_v3', 'language_code': 'gd_invalid', 'text': 'fixture'})
    assert response.status_code == 400
    assert response.json()['code'] == 'INVALID_REQUEST'
    assert not records(ledger)


@pytest.mark.asyncio
async def test_transcription_never_substitutes_model(proxy, ledger, monkeypatch):
    import io
    import wave
    output = io.BytesIO()
    with wave.open(output, 'wb') as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(bytes(32000))
    def respond(request):
        assert request.url.path.endswith('/audio/transcriptions')
        assert b'whisper-large-v3' in request.content
        assert b'ga' in request.content
        return httpx.Response(200, json={'text':'fixture'})
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/transcriptions',
        data={'model':'whisper-large-v3','language':'ga','response_format':'json'},
        files={'file':('audio.wav',output.getvalue(),'audio/wav')})
    assert response.status_code == 200
    assert response.json()['response'] == {'text':'fixture'}


@pytest.mark.parametrize('line_ending', ['\n', '\r\n'])
def test_generated_catalog_matches_authored_source(line_ending):
    import hashlib
    from pathlib import Path
    from server.app.inference.speech_catalog import SOURCE_SHA256
    source = (Path(__file__).parents[3] / 'content/speech/speech-routing.yaml').read_text(encoding='utf-8')
    source = source.replace('\n', line_ending).replace('\r\n', '\n').encode('utf-8')
    assert hashlib.sha256(source).hexdigest() == SOURCE_SHA256


@pytest.mark.asyncio
@pytest.mark.parametrize('tag', ['chr', 'gd'])
async def test_language_is_forwarded_without_server_capability_policy(proxy, ledger, monkeypatch, tag):
    def respond(request):
        import json
        assert json.loads(request.content)['language_code'] == tag
        return httpx.Response(200, json={'audio_base64':'AAA='})
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/speech', json={
        'model':'eleven_v3', 'language_code':tag, 'text':'fixture'})
    assert response.status_code == 200
