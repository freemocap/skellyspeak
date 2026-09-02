"""SkellySpeak API — sign-in, quota, and an authenticated passthrough to
OpenRouter so people can use the app without supplying their own API key.

The app can talk to three things, chosen in its settings: OpenRouter with the
user's own key, a server the user runs themselves, or this. This one exists so
that installing the app is enough to start using it.

Design rules, matching the app:
  * No silent fallbacks. If something cannot be done, the caller is told why.
  * Every failure carries a message intended for a person to read, because the
    app puts it on screen.
"""

from __future__ import annotations

import json
import logging
import time

import httpx
import jwt as pyjwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.cloud import firestore

import auth
import config
import quota

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("skellyspeak-api")

CFG = config.load()
app = FastAPI(title="SkellySpeak API")
db = firestore.Client()
bearer = HTTPBearer(auto_error=False)
_google_jwks = pyjwt.PyJWKClient(auth.GOOGLE_JWKS_URL)


# ── Health ──────────────────────────────────────────────────────────────────


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ── Sign-in ─────────────────────────────────────────────────────────────────


@app.get("/auth/start")
def auth_start(provider: str, redirect_uri: str, app_state: str = "") -> RedirectResponse:
    """Open this in the SYSTEM browser, never an embedded webview.

    Google rejects OAuth from embedded webviews outright
    (`disallowed_useragent`), so the app shells out to the real browser and
    waits for the redirect to come back.
    """
    if provider != "google":
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sign-in provider {provider!r}. Only 'google' is available.",
        )
    try:
        target = auth.validate_redirect_uri(redirect_uri)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    state = auth.new_state()
    # The provider echoes `state` back untouched; we stash what it means so the
    # callback knows where to return the user and can prove it started here.
    db.collection("auth_states").document(state).set(
        {
            "redirect_uri": target,
            "app_state": app_state,
            "created_at": firestore.SERVER_TIMESTAMP,
            "expires_at": int(time.time()) + auth.LOGIN_CODE_TTL_SECONDS,
        }
    )
    return RedirectResponse(
        auth.google_authorize_url(
            client_id=CFG.google_client_id,
            redirect_uri=CFG.google_redirect_uri,
            state=state,
        )
    )


@app.get("/auth/callback/google")
async def auth_callback_google(code: str = "", state: str = "", error: str = ""):
    """Where Google returns. Exchanges the code, then hands the app a one-time
    code through its own redirect — never the session token itself."""
    if error:
        raise HTTPException(status_code=400, detail=f"Google reported: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Sign-in response was incomplete.")

    state_ref = db.collection("auth_states").document(state)
    snapshot = state_ref.get()
    if not snapshot.exists:
        raise HTTPException(
            status_code=400,
            detail="This sign-in link has already been used or has expired. Try again.",
        )
    stored = snapshot.to_dict() or {}
    state_ref.delete()  # single use
    if int(stored.get("expires_at", 0)) < int(time.time()):
        raise HTTPException(status_code=400, detail="Sign-in took too long. Try again.")

    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            auth.GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": CFG.google_client_id,
                "client_secret": CFG.google_client_secret,
                "redirect_uri": CFG.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if token_response.status_code != 200:
        log.error("google token exchange failed: %s", token_response.text[:400])
        raise HTTPException(status_code=502, detail="Google rejected the sign-in.")

    id_token = token_response.json().get("id_token", "")
    if not id_token:
        raise HTTPException(status_code=502, detail="Google returned no identity token.")
    try:
        identity = auth.parse_google_id_token(
            id_token, client_id=CFG.google_client_id, jwks_client=_google_jwks
        )
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    quota.upsert_user(
        db, user_id=identity.user_id, email=identity.email, name=identity.name
    )

    login_code = auth.new_login_code()
    db.collection(quota.LOGIN_CODES).document(login_code).set(
        {
            "user_id": identity.user_id,
            "expires_at": int(time.time()) + auth.LOGIN_CODE_TTL_SECONDS,
        }
    )
    redirect = stored["redirect_uri"]
    joiner = "&" if "?" in redirect else "?"
    passthrough = f"&state={stored['app_state']}" if stored.get("app_state") else ""
    return RedirectResponse(f"{redirect}{joiner}code={login_code}{passthrough}")


@app.post("/auth/exchange")
def auth_exchange(payload: dict) -> dict[str, str | int]:
    """Trade the one-time code for a session token, over HTTPS."""
    login_code = str(payload.get("code", "")).strip()
    if not login_code:
        raise HTTPException(status_code=400, detail="No sign-in code supplied.")

    ref = db.collection(quota.LOGIN_CODES).document(login_code)
    snapshot = ref.get()
    if not snapshot.exists:
        raise HTTPException(
            status_code=400, detail="This sign-in code is not valid. Sign in again."
        )
    stored = snapshot.to_dict() or {}
    ref.delete()  # single use
    if int(stored.get("expires_at", 0)) < int(time.time()):
        raise HTTPException(status_code=400, detail="Sign-in code expired. Sign in again.")

    user_id = str(stored["user_id"])
    return {
        "token": auth.issue_session_token(
            user_id=user_id, signing_key=CFG.jwt_signing_key
        ),
        "expires_in": auth.SESSION_TTL_SECONDS,
    }


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to use the hosted service.")
    try:
        return auth.read_session_token(
            credentials.credentials, signing_key=CFG.jwt_signing_key
        )
    except auth.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


