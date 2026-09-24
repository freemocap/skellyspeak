"""The service validates captured choices; selection belongs to configuration."""
from dataclasses import replace
import httpx
import pytest
from server.app import main
from server.app.inference.transcription_languages import language_code, availability
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_audio_service import configured, records


@pytest.mark.parametrize('model,tag,task,expected', [
    ('whisper-large-v3', 'ga-IE', 'transcription', None),
    ('scribe_v2', 'ga-IE', 'transcription', 'ga'),
    ('scribe_v2', 'gle', 'transcription', 'gle'),
    ('scribe_v2', 'gd', 'transcription', None),
    ('eleven_v3', 'ga-IE', 'speech', 'ga'),
    ('eleven_v3', 'ast', 'speech', None),
    ('scribe_v2', 'ast', 'transcription', 'ast'),
    ('whisper-large-v3', 'zh-Hans', 'transcription', 'zh'),
    ('whisper-large-v3', 'eng', 'transcription', 'en'),
    ('eleven_v3', 'en', 'transcription', None),
    ('scribe_v2', 'en_XX', 'transcription', None),
])
def test_shared_capability_validation(model, tag, task, expected):
    assert language_code(model, tag, task) == expected


def test_availability_uses_configured_credentials_and_synthesis_voice():
    cfg = replace(main.CFG, groq_key='', elevenlabs_key='', elevenlabs_voice_id='')
    assert availability(cfg)['available_models'] == []
    cfg = replace(cfg, elevenlabs_key='fixture')
    assert availability(cfg)['available_models'] == ['scribe_v2']
    cfg = replace(cfg, elevenlabs_voice_id='voice', tts_model='eleven_v3')
    assert set(availability(cfg)['available_models']) == {'scribe_v2', 'eleven_v3'}


@pytest.mark.asyncio
async def test_synthesis_rejects_unsupported_language_before_reservation(proxy, ledger, monkeypatch):
    def respond(_request):
        pytest.fail('Unsupported language must not reach any provider')
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/speech', json={
        'model': 'eleven_v3', 'language': 'Scottish Gaelic', 'language_tag': 'gd', 'text': 'fixture'})
    assert response.status_code == 400
    assert response.json()['code'] == 'AUDIO_LANGUAGE_UNSUPPORTED'
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
    def respond(_request):
        pytest.fail('Service must reject this invalid captured model, not select Scribe')
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/transcriptions',
        data={'model':'whisper-large-v3','language':'ga','response_format':'json'},
        files={'file':('audio.wav',output.getvalue(),'audio/wav')})
    assert response.status_code == 400
    row, = records(ledger)
    assert row['actual_micros'] == 0


def test_generated_catalog_matches_authored_source():
    import hashlib
    from pathlib import Path
    from server.app.inference.speech_catalog import SOURCE_SHA256
    source = (Path(__file__).parents[3] / 'content/shared/speech-routing.yaml').read_bytes()
    assert hashlib.sha256(source).hexdigest() == SOURCE_SHA256
