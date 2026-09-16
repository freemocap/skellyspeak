import io
import json
import logging

import httpx
import pytest

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
