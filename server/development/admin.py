"""Loopback-only administration capability. Never included in the hosted image."""
import secrets
import threading
import time
from datetime import datetime, timezone, timedelta

import jwt
from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from server.app.diagnostics.admin_routes import HEADERS
from server.app.diagnostics.admin_logs import entry
from server.development.private_files import write_private

COOKIE = 'skelly-local-admin'
ORIGIN = 'http://127.0.0.1:8765'


class LocalAdmin:
    def __init__(self, directory, logs):
        self.key = secrets.token_urlsafe(48)
        self.launch = jwt.encode({'nonce': secrets.token_urlsafe(32)}, self.key, algorithm='HS256')
        write_private(directory / 'admin-token.txt', self.launch + '\n')
        self.logs = logs
        self.tickets = {}
        self.lock = threading.Lock()

    def boundary(self, request):
        if request.client.host not in {'127.0.0.1', '::1'} or request.headers.get('host') != '127.0.0.1:8765':
            raise HTTPException(403, 'Local administration requires loopback access.')
        if request.method != 'GET' and (request.headers.get('origin') != ORIGIN or request.headers.get('x-admin-action') != '1'):
            raise HTTPException(403, 'Invalid local administration origin.')

    def require(self, request):
        self.boundary(request)
        try:
            jwt.decode(request.cookies.get(COOKIE, ''), self.key, algorithms=['HS256'], audience='local-admin', options={'require': ['exp', 'aud']})
        except jwt.PyJWTError:
            raise HTTPException(401, 'Open local admin from the desktop app’s AI access settings.') from None
        return 'local-administrator'

    def sign_in(self):
        return HTMLResponse('<!doctype html><title>Local administration</title><h1>Local server administration</h1><p>In the desktop development app, open Settings → AI access → Custom URL → Open local admin.</p>', headers=HEADERS)

    def install(self, app):
        app.state.development_admin = self

        @app.post('/admin/local/ticket')
        def ticket(request: Request):
            if request.client.host != '127.0.0.1' or request.headers.get('host') != '127.0.0.1:8765' or request.headers.get('origin') or not secrets.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + self.launch):
                raise HTTPException(403, 'Invalid local launch credential.')
            with self.lock:
                self.tickets = {key: expiry for key, expiry in self.tickets.items() if expiry > time.time()}
                if len(self.tickets) >= 8:
                    raise HTTPException(429, 'Too many pending admin launches.')
                value = secrets.token_urlsafe(32)
                self.tickets[value] = time.time() + 60
            return JSONResponse({'ticket': value}, headers=HEADERS)

        @app.get('/admin/local/login')
        def bridge(request: Request):
            self.boundary(request)
            return HTMLResponse('<!doctype html><title>Local administration</title><p id="status">Opening local administration…</p><script src="/admin/local/bridge.js"></script>', headers=HEADERS)

        @app.get('/admin/local/bridge.js')
        def script():
            return Response("const ticket=location.hash.slice(1);history.replaceState(null,'','/admin/local/login');fetch('/admin/local/login',{method:'POST',headers:{'Content-Type':'text/plain','X-Admin-Action':'1'},body:ticket}).then(r=>{if(!r.ok)throw Error();location.replace('/admin')}).catch(()=>{document.getElementById('status').textContent='Link expired. Open local admin again from the app.'});", media_type='text/javascript', headers=HEADERS)

        @app.post('/admin/local/login')
        async def exchange(request: Request):
            self.boundary(request)
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 43:
                    raise HTTPException(400, 'Invalid launch ticket.')
            value = body.decode('ascii', errors='replace')
            with self.lock:
                expiry = self.tickets.pop(value, 0)
            if expiry <= time.time():
                raise HTTPException(401, 'Launch ticket expired or already used.')
            response = Response(status_code=204, headers=HEADERS)
            response.set_cookie(COOKIE, jwt.encode({'aud': 'local-admin', 'exp': int(time.time()) + 3600}, self.key, algorithm='HS256'), max_age=3600, httponly=True, samesite='strict', path='/admin')
            return response

    def read_logs(self, *, hours, errors, request_id, page_token, since):
        now = datetime.now(timezone.utc)
        try:
            start = datetime.fromisoformat(since) if since else now - timedelta(hours=hours)
            if start.tzinfo is None or not now - timedelta(hours=169) <= start <= now:
                raise ValueError()
            before = int(page_token) if page_token else 2**63
            if before < 0:
                raise ValueError()
        except ValueError:
            raise HTTPException(422, 'Invalid local log cursor or window.') from None
        with self.logs.lock:
            rows = list(self.logs.recent)
        selected = []
        for sequence, stamp, event in reversed(rows):
            if sequence >= before or stamp < start.timestamp():
                continue
            payload = dict(event)
            payload['event'] = payload.get('event', payload.get('code'))
            payload['request_id'] = payload.get('request_id', payload.get('requestId'))
            if request_id and payload['request_id'] != request_id:
                continue
            if errors and not (payload.get('status', 0) >= 400 or payload.get('level') in {'ERROR', 'CRITICAL'} or str(payload['event']).endswith('failed') or payload['event'] == 'provider_error_response'):
                continue
            selected.append((sequence, entry({'timestamp': datetime.fromtimestamp(stamp, timezone.utc).isoformat(), 'jsonPayload': payload})))
            if len(selected) == 501:
                break
        return {'entries': [row for _, row in selected[:500]], 'next_page_token': str(selected[499][0]) if len(selected) > 500 else '', 'since': start.isoformat(), 'scope': 'Local server current run; newest 10,000 sanitized events retained in memory. Older events remain in local log files.'}
