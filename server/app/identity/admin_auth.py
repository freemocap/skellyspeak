"""Owner-only browser sessions; Google identity is verified by the existing callback."""
from __future__ import annotations
import secrets
import re
import time
import jwt
from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from google.cloud import firestore
from server.app.identity import auth
from server.app.accounting import quota

OWNER = 'info@freemocap.org'
COOKIE = '__Host-skelly-admin'
FLOW_COOKIE = '__Host-skelly-admin-flow'
AUDIENCE = 'skellyspeak-admin'
TTL = 3600


def start(db, cfg):
    state = auth.issue_code(purpose='admin-state', signing_key=cfg.jwt_signing_key)
    nonce = secrets.token_urlsafe(32)
    db.collection(quota.AUTH_STATES).document(state).set({
        'admin_flow': True, 'browser_challenge': auth.s256_challenge(nonce),
        'expires_at': int(time.time()) + auth.AUTH_STATE_TTL_SECONDS,
        'ttl': quota.ttl_after(1),
    })
    response = RedirectResponse(auth.google_authorize_url(client_id=cfg.google_client_id,
        redirect_uri=cfg.google_redirect_uri, state=state))
    response.set_cookie(FLOW_COOKIE, nonce, secure=True, httponly=True, samesite='lax',
                        max_age=auth.AUTH_STATE_TTL_SECONDS, path='/')
    return response


def validate_flow(stored, request):
    nonce = request.cookies.get(FLOW_COOKIE, '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', nonce) or not secrets.compare_digest(auth.s256_challenge(nonce), stored.get('browser_challenge', '')):
        raise auth.AuthError('Admin sign-in must finish in the browser that started it.')


def finish(identity, cfg, db):
    if identity.email.lower() != OWNER or identity.email_verified is not True:
        raise HTTPException(403, 'This account cannot access server administration.')
    profile = db.collection(quota.USERS).document(identity.user_id).get().to_dict() or {}
    now = int(time.time())
    token = jwt.encode({'sub': identity.user_id, 'email': OWNER, 'tv': int(profile.get('token_version', 0)),
                        'iss': 'skellyspeak-api', 'aud': AUDIENCE, 'iat': now, 'exp': now + TTL},
                       cfg.jwt_signing_key, algorithm='HS256')
    # Commit a same-site document before opening the panel. An HTTP redirect
    # keeps Google's cross-site navigation chain, which excludes Strict cookies.
    response = HTMLResponse(
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width">'
        '<meta http-equiv="refresh" content="0;url=/admin">'
        '<title>Opening server administration</title>'
        '<p>Signed in. <a href="/admin">Continue to server administration</a>.</p></html>',
        headers={'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
                 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
                 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"},
    )
    response.set_cookie(COOKIE, token, secure=True, httponly=True, samesite='strict', max_age=TTL, path='/')
    response.delete_cookie(FLOW_COOKIE, secure=True, httponly=True, samesite='lax', path='/')
    return response


def claims_for(request: Request, cfg):
    token = request.cookies.get(COOKIE, '')
    if not token or len(token) > 4096:
        raise HTTPException(401, 'Sign in to server administration.')
    try:
        claims = jwt.decode(token, cfg.jwt_signing_key, algorithms=['HS256'],
            issuer='skellyspeak-api', audience=AUDIENCE,
            options={'require': ['sub', 'email', 'tv', 'iat', 'exp', 'aud', 'iss']})
    except jwt.InvalidTokenError:
        raise HTTPException(401, 'Admin session expired or invalid. Sign in again.') from None
    subject = claims['sub']
    if claims['email'] != OWNER or not isinstance(subject, str) or not subject.startswith('google:') or '/' in subject or len(subject) > 128:
        raise HTTPException(403, 'This account cannot access server administration.')
    return claims


def require(request: Request, cfg, db):
    claims = claims_for(request, cfg)
    subject = claims['sub']
    profile = db.collection(quota.USERS).document(subject).get().to_dict() or {}
    if type(claims['tv']) is not int or claims['tv'] != int(profile.get('token_version', 0)):
        raise HTTPException(401, 'Admin session was revoked. Sign in again.')
    if request.method not in {'GET', 'HEAD'}:
        if request.headers.get('origin') != cfg.public_base_url.rstrip('/') or request.headers.get('x-admin-action') != '1':
            raise HTTPException(403, 'Administrative changes require the same-origin panel.')
    return subject
