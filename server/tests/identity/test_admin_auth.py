"""Owner identity, browser binding, audience isolation, CSRF and revocation."""
import time
from urllib.parse import urlparse, parse_qs
import httpx
import jwt
import pytest
from fastapi import HTTPException, Request
from server.app.identity import auth, admin_auth
from server.app import main
from server.tests.accounting.test_budget import ledger


def identity(email='info@freemocap.org', verified=True):
    return auth.GoogleIdentity('owner', email, verified, 'Owner', '')


def request(token='', method='GET', origin=None):
    headers = [(b'cookie', f'{admin_auth.COOKIE}={token}'.encode())]
    if origin:
        headers += [(b'origin', origin.encode()), (b'x-admin-action', b'1')]
    return Request({'type': 'http', 'method': method, 'path': '/admin', 'headers': headers})


def token(db):
    response = admin_auth.finish(identity(), main.CFG, db)
    return response.headers['set-cookie'].split(';', 1)[0].split('=', 1)[1]


def test_only_verified_exact_owner_can_finish(ledger):
    for email, verified in [('other@example.invalid', True), ('info@freemocap.org.attacker.invalid', True), ('info@freemocap.org', False)]:
        with pytest.raises(HTTPException) as error:
            admin_auth.finish(identity(email, verified), main.CFG, ledger)
        assert error.value.status_code == 403
    response = admin_auth.finish(identity(), main.CFG, ledger)
    assert 'HttpOnly' in response.headers['set-cookie'] and 'Secure' in response.headers['set-cookie']
    assert response.headers['location'] == '/admin'


def test_app_tokens_cannot_be_used_as_admin_and_vice_versa(ledger):
    app_token = auth.issue_session_token(user_id='google:owner', signing_key=main.CFG.jwt_signing_key)
    with pytest.raises(HTTPException):
        admin_auth.require(request(app_token), main.CFG, ledger)
    with pytest.raises(auth.AuthError):
        auth.read_session_token(token(ledger), signing_key=main.CFG.jwt_signing_key)


def test_expiry_csrf_and_remote_revocation(ledger):
    session = token(ledger)
    assert admin_auth.require(request(session), main.CFG, ledger) == 'google:owner'
    for origin in [None, 'https://attacker.invalid']:
        with pytest.raises(HTTPException) as error:
            admin_auth.require(request(session, 'POST', origin), main.CFG, ledger)
        assert error.value.status_code == 403
    assert admin_auth.require(request(session, 'POST', main.CFG.public_base_url), main.CFG, ledger)
    ledger.store['users/google:owner'] = {'token_version': 1}
    with pytest.raises(HTTPException):
        admin_auth.require(request(session), main.CFG, ledger)
    claims = jwt.decode(session, main.CFG.jwt_signing_key, algorithms=['HS256'], audience=admin_auth.AUDIENCE)
    expired = jwt.encode({**claims, 'exp': int(time.time()) - 1}, main.CFG.jwt_signing_key, algorithm='HS256')
    with pytest.raises(HTTPException):
        admin_auth.require(request(expired), main.CFG, ledger)


def test_oauth_state_bound_to_starting_browser(ledger):
    response = admin_auth.start(ledger, main.CFG)
    state = parse_qs(urlparse(response.headers['location']).query)['state'][0]
    stored = ledger.store[f'auth_states/{state}']
    with pytest.raises(auth.AuthError):
        admin_auth.validate_flow(stored, request())
    cookie = response.headers['set-cookie'].split(';', 1)[0]
    bound = Request({'type': 'http', 'headers': [(b'cookie', cookie.encode())]})
    admin_auth.validate_flow(stored, bound)


@pytest.mark.asyncio
async def test_admin_api_denies_before_database_access(monkeypatch):
    class Forbidden:
        def collection(self, *args):
            raise AssertionError('unauthenticated database access')
    monkeypatch.setattr(main, 'db', Forbidden())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='https://test.invalid') as client:
        for path in ['/admin/api/overview', '/admin/api/logs', '/admin/api/audit', '/admin/api/users/google:owner']:
            assert (await client.get(path)).status_code == 401
        assert (await client.post('/admin/api/change', json={})).status_code == 401
        assert 'Sign in with Google' in (await client.get('/admin')).text
