"""Local capability authentication and actual local reporting, without Google or GCP."""
import time
from uuid import uuid4
import httpx
import pytest
from fastapi import FastAPI
from google.cloud import firestore
from server.app import main
from server.app.diagnostics.admin_routes import build_router
from server.development.admin import LocalAdmin, ORIGIN
from server.development.logs import LocalLogs
from server.development import memory_store


@pytest.mark.asyncio
async def test_local_access_reports_mutates_and_logs(tmp_path, monkeypatch):
    monkeypatch.setattr(firestore, 'transactional', memory_store.transactional)
    db = memory_store.Database()
    db.collection('users').document('local-learner').set({'email': 'local@example.invalid'})
    logs = LocalLogs(tmp_path / 'logs')
    admin = LocalAdmin(tmp_path, logs)
    app = FastAPI()
    app.include_router(build_router(lambda: db, lambda: main.CFG, lambda: None))
    admin.install(app)
    headers = {'origin': ORIGIN, 'x-admin-action': '1'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=ORIGIN) as client:
        assert (await client.get('/admin/api/overview')).status_code == 401
        assert 'desktop' in (await client.get('/admin')).text
        assert (await client.post('/admin/local/ticket')).status_code == 403
        auth = {'authorization': 'Bearer ' + admin.launch}
        assert (await client.post('/admin/local/ticket', headers=auth | {'origin': ORIGIN})).status_code == 403
        ticket = (await client.post('/admin/local/ticket', headers=auth)).json()['ticket']
        assert (await client.post('/admin/local/login', content=ticket)).status_code == 403
        response = await client.post('/admin/local/login', content=ticket, headers=headers)
        assert response.status_code == 204 and 'HttpOnly' in response.headers['set-cookie']
        assert (await client.post('/admin/local/login', content=ticket, headers=headers)).status_code == 401
        overview = (await client.get('/admin/api/overview')).json()
        assert overview['administrator'] == 'local-administrator'
        assert overview['account_count'] == 1 and overview['environment'].startswith('Local')
        command = {'operation_id': str(uuid4()), 'expected_revision': 0, 'action': 'policy', 'target': 'service', 'values': {'diagnostics_requests': 123}}
        assert (await client.post('/admin/api/change', json=command)).status_code == 403
        result = await client.post('/admin/api/change', json=command, headers=headers)
        assert result.status_code == 200, result.text
        assert (await client.get('/admin/api/overview')).json()['policy']['diagnostics_requests'] == 123
        logs.append('logging', {'code': 'request_headers', 'status': 429, 'requestId': 'a'*32, 'route': '/v1/me'})
        report = (await client.get('/admin/api/logs?errors=true')).json()
        assert report['entries'][0]['request_id'] == 'a'*32
        assert report['entries'][0]['status'] == 429
        assert (await client.get('/admin/api/overview', headers={'host': 'evil.example'})).status_code == 403
        assert (await client.post('/admin/logout', headers=headers)).status_code == 204
        assert (await client.get('/admin/api/overview')).status_code == 401
        admin.tickets['expired'] = time.time() - 1
        assert (await client.post('/admin/local/login', content='expired', headers=headers)).status_code == 401
    logs.close()


def test_local_logs_page_without_console_duplicates(tmp_path):
    logs = LocalLogs(tmp_path / 'logs')
    admin = LocalAdmin(tmp_path, logs)
    for index in range(510):
        record = {'code': 'request_headers', 'status': 200, 'requestId': f'{index:032x}'}
        logs.append('logging', record)
        logs.append('stdout', record)
    first = admin.read_logs(hours=1, errors=False, request_id='', page_token='', since='')
    assert len(first['entries']) == 500
    second = admin.read_logs(hours=1, errors=False, request_id='', page_token=first['next_page_token'], since=first['since'])
    assert len(second['entries']) == 10
    assert not {e['request_id'] for e in first['entries']} & {e['request_id'] for e in second['entries']}
    logs.close()
