"""Owner browser routes, separate from learner quotas and public API contracts."""
from pathlib import Path
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from server.app.identity import admin_auth
from server.app.accounting import admin_controls
from server.app.admission.admission import Ingress
from server.app.diagnostics import admin_reports, admin_logs

ASSETS = Path(__file__).parent / 'admin_assets'
HEADERS = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
           'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
           'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}


class Change(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    operation_id: str = Field(max_length=36)
    expected_revision: int = Field(ge=0)
    action: str = Field(max_length=32)
    target: str = Field(max_length=128)
    values: dict


def build_router(database, configuration, throttle_signin):
    router = APIRouter()
    reads, writes = Ingress(120), Ingress(20)

    def owner(request: Request):
        local = getattr(request.app.state, "development_admin", None)
        actor = local.require(request) if local else admin_auth.require(request, configuration(), database())
        (reads if request.method == 'GET' else writes).take()
        return actor

    @router.get('/admin/login')
    def login(request: Request):
        local = getattr(request.app.state, "development_admin", None)
        if local:
            return local.sign_in()
        throttle_signin()
        return admin_auth.start(database(), configuration())

    @router.get('/admin')
    def panel(request: Request):
        try:
            owner(request)
        except HTTPException as error:
            if error.status_code != 401:
                raise
            local = getattr(request.app.state, 'development_admin', None)
            if local:
                return local.sign_in()
            return HTMLResponse('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SkellySpeak administration</title><link rel="stylesheet" href="/admin/assets/admin.css"><body id="admin-console"><main><h1>Server administration</h1><p>Access is restricted to info@freemocap.org.</p><a href="/admin/login">Sign in with Google</a></main></html>', headers=HEADERS)
        return FileResponse(ASSETS / 'index.html', headers=HEADERS)

    @router.get('/admin/assets/{name}')
    def asset(name: str):
        if name not in {'admin.js', 'admin.css'}:
            raise HTTPException(404, 'Asset not found.')
        return FileResponse(ASSETS / name, headers=HEADERS)

    @router.post('/admin/logout')
    def logout(request: Request, actor=Depends(owner)):
        response = Response(status_code=204, headers=HEADERS)
        response.delete_cookie('skelly-local-admin', path='/admin')
        response.delete_cookie(admin_auth.COOKIE, secure=True, httponly=True, samesite='strict', path='/')
        return response

    @router.get('/admin/api/overview')
    def overview(request: Request, days: int = 30, after: str = '', actor=Depends(owner)):
        if not 1 <= days <= 90 or len(after) > 128 or '/' in after:
            raise HTTPException(422, 'Invalid report window or cursor.')
        report = admin_reports.overview(database(), configuration(), days=days, after=after)
        report['environment'] = 'Local development · data clears on restart' if getattr(request.app.state, 'development_admin', None) else 'Hosted service'
        report['administrator'] = actor
        return report

    @router.get('/admin/api/users/{user_id}')
    def user(user_id: str, days: int = 30, actor=Depends(owner)):
        if not 1 <= days <= 90 or len(user_id) > 128:
            raise HTTPException(422, 'Invalid report window or account.')
        return admin_reports.user_detail(database(), configuration(), user_id, days)

    @router.get('/admin/api/audit')
    def audit(actor=Depends(owner)):
        return admin_reports.audit(database())

    @router.get('/admin/api/logs')
    async def logs(request: Request, hours: int = 24, errors: bool = False, request_id: str = '', page_token: str = '', since: str = '', actor=Depends(owner)):
        if len(since) > 40 or not 1 <= hours <= 168 or len(page_token) > 4096 or (request_id and not re.fullmatch('[a-f0-9]{32}', request_id)):
            raise HTTPException(422, 'Invalid log filter.')
        local = getattr(request.app.state, 'development_admin', None)
        if local:
            return local.read_logs(hours=hours, errors=errors, request_id=request_id, page_token=page_token, since=since)
        return await admin_logs.read(hours=hours, errors=errors, request_id=request_id, page_token=page_token, since=since)

    @router.post('/admin/api/change')
    async def change(request: Request, actor=Depends(owner)):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 8192:
                raise HTTPException(413, 'Administrative change exceeds 8 KiB.')
        try:
            command = Change.model_validate_json(body)
        except ValueError:
            raise HTTPException(422, 'Invalid administrative change.') from None
        import asyncio
        return await asyncio.to_thread(admin_controls.change, database(), actor=actor, **command.model_dump())

    return router