# ── Account ─────────────────────────────────────────────────────────────────


@app.get("/v1/me")
def me(user_id: str = Depends(current_user)) -> dict[str, object]:
    """Identity and remaining allowance, for the quota display in the app."""
    balance = quota.read_balance(db, user_id, limit=CFG.free_daily_tokens)
    profile = db.collection(quota.USERS).document(user_id).get().to_dict() or {}
    return {
        "user_id": user_id,
        "email": profile.get("email", ""),
        "name": profile.get("name", ""),
        "used_today": balance.used,
        "daily_limit": balance.limit,
        "remaining": balance.remaining,
        "resets": "00:00 UTC",
    }


# ── Proxy ───────────────────────────────────────────────────────────────────


def _extract_usage(payload: dict) -> int:
    usage = payload.get("usage") or {}
    return int(usage.get("total_tokens") or 0)


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, user_id: str = Depends(current_user)):
    """Authenticated passthrough to OpenRouter, metered per user.

    The request body is forwarded as-is so the app's structured-output options
    reach the provider unchanged — this service does not reinterpret them.
    """
    try:
        quota.check_allowed(
            db,
            user_id,
            user_limit=CFG.free_daily_tokens,
            global_limit=CFG.global_daily_tokens,
        )
    except quota.QuotaExceeded as exc:
        # 429 with a human message; the app shows it in the fault bar.
        return JSONResponse(status_code=429, content={"detail": str(exc)})

    body = await request.body()
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Malformed request body: {exc}") from exc
    streaming = bool(parsed.get("stream"))

    upstream_url = f"{CFG.openrouter_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {CFG.openrouter_key}",
        "Content-Type": "application/json",
        # OpenRouter attribution for the shared account.
        "HTTP-Referer": "https://github.com/freemocap/skellyspeak",
        "X-Title": "SkellySpeak",
    }

    if not streaming:
        async with httpx.AsyncClient(timeout=180) as client:
            upstream = await client.post(upstream_url, content=body, headers=headers)
        if upstream.status_code == 200:
            payload = upstream.json()
            quota.record_usage(db, user_id, tokens=_extract_usage(payload))
            return JSONResponse(content=payload)
        log.error("upstream %s: %s", upstream.status_code, upstream.text[:400])
        return JSONResponse(
            status_code=upstream.status_code,
            content={"detail": f"The AI provider returned {upstream.status_code}."},
        )

    async def relay():
        """Stream through untouched, reading the usage total on the way past.

        OpenRouter reports usage in the final chunk, so metering happens as the
        bytes flow rather than by buffering the whole response.
        """
        spent = 0
        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream(
                "POST", upstream_url, content=body, headers=headers
            ) as upstream:
                if upstream.status_code != 200:
                    detail = (await upstream.aread()).decode("utf-8", "replace")[:400]
                    log.error("upstream stream %s: %s", upstream.status_code, detail)
                    yield (
                        "data: "
                        + json.dumps(
                            {"error": f"The AI provider returned {upstream.status_code}."}
                        )
                        + "\n\n"
                    ).encode()
                    return
                async for line in upstream.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:].strip()
                        if chunk and chunk != "[DONE]":
                            try:
                                spent = _extract_usage(json.loads(chunk)) or spent
                            except json.JSONDecodeError:
                                pass  # keep-alives and partial frames are normal
                    yield (line + "\n").encode()
        # Metered after the stream completes, so a disconnect mid-answer still
        # charges for what the provider actually generated.
        quota.record_usage(db, user_id, tokens=spent)

    return StreamingResponse(relay(), media_type="text/event-stream")


# Whisper bills by audio duration, not tokens, so it cannot share the token
# counter. Charging a flat token equivalent per transcription keeps one
# currency in front of the user instead of two meters they must reason about.
TOKENS_PER_TRANSCRIPTION = 500
MAX_AUDIO_BYTES = 25 * 1024 * 1024


@app.post("/v1/audio/transcriptions")
async def transcriptions(request: Request, user_id: str = Depends(current_user)):
    """Authenticated passthrough to Groq Whisper, so hosted users need no
    second API key for voice input."""
    try:
        quota.check_allowed(
            db,
            user_id,
            user_limit=CFG.free_daily_tokens,
            global_limit=CFG.global_daily_tokens,
        )
    except quota.QuotaExceeded as exc:
        return JSONResponse(status_code=429, content={"detail": str(exc)})

    body = await request.body()
    if len(body) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Recording is too large ({len(body) // 1_048_576} MB). The limit is 25 MB.",
        )

    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("multipart/form-data"):
        raise HTTPException(
            status_code=400,
            detail="Audio must be sent as multipart/form-data.",
        )

    async with httpx.AsyncClient(timeout=180) as client:
        upstream = await client.post(
            f"{CFG.groq_base_url}/audio/transcriptions",
            content=body,
            headers={
                "Authorization": f"Bearer {CFG.groq_key}",
                "Content-Type": content_type,
            },
        )
    if upstream.status_code != 200:
        log.error("groq %s: %s", upstream.status_code, upstream.text[:400])
        return JSONResponse(
            status_code=upstream.status_code,
            content={"detail": f"Transcription failed ({upstream.status_code})."},
        )
    quota.record_usage(db, user_id, tokens=TOKENS_PER_TRANSCRIPTION)
    return JSONResponse(content=upstream.json())
