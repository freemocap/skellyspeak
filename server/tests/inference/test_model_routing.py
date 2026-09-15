"""Real grouped endpoint, controlled upstream: route, auth, history, schema and cost."""
import json
from copy import deepcopy
from pathlib import Path
import httpx
import pytest
import server.app.main as main
import server.app.inference.model_routing as routing
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_grouped import envelope


def test_groq_usage_counts_reasoning_and_rejects_invalid_counts():
    assert routing.groq_usage({"usage": {"prompt_tokens": 1000, "completion_tokens": 1000, "completion_tokens_details": {"reasoning_tokens": 900}}}) == (750, 2000)
    assert routing.groq_usage({}) == (None, 0)
    for count in [-1, True, "100"]:
        with pytest.raises(ValueError):
            routing.groq_usage({"usage": {"prompt_tokens": count, "completion_tokens": 1}})


@pytest.mark.asyncio
async def test_mixed_models_use_correct_credentials_and_preserve_history(proxy, monkeypatch):
    history = [{"role": "system", "content": "Speak Spanish."}, {"role": "assistant", "content": "¿Te gusta cocinar?"}, {"role": "user", "content": "No, prefiero leer."}]
    sent = []
    def respond(request):
        body = json.loads(request.content); sent.append(body)
        assert body["messages"] == history
        groq = body["model"] == routing.OSS
        assert str(request.url).startswith(main.CFG.groq_base_url if groq else main.CFG.openrouter_base_url)
        assert request.headers["authorization"] == "Bearer " + (main.CFG.groq_key if groq else main.CFG.openrouter_key)
        if groq:
            assert body["reasoning_effort"] == "low"
            assert body["max_completion_tokens"] == 2048
            assert "provider" not in body and "reasoning" not in body and "max_tokens" not in body
        usage = {"prompt_tokens": 1000, "completion_tokens": 1000, "total_tokens": 2000}
        if not groq: usage["cost"] = 0.0001
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


def test_native_gloss_schema_is_relaxed_only_at_groq_transport_boundary():
    fixtures = json.loads((Path(__file__).resolve().parents[3] / 'workflow/benchmarks/model-routing/native-gloss-fixtures.json').read_text())
    original = {"model": routing.OSS, "max_tokens": 2048, "response_format": {"json_schema": {"name": "word_gloss_v1", "schema": fixtures[0]['schema']}}}
    saved = deepcopy(original)
    outbound = routing.groq_payload(original)
    assert original == saved
    expected = deepcopy(saved['response_format']['json_schema']['schema'])
    for variant in expected['properties']['spans']['items']['oneOf']:
        for endpoint in ['first', 'last']:
            variant['properties'][endpoint] = {"type": "string"}
    assert outbound['response_format']['json_schema']['schema'] == expected


@pytest.mark.asyncio
async def test_unknown_model_is_delegated_without_poisoning_other_operations(proxy, ledger, monkeypatch):
    import server.app.accounting.budget as budget
    sent = []
    def respond(request):
        body = json.loads(request.content)
        sent.append(body)
        if body['model'] == 'new-provider/new-model':
            assert str(request.url).startswith(main.CFG.openrouter_base_url)
            assert body['provider']['max_price'] == {'prompt': 0.3, 'completion': 2.5, 'request': 0}
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
@pytest.mark.parametrize('model,provider', [(routing.OSS, 'GROQ'), ('new/model', 'OPENROUTER')])
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
    upstream(monkeypatch, lambda _: httpx.Response(200, json={'error': {'code': 404, 'message': 'PRIVATE_ERROR'}}))
    response = await proxy.post('/v1/operations', json=envelope(1))
    event = json.loads(response.text.splitlines()[0])
    assert event['code'] == 'OPENROUTER_HTTP_404'
    assert 'PRIVATE_ERROR' not in response.text


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
            'usage': {'prompt_tokens': 10, 'completion_tokens': 10}})
    upstream(monkeypatch, respond)
    request = envelope(1)
    request['items'][0]['request'].update(model=routing.OSS, response_format={
        'type': 'json_schema', 'json_schema': {'name': 'unrelated', 'strict': True, 'schema': schema}})
    response = await proxy.post('/v1/operations', json=request)
    assert json.loads(response.text.splitlines()[0])['type'] == 'result'
    assert len(sent) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('schema', [
    {'properties': {'spans': {'items': {'oneOf': [{'type': 'string'}, {'type': 'integer'}]}}}},
    {'properties': None},
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
