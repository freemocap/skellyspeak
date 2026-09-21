"""Provider refusal retries, per-operation ownership and conservative accounting."""
import asyncio
import json

import httpx
import pytest

from server.app import main
from server.app.inference import retry
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_grouped import envelope


def limited(status=429, code='system_busy', chars=None):
    details = {'http': {'status': status}, 'error': {'code': code, 'message': 'Heavy traffic'}}
    if chars is not None:
        details['partial'] = {'chars': chars}
    return main.UpstreamHTTPError(status, 'OPENROUTER', details)


def test_bounded_policy_and_retry_after():
    error = limited()
    assert [retry.delay(error, n, 0, 0) for n in range(4)] == [1, 2, 4, None]
    error.diagnostics['http']['response_headers'] = {'retry_after': '10'}
    assert retry.delay(error, 0, 0, 0) == 10
    assert retry.delay(error, 0, 25, 0) is None
    for header in ['-1', 'invalid', '300']:
        error.diagnostics['http']['response_headers']['retry_after'] = header
        assert retry.delay(error, 0, 0, 0) is None
    for error in [limited(401), limited(503), limited(code='quota_exceeded'), limited(chars=3), TimeoutError()]:
        assert retry.delay(error, 0, 0, 0) is None
    assert retry.delay(limited(chars=0), 0, 0, 0) == 1


@pytest.mark.asyncio
async def test_maximum_and_cancellation_keep_history_without_resubmitting():
    calls = 0
    async def request():
        nonlocal calls
        calls += 1
        raise limited()
    async def no_wait(_):
        pass
    with pytest.raises(main.UpstreamHTTPError) as failure:
        await retry.run(request, sleep=no_wait, jitter=lambda: 0)
    assert calls == 4
    assert len(failure.value.diagnostics['automatic_retries']) == 3
    calls = 0
    async def cancel(_):
        raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError) as failure:
        await retry.run(request, sleep=cancel, jitter=lambda: 0)
    assert calls == 1
    assert len(failure.value.diagnostics['automatic_retries']) == 1


@pytest.mark.asyncio
async def test_group_retries_only_rejected_sibling_and_accounts_each_round(proxy, ledger, monkeypatch):
    calls = {}
    original = retry.run
    async def no_wait(_):
        pass
    async def immediate(request):
        return await original(request, sleep=no_wait, jitter=lambda: 0)
    monkeypatch.setattr(retry, 'run', immediate)
    def respond(request):
        body = json.loads(request.content)
        name = body['model']
        calls[name] = calls.get(name, 0) + 1
        if name == 'busy' and calls[name] == 1:
            return httpx.Response(429, json={'error': {'code': 'system_busy', 'message': 'Heavy traffic'}}, headers={'x-request-id': 'rejected-request'})
        return httpx.Response(200, json={'id': name, 'model': name,
            'choices': [{'message': {'content': 'Hello'}, 'finish_reason': 'stop'}],
            'usage': {'prompt_tokens': 1, 'completion_tokens': 1, 'total_tokens': 2, 'cost': 0.000001}})
    upstream(monkeypatch, respond)
    a, b = envelope()['items']
    a['request']['model'], b['request']['model'] = 'busy', 'ready'
    response = await proxy.post('/v1/operations', json={'version': 1, 'items': [a, b]})
    events = [json.loads(line) for line in response.text.splitlines()]
    results = {e['response']['model']: e['response'] for e in events if e.get('type') == 'result'}
    assert calls == {'busy': 2, 'ready': 1}
    assert len(results['busy']['automatic_retries']) == 1
    assert 'automatic_retries' not in results['ready']
    reservations = [v for k, v in ledger.store.items() if '/reservations/' in k]
    assert len(reservations) == 3
    assert sorted(r['status'] for r in reservations) == ['settled', 'settled', 'unknown']
