"""Real grouped endpoint, controlled upstream: route, auth, history, schema and cost."""
import json
import httpx
import pytest
import server.app.main as main
import server.app.inference.model_routing as routing
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_grouped import envelope


@pytest.mark.asyncio
async def test_mixed_models_use_correct_credentials_and_preserve_history(proxy, monkeypatch):
    history = [{"role": "system", "content": "Speak Spanish."}, {"role": "assistant", "content": "¿Te gusta cocinar?"}, {"role": "user", "content": "No, prefiero leer."}]
    sent = []
    def respond(request):
        body = json.loads(request.content); sent.append(body)
        assert body["messages"] == history
        assert str(request.url).startswith(main.CFG.openrouter_base_url)
        assert request.headers["authorization"] == "Bearer " + main.CFG.openrouter_key
        assert body["max_tokens"] == 2048
        assert "max_price" not in body["provider"]
        usage = {"cost": 0.0001, "total_tokens": 2000}
        return httpx.Response(200, json={"id": body["model"], "model": body["model"], "choices": [{"finish_reason": "stop", "message": {"content": "¿Qué lees?"}}], "usage": usage})
    upstream(monkeypatch, respond)
    request = envelope(3)
    for item, model in zip(request["items"], [routing.OSS, routing.LITE, routing.FLASH]):
        item["request"] = {"model": model, "messages": history, "max_tokens": 2048}
    response = await proxy.post('/v1/operations', json=request)
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [e['type'] for e in events] == ['result', 'result', 'result', 'complete']
    assert {e['response']['model'] for e in events[:-1]} == set(routing.RECOMMENDED_TEXT_MODELS)
    assert len(sent) == 3


@pytest.mark.asyncio
async def test_unknown_model_is_delegated_without_poisoning_other_operations(proxy, ledger, monkeypatch):
    import server.app.accounting.budget as budget
    sent = []
    def respond(request):
        body = json.loads(request.content)
        sent.append(body)
        if body['model'] == 'new-provider/new-model':
            assert str(request.url).startswith(main.CFG.openrouter_base_url)
            assert 'max_price' not in body['provider']
            return httpx.Response(404, text='PRIVATE_PROVIDER_BODY')
        return httpx.Response(200, json={'id': 'ok', 'model': body['model'],
            'choices': [{'message': {'content': 'Hola'}, 'finish_reason': 'stop'}],
            'usage': {'cost': 0.00001, 'total_tokens': 5}})
    upstream(monkeypatch, respond)
    request = envelope(2)
    request['items'][0]['request']['model'] = 'new-provider/new-model'
    response = await proxy.post('/v1/operations', json=request)
    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.splitlines()]
    failed = next(e for e in events if e['type'] == 'error')
    assert failed['operation_id'] == request['items'][0]['operation_id']
    assert failed['code'] == 'OPENROUTER_HTTP_404'
    assert failed['status'] == 502
    assert len([e for e in events if e['type'] == 'result']) == 1
    assert events[-1] == {'type': 'complete', 'count': 2}
    assert len(sent) == 2
    assert 'PRIVATE_PROVIDER_BODY' not in response.text
    records = [v for k, v in ledger.store.items() if f'/{budget.RESERVATIONS}/' in k]
    assert sorted(r['status'] for r in records) == ['settled', 'unknown']
    unknown = next(r for r in records if r['status'] == 'unknown')
    assert unknown['actual_micros'] == unknown['reserved_micros']


@pytest.mark.asyncio
@pytest.mark.parametrize('model,provider', [(routing.OSS, 'OPENROUTER'), ('new/model', 'OPENROUTER')])
@pytest.mark.parametrize('status', [400, 401, 402, 403, 404, 422, 429, 503])
async def test_provider_rejections_preserve_provider_and_status(proxy, monkeypatch, model, provider, status):
    upstream(monkeypatch, lambda _: httpx.Response(status, text='PRIVATE_PROVIDER_ERROR'))
    request = envelope(1)
    request['items'][0]['request']['model'] = model
    response = await proxy.post('/v1/operations', json=request)
    events = [json.loads(line) for line in response.text.splitlines()]
    assert events[0]['code'] == f'{provider}_HTTP_{status}'
    assert events[0]['status'] == 502
    assert events[-1]['type'] == 'complete'
    assert 'PRIVATE_PROVIDER_ERROR' not in response.text


@pytest.mark.asyncio
async def test_new_openrouter_model_can_succeed_without_server_catalog_edit(proxy, monkeypatch):
    def respond(request):
        body = json.loads(request.content)
        assert body['model'] == 'new/model'
        return httpx.Response(200, json={'id': 'ok', 'model': 'new/model',
            'choices': [{'finish_reason': 'stop', 'message': {'content': 'Hola'}}],
            'usage': {'cost': 0.00001, 'total_tokens': 5}})
    upstream(monkeypatch, respond)
    request = envelope(1)
    request['items'][0]['request']['model'] = 'new/model'
    response = await proxy.post('/v1/operations', json=request)
    assert json.loads(response.text.splitlines()[0])['type'] == 'result'


