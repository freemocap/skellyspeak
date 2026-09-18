import io
import json
import logging

import httpx
import pytest

from server.tests.inference.test_proxy import proxy
from server.tests.accounting.test_budget import ledger
from server.app import main
from server.app.diagnostics import provider_errors
from server.development.logs import FileHandler, LocalLogs


@pytest.mark.asyncio
async def test_provider_refusal_body_reaches_terminal_and_disk_without_secrets(tmp_path):
    logs = LocalLogs(tmp_path.resolve() / 'run')
    terminal = io.StringIO()
    handler = FileHandler(logs, terminal)
    logger = logging.getLogger('skellyspeak.runtime')
    old = logger.level
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    async def respond(request):
        return httpx.Response(403, json={'error': {
            'message': 'Access to this model is blocked. Echo: private user prompt. Contact person@example.com. Bearer gsk_secret.',
            'code': 'model_permission_blocked', 'type': 'permission_error',
            'user_id': 'private-account', 'request': {'content': 'private prompt'},
        }})
    try:
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with pytest.raises(main.UpstreamHTTPError) as error:
                await main.provider_json(client, 'https://fixture.invalid', limit=1000,
                                         provider='GROQ', json={'prompt': 'private user prompt', 'language': 'es'})
        assert error.value.code == 'GROQ_HTTP_403'
        rows = [json.loads(line)['event'] for line in (logs.directory / 'server-logging.jsonl').read_text().splitlines()]
        event = next(row for row in rows if row['code'] == 'provider_error_response')
        assert event['response_body']['error']['code'] == 'model_permission_blocked'
        assert 'Access to this model is blocked.' in event['response_body']['error']['message']
        assert json.dumps(event, sort_keys=True) in terminal.getvalue()
        for secret in ['private user prompt', 'person@example.com', 'gsk_secret', 'private-account', 'private prompt']:
            assert secret not in terminal.getvalue()
            assert secret not in json.dumps(rows)
    finally:
        logger.removeHandler(handler)
        logger.setLevel(old)
        logs.close()


@pytest.mark.asyncio
@pytest.mark.parametrize('body', [b'x' * (provider_errors.LIMIT + 1), b'Access denied for "private name" from 192.168.1.2'])
async def test_non_json_and_oversized_body(caplog, body):
    caplog.set_level(logging.INFO, logger='skellyspeak.runtime')
    response = httpx.Response(403, content=body)
    await provider_errors.capture(response, 'GROQ')
    event = json.loads(caplog.records[-1].message)
    assert event['body_truncated'] == (len(body) > provider_errors.LIMIT)
    assert 'private name' not in caplog.text and '192.168.1.2' not in caplog.text
    assert len(caplog.text) < provider_errors.LIMIT


@pytest.mark.asyncio
async def test_broken_error_body_does_not_replace_http_refusal(caplog):
    caplog.set_level(logging.INFO, logger='skellyspeak.runtime')
    class Broken(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"error":"private partial'
            raise httpx.ReadError('private network detail')
    async def respond(request):
        return httpx.Response(403, stream=Broken())
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(main.UpstreamHTTPError) as error:
            await main.provider_json(client, 'https://fixture.invalid', limit=1000, provider='GROQ')
    assert error.value.code == 'GROQ_HTTP_403'
    assert 'private' not in caplog.text
    event = next(json.loads(r.message) for r in caplog.records if 'provider_error_response' in r.message)
    assert event['body_unreadable']


def test_metadata_retention_keeps_public_identifiers_and_marks_unclassified_values():
    value = provider_errors.sanitize({
        'id': 'provider-request', 'model': 'vendor/model',
        'usage': {'prompt_tokens': 12, 'cached_tokens': 5},
        'extra': {'latency_ms': 42, 'unknown_text': 'private unknown content'},
        'error': {'code': 'missing_permissions', 'message': 'Missing permission "text_to_speech" for model "eleven_v3". private learner sentence real-api-secret'},
        'audio': 'private bytes', 'api_key': 'real-api-secret',
    }, ('private learner sentence', 'real-api-secret'))
    assert value['id'] == 'provider-request'
    assert value['usage']['cached_tokens'] == 5
    assert value['extra']['latency_ms'] == 42
    assert 'text_to_speech' in value['error']['message']
    assert 'eleven_v3' in value['error']['message']
    assert 'unclassified' in value['extra']['unknown_text']
    for private in ('private learner sentence', 'real-api-secret', 'private bytes', 'private unknown content'):
        assert private not in json.dumps(value)


@pytest.mark.asyncio
async def test_grouped_error_carries_redacted_reason_and_request_correlation(monkeypatch, proxy, ledger):
    from server.tests.inference.test_proxy import upstream
    from server.tests.inference.test_grouped import envelope
    upstream(monkeypatch, lambda _: httpx.Response(403, json={'error': {
        'code': 'missing_permissions', 'message': 'Missing permission "text_to_speech".',
        'content': 'private response content',
    }}, headers={'request-id': 'provider-receipt', 'x-ratelimit-remaining': '3'}))
    response = await proxy.post('/v1/operations', json=envelope(1))
    event = json.loads(response.text.splitlines()[0])
    assert event['diagnostics']['error']['code'] == 'missing_permissions'
    assert event['diagnostics']['http']['response_headers']['request_id'] == 'provider-receipt'
    assert event['request_id'] == response.headers['x-request-id']
    assert 'private response content' not in response.text


def test_exception_locations_survive_without_messages_or_locals():
    from server.app.diagnostics.exceptions import describe
    try:
        try:
            raise ValueError('private learner text and credential')
        except ValueError as cause:
            raise RuntimeError('private wrapper') from cause
    except RuntimeError as error:
        details = provider_errors.sanitize(describe(error))
    assert [cause['exception_type'] for cause in details['causes']] == ['RuntimeError', 'ValueError']
    assert details['causes'][0]['frames'][0]['source_file'] == 'test_provider_errors.py'
    assert 'private' not in json.dumps(details)


def test_typed_request_uuid_is_preserved_but_known_credential_is_not():
    identity = '85a3e4c6-9fd1-4dac-8b30-abcde1234567'
    assert provider_errors.sanitize({'request_id': identity})['request_id'] == identity
    assert 'redacted' in provider_errors.sanitize({'request_id': identity}, (identity,))['request_id']
