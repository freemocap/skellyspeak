import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from google.cloud import firestore
from starlette.websockets import WebSocketDisconnect
from server.app import main
from server.app.identity import admin_auth, auth
from server.app.accounting import budget
from server.app.diagnostics import admin_events
from server.app.diagnostics.admin_routes import build_router
from server.development.memory_store import Database, transactional


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(firestore, 'transactional', transactional)
    db = Database()
    db.collection('users').document('google:owner').set({'email': admin_auth.OWNER, 'token_version': 0})
    app = FastAPI()
    app.include_router(build_router(lambda: db, lambda: main.CFG, lambda: None))
    cookie = admin_auth.finish(auth.GoogleIdentity('owner', admin_auth.OWNER, True, 'Owner', ''), main.CFG, db).headers['set-cookie'].split(';', 1)[0]
    return db, TestClient(app, base_url='https://test.invalid'), {'cookie': cookie, 'origin': main.CFG.public_base_url}


def test_stream_pushes_committed_usage_without_refresh_requests(live):
    db, client, headers = live
    baseline = len(admin_events._subscribers)
    with client.websocket_connect('/admin/live', headers=headers) as socket:
        socket.send_json({'span': '1h', 'interval': '1m'})
        first = socket.receive_json()
        assert first['type'] == 'snapshot'
        reservation = budget.reserve(db, user_id='google:owner', micros=100, user_limit=1000, global_limit=1000)
        update = socket.receive_json()
        assert sum(p['micros'] for p in update['timeline']['points']) == 100
        budget.settle(db, reservation=reservation, actual_micros=25, tokens=2, status='settled', provider_id='test')
        update = socket.receive_json()
        assert sum(p['micros'] for p in update['timeline']['points']) == 25
        assert 'server instance' in update['logs']['scope']
    assert len(admin_events._subscribers) == baseline


def test_stream_rejects_missing_auth_cross_origin_and_mutations(live):
    _, client, headers = live
    for invalid in ({'origin': headers['origin']}, headers | {'origin': 'https://evil.invalid'}):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect('/admin/live', headers=invalid):
                pass
    with client.websocket_connect('/admin/live', headers=headers) as socket:
        socket.send_json({'action': 'reset_allowance'})
        assert socket.receive_json()['type'] == 'error'
        with pytest.raises(WebSocketDisconnect):
            socket.receive_json()


def test_stream_revocation_closes_existing_connection(live):
    db, client, headers = live
    with client.websocket_connect('/admin/live', headers=headers) as socket:
        socket.send_json({})
        assert socket.receive_json()['type'] == 'snapshot'
        db.collection('users').document('google:owner').set({'token_version': 1}, merge=True)
        admin_events.notify()
        assert socket.receive_json()['type'] == 'error'
        with pytest.raises(WebSocketDisconnect):
            socket.receive_json()


def test_local_stream_uses_local_cookie_and_checks_loopback_origin(tmp_path):
    from server.development.admin import LocalAdmin, ORIGIN
    from server.development.logs import LocalLogs
    db = Database()
    logs = LocalLogs(tmp_path / 'logs')
    local = LocalAdmin(tmp_path, logs)
    app = FastAPI()
    app.include_router(build_router(lambda: db, lambda: main.CFG, lambda: None))
    local.install(app)
    with TestClient(app, base_url=ORIGIN, client=('127.0.0.1', 5555)) as client:
        ticket = client.post('/admin/local/ticket', headers={'authorization': 'Bearer ' + local.launch}).json()['ticket']
        assert client.post('/admin/local/login', content=ticket, headers={'origin': ORIGIN, 'x-admin-action': '1'}).status_code == 204
        with client.websocket_connect('ws://127.0.0.1:8765/admin/live', headers={'origin': ORIGIN}) as socket:
            socket.send_json({})
            assert socket.receive_json()['overview']['administrator'] == 'local-administrator'
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect('ws://127.0.0.1:8765/admin/live', headers={'origin': 'http://evil.invalid'}):
                pass
    logs.close()