@pytest.mark.asyncio
async def test_provider_error_inside_success_status_is_still_surfaced(proxy, monkeypatch):
    upstream(monkeypatch, lambda _: httpx.Response(200, json={'error': {'code': 404, 'message': 'No provider endpoint supports this model.'}}))
    response = await proxy.post('/v1/operations', json=envelope(1))
    event = json.loads(response.text.splitlines()[0])
    assert event['code'] == 'OPENROUTER_HTTP_404'
    assert event['diagnostics']['error']['message'] == 'No provider endpoint supports this model.'


@pytest.mark.asyncio
async def test_non_gloss_union_is_delegated_without_app_schema_assumptions(proxy, ledger, monkeypatch):
    schema = {"type": "object", "properties": {"spans": {"type": "array", "items": {
        "oneOf": [{"type": "string"}, {"type": "integer"}]}}}}
    sent = []
    def respond(request):
        body = json.loads(request.content)
        sent.append(body)
        assert body['response_format']['json_schema']['schema'] == schema
        return httpx.Response(200, json={'id': 'groq-ok', 'choices': [],
            'usage': {'cost': 0.00001, 'total_tokens': 20}})
    upstream(monkeypatch, respond)
    request = envelope(1)
    request['items'][0]['request'].update(model=routing.OSS, response_format={
        'type': 'json_schema', 'json_schema': {'name': 'unrelated', 'strict': True, 'schema': schema}})
    response = await proxy.post('/v1/operations', json=request)
    assert json.loads(response.text.splitlines()[0])['type'] == 'result'
    assert len(sent) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('schema', [
    {'properties': {}, 'minimum': float('nan')},
])
async def test_preparation_failure_never_reserves_or_submits(proxy, ledger, monkeypatch, schema):
    submitted = []
    upstream(monkeypatch, lambda request: submitted.append(request) or httpx.Response(200, json={}))
    request = envelope(1)
    request['items'][0]['request'].update(model=routing.OSS, response_format={
        'type': 'json_schema', 'json_schema': {'name': 'word_gloss_v1', 'strict': True, 'schema': schema}})
    # Raw JSON also exercises rejecting nonfinite schema values before dispatch.
    response = await proxy.post('/v1/operations', content=json.dumps(request), headers={'Content-Type': 'application/json'})
    event = json.loads(response.text.splitlines()[0])
    assert event['type'] == 'error' and event['status'] == 400
    assert event['code'] == 'REQUEST_REJECTED'
    assert not submitted
    assert not any('/reservations/' in key for key in ledger.store)
    assert ledger.store['users/learner/work_control/slots']['active'] == {}
    assert next(v for k, v in ledger.store.items() if '/work_attempts/' in k)['state'] == 'failed'


@pytest.mark.asyncio
@pytest.mark.parametrize('model', [routing.OSS, 'future/model'])
async def test_chat_endpoint_passes_any_model_to_openrouter(proxy, monkeypatch, model):
    sent = []
    def respond(request):
        body = json.loads(request.content)
        sent.append(body)
        assert body['model'] == model
        assert str(request.url).startswith(main.CFG.openrouter_base_url)
        assert 'only' not in body['provider']
        return httpx.Response(400, text='PRIVATE_PROVIDER_ERROR')
    upstream(monkeypatch, respond)
    response = await proxy.post('/v1/chat/completions', json={
        'model': model, 'messages': [{'role': 'user', 'content': 'Hola'}], 'max_tokens': 2048})
    assert response.status_code == 502
    assert response.json()['code'] == 'OPENROUTER_HTTP_400'
    assert len(sent) == 1
    assert 'PRIVATE_PROVIDER_ERROR' not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize('status', [200, 400])
async def test_new_transcription_model_reaches_groq_once(proxy, monkeypatch, status):
    from server.tests.inference.test_contracts import upload
    sent = []
    def respond(request):
        sent.append(request)
        assert str(request.url).startswith(main.CFG.groq_base_url)
        assert b'future-transcription-model' in request.content
        return httpx.Response(status, json={'text': 'Hola'} if status == 200 else {'error': {'message': 'The selected transcription model is unavailable.'}})
    upstream(monkeypatch, respond)
    audio = upload(1, model='future-transcription-model')
    response = await proxy.post('/v1/audio/transcriptions', content=audio.read(),
        headers={'Content-Type': audio.headers['Content-Type']})
    assert len(sent) == 1
    assert response.status_code == (200 if status == 200 else 502)
    if status == 200:
        assert response.json()['text'] == 'Hola'
    else:
        assert response.json()['code'] == 'GROQ_HTTP_400'
        assert response.json()['diagnostics']['error']['message'] == 'The selected transcription model is unavailable.'


@pytest.mark.asyncio
async def test_audio_named_model_with_text_output_is_not_rejected_by_grouped_route(proxy, monkeypatch):
    sent = []
    def respond(request):
        body = json.loads(request.content)
        sent.append(body)
        assert body['model'] == 'openai/gpt-audio-mini'
        return httpx.Response(400, text='PRIVATE_PROVIDER_ERROR')
    upstream(monkeypatch, respond)
    request = envelope(1)
    request['items'][0]['request']['model'] = 'openai/gpt-audio-mini'
    response = await proxy.post('/v1/operations', json=request)
    assert json.loads(response.text.splitlines()[0])['code'] == 'OPENROUTER_HTTP_400'
    assert len(sent) == 1
