"""Both supported synthesis models traverse the same admission/receipt boundary."""
import base64
import json

import httpx
import pytest

from server.tests.inference.test_audio_service import configured, records
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger


@pytest.mark.asyncio
@pytest.mark.parametrize('model,path,rate', [
    ('eleven_v3', '/v1/text-to-speech/fixtureVoice', 100),
    ('eleven_v4_turbo', '/v1/text-to-dialogue', 40),
])
@pytest.mark.parametrize('streaming', [False, True])
async def test_models_preserve_audio_timing_identity_and_cost_policy(proxy, ledger, monkeypatch, model, path, rate, streaming):
    text = '我想飲杯茶。'
    frame = {'audio_base64': base64.b64encode(bytes(48000)).decode(),
             'alignment': {'characters': list(text), 'character_start_times_seconds': [0.1] * len(text),
                           'character_end_times_seconds': [0.8] * len(text)},
             'voice_segments': [{'voice_id': 'fixtureVoice', 'dialogue_input_index': 0}]}
    seen = []

    def respond(request):
        seen.append(request)
        assert request.url.path == path + ('/stream' if streaming else '') + '/with-timestamps'
        assert request.url.params['output_format'] == 'pcm_24000'
        body = json.loads(request.content)
        assert body['model_id'] == model
        assert body['apply_text_normalization'] == 'off'
        if model == 'eleven_v4_turbo':
            assert body['inputs'] == [{'text': text, 'voice_id': 'fixtureVoice'}]
            assert 'text' not in body
        else:
            assert body['text'] == text
        assert request.headers['xi-api-key'] == 'test-elevenlabs-key'
        return httpx.Response(200, content=json.dumps(frame) + ('\n' if streaming else ''),
                              headers={'content-type': 'application/json', 'request-id': 'multi-model-receipt'})

    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/speech', json={'model': model, 'text': text, 'language_code': None},
                                headers={'accept': 'application/x-ndjson'} if streaming else {})
    assert response.status_code == 200, response.text
    if streaming:
        chunks = [json.loads(line) for line in response.text.splitlines()]
        assert [x['type'] for x in chunks] == ['start', 'audio', 'complete']
        assert chunks[1]['response'] == frame
        usage = chunks[-1]['usage']
    else:
        assert response.json()['response'] == frame
        usage = response.json()['usage']
    assert usage['requested_model'] == model
    assert usage['request_id'] == 'multi-model-receipt'
    assert usage['cost_micros'] is None
    assert usage['allowance_micros'] == len(text) * rate
    row, = records(ledger)
    assert row['actual_micros'] == len(text) * rate
    assert row['cost_basis'] == 'estimate'
    assert len(seen) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('model,length', [('eleven_v4_turbo', 2001), ('eleven_v3', 5001)])
async def test_model_input_limits_refuse_before_spending(proxy, ledger, model, length):
    response = await proxy.post('/v1/audio/speech', json={'model': model, 'text': '字' * length, 'language_code': None})
    assert response.status_code == 400
    assert not records(ledger)


@pytest.mark.asyncio
async def test_turbo_failure_does_not_retry_v3(proxy, ledger, monkeypatch):
    seen = []
    def respond(request):
        seen.append(json.loads(request.content)['model_id'])
        return httpx.Response(429, json={'detail': {'status': 'quota_exceeded', 'message': 'Quota exceeded'}},
                              headers={'request-id': 'failed-turbo'})
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/audio/speech', json={'model': 'eleven_v4_turbo', 'text': '你好', 'language_code': None})
    assert response.status_code == 502
    assert seen == ['eleven_v4_turbo']
    assert 'quota_exceeded' in response.text
    row, = records(ledger)
    assert row['provider_id'] == 'failed-turbo'
