import json

import httpx
import pytest

from server.app.diagnostics import provider_health
from server.tests.inference.test_proxy import proxy
from server.tests.accounting.test_budget import ledger


@pytest.mark.asyncio
async def test_probe_retains_transport_explanation_and_os_cause_without_credentials():
    def respond(request):
        try:
            raise ConnectionRefusedError(111, 'Connection refused')
        except ConnectionRefusedError as cause:
            raise httpx.ConnectError('Connection failed at https://private.invalid/path with key private-key', request=request) from cause
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await provider_health.probe(client, 'GROQ', 'https://private.invalid', 'private-key')
    assert result['state'] == 'unreachable'
    details = result['diagnostics']
    assert details['causes'][0]['exception_type'] == 'ConnectError'
    assert 'Connection failed' in details['causes'][0]['message']
    assert details['causes'][1]['errno'] == 111
    assert 'Connection refused' in details['causes'][1]['message']
    saved = json.dumps(result)
    assert 'private-key' not in saved and 'private.invalid' not in saved
    persisted = provider_health.runtime.sanitize({'event': 'provider_credential_checked', 'diagnostics': details})
    assert 'Connection refused' in json.dumps(persisted)
    assert 'private-key' not in json.dumps(persisted)


@pytest.mark.asyncio
async def test_probe_retains_json_failure_location_without_rejected_content():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=b'{\nprivate-content'))) as client:
        result = await provider_health.probe(client, 'GROQ', 'https://private.invalid', 'private-key')
    assert result['state'] == 'invalid_response'
    assert result['diagnostics']['line'] == 2
    assert result['diagnostics']['column'] == 1
    assert 'private-content' not in json.dumps(result)


@pytest.mark.asyncio
async def test_elevenlabs_probe_uses_key_header_and_array_model_catalog():
    def respond(request):
        assert request.url.path == '/v1/models'
        assert request.headers['xi-api-key'] == 'test-elevenlabs-key'
        assert 'authorization' not in request.headers
        return httpx.Response(200, json=[{'model_id': 'eleven_v3'}])
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await provider_health.probe(client, 'ELEVENLABS', 'https://api.elevenlabs.io/v1', 'test-elevenlabs-key')
    assert result['state'] == 'accepted'


@pytest.mark.asyncio
async def test_credential_probes_use_own_keys_and_do_not_infer(caplog):
    seen = []
    def respond(request):
        seen.append(request)
        if request.url.host == 'openrouter.invalid':
            assert request.headers['authorization'] == 'Bearer private-chat-key'
            assert request.url.path == '/v1/key'
            return httpx.Response(200, json={'data': {'label': 'private account'}})
        assert request.headers['authorization'] == 'Bearer private-audio-key'
        assert request.url.path == '/v1/models'
        return httpx.Response(403, json={'error': {'message': 'Access denied'}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        chat = await provider_health.probe(client, 'OPENROUTER', 'https://openrouter.invalid/v1', 'private-chat-key')
        audio = await provider_health.probe(client, 'GROQ', 'https://groq.invalid/v1', 'private-audio-key')
    assert chat['state'] == 'accepted'
    assert audio['state'] == 'rejected' and audio['status'] == 403
    assert all(request.method == 'GET' and not request.content for request in seen)
    assert 'private' not in json.dumps([chat, audio]) + caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize('mode,expected', [('timeout', 'unreachable'), ('malformed', 'invalid_response'), ('large', 'invalid_response'), ('redirect', 'rejected')])
async def test_bad_probes_never_report_accepted(mode, expected):
    def respond(request):
        if mode == 'timeout':
            raise httpx.ReadTimeout('private details')
        if mode == 'redirect':
            return httpx.Response(302, headers={'location': 'https://unrelated.invalid'})
        return httpx.Response(200, content=b'x' * (262145 if mode == 'large' else 3))
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await provider_health.probe(client, 'GROQ', 'https://groq.invalid', 'private-key')
    assert result['state'] == expected


@pytest.mark.asyncio
async def test_protocol_probes_only_when_requested_by_authenticated_client(proxy, monkeypatch):
    import server.app.main as main
    calls = []
    async def check(config):
        calls.append(True)
        return [{'provider': 'GROQ', 'state': 'rejected', 'status': 403, 'durationMs': 1}]
    monkeypatch.setattr(main.provider_health, 'check', check)
    ordinary = await proxy.get('/v1/protocol')
    assert ordinary.status_code == 200 and not calls
    checked = await proxy.get('/v1/protocol?verify_providers=true')
    assert checked.status_code == 200 and checked.json()['providers'][0]['status'] == 403
    assert calls == [True]


@pytest.mark.asyncio
async def test_unauthenticated_requests_cannot_probe_provider_keys(monkeypatch):
    import server.app.main as main
    async def forbidden(config):
        raise AssertionError('unauthenticated provider probe')
    monkeypatch.setattr(main.provider_health, 'check', forbidden)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='http://test') as client:
        response = await client.get('/v1/protocol?verify_providers=true')
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(('stt', 'elevenlabs', 'expected'), [
    ('groq', '', ['OPENROUTER', 'GROQ']),
    ('groq', 'test-key', ['OPENROUTER', 'GROQ', 'ELEVENLABS']),
    ('elevenlabs', 'test-key', ['OPENROUTER', 'ELEVENLABS']),
])
async def test_checks_every_required_provider(stt, elevenlabs, expected, monkeypatch):
    from types import SimpleNamespace
    calls = []
    async def probe(client, provider, base_url, key):
        calls.append(provider)
        return {'provider': provider, 'state': 'accepted', 'status': 200, 'durationMs': 1}
    monkeypatch.setattr(provider_health, 'probe', probe)
    config = SimpleNamespace(stt_provider=stt, elevenlabs_key=elevenlabs,
                             openrouter_key='chat', openrouter_base_url='https://chat.invalid',
                             groq_key='transcription', groq_base_url='https://stt.invalid')
    result = await provider_health.check(config)
    assert calls == expected
    assert [item['provider'] for item in result] == expected
