"""SkellySpeak API — sign-in, quota, and an authenticated passthrough to
OpenRouter so people can use the app without supplying their own API key.

The app can talk to three things, chosen in its settings: OpenRouter with the
user's own key, a server the user runs themselves, or this. This one exists so
that installing the app is enough to start using it.

Design rules, matching the app:
  * No silent fallbacks. If something cannot be done, the caller is told why.
  * Every failure carries a message intended for a person to read, because the
    app puts it on screen.
  * Nothing that costs money runs unmetered. A request whose cost cannot be
    determined is charged a deliberate over-estimate, never zero.
"""

from __future__ import annotations

import json
import logging
import time
from collections import deque
from urllib.parse import quote

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


# ── Abuse guard on the one unauthenticated write ────────────────────────────

# `/auth/start` writes a Firestore document and cannot require a token — it is
# what happens before anyone has one. Left open it is an unauthenticated write
# amplifier: a loop runs up Firestore costs and instance hours.
#
# In-process, so it is per-instance rather than global. That is a real
# limitation and worth stating plainly: with max-instances=4 it bounds the
# damage to roughly four times this rate, not to this rate. It is a speed bump
# sized to the actual threat (a script, not a botnet), not a guarantee.
AUTH_START_MAX_PER_MINUTE = 20
_auth_start_hits: deque[float] = deque()


def _throttle_auth_start() -> None:
    now = time.monotonic()
    while _auth_start_hits and now - _auth_start_hits[0] > 60:
        _auth_start_hits.popleft()
    if len(_auth_start_hits) >= AUTH_START_MAX_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Too many sign-in attempts right now. Wait a minute and try again.",
        )
    _auth_start_hits.append(now)


# ── Sign-in ─────────────────────────────────────────────────────────────────


@app.get("/auth/start")
def auth_start(
    provider: str,
    redirect_uri: str,
    code_challenge: str,
    code_challenge_method: str = auth.CHALLENGE_METHOD,
    app_state: str = "",
) -> RedirectResponse:
    """Open this in the SYSTEM browser, never an embedded webview.

    Google rejects OAuth from embedded webviews outright
    (`disallowed_useragent`), so the app shells out to the real browser and
    waits for the redirect to come back.

    `code_challenge` is required, not optional: the redirect that carries the
    login code travels over a channel another app can claim, so the code alone
    must not be enough to obtain a session.
    """
    _throttle_auth_start()
    if provider != "google":
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sign-in provider {provider!r}. Only 'google' is available.",
        )
    try:
        target = auth.validate_redirect_uri(redirect_uri)
        challenge = auth.validate_challenge(code_challenge, code_challenge_method)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    state = auth.new_state()
    # The provider echoes `state` back untouched; we stash what it means so the
    # callback knows where to return the user and can prove it started here.
    db.collection(quota.AUTH_STATES).document(state).set(
        {
            "redirect_uri": target,
            "app_state": app_state,
            "code_challenge": challenge,
            "created_at": firestore.SERVER_TIMESTAMP,
            "expires_at": int(time.time()) + auth.LOGIN_CODE_TTL_SECONDS,
            # Abandoned sign-ins are never read again and would otherwise sit
            # in Firestore forever. A TTL policy on this field sweeps them.
            "ttl": quota.ttl_after(1),
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

    state_ref = db.collection(quota.AUTH_STATES).document(state)
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
        # Status only. The body is a third party's and may quote back parts of
        # the request; it does not belong in our logs.
        log.error("google token exchange failed with %s", token_response.status_code)
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

    try:
        token_version = quota.upsert_user(
            db,
            user_id=identity.user_id,
            email=identity.email,
            name=identity.name,
            max_users=CFG.max_users,
        )
    except quota.SignupClosed as exc:
        # 403 with a message a person can read. Not a 500, and emphatically not
        # a sign-in that appears to succeed and then fails on every request.
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    login_code = auth.new_login_code()
    db.collection(quota.LOGIN_CODES).document(login_code).set(
        {
            "user_id": identity.user_id,
            "token_version": token_version,
            # Carried from the state so the exchange can require the matching
            # verifier. Without this the login code alone would be a session.
            "code_challenge": stored.get("code_challenge", ""),
            "expires_at": int(time.time()) + auth.LOGIN_CODE_TTL_SECONDS,
            # Swept like auth_states: a code nobody exchanged is dead weight.
            "ttl": quota.ttl_after(1),
        }
    )
    redirect = stored["redirect_uri"]
    joiner = "&" if "?" in redirect else "?"
    # Percent-encoded: app_state is caller-supplied, and a raw "&" or "#" in it
    # would inject extra parameters into the app's own redirect.
    passthrough = (
        f"&state={quote(str(stored['app_state']), safe='')}"
        if stored.get("app_state")
        else ""
    )
    return RedirectResponse(f"{redirect}{joiner}code={login_code}{passthrough}")


@app.post("/auth/exchange")
def auth_exchange(payload: dict) -> dict[str, str | int]:
    """Trade the one-time code for a session token, over HTTPS.

    The verifier is what proves this is the client that began the sign-in. An
    app that intercepted the redirect has the code but not the verifier, and
    gets nothing here.
    """
    login_code = str(payload.get("code", "")).strip()
    verifier = str(payload.get("code_verifier", "")).strip()
    if not login_code:
        raise HTTPException(status_code=400, detail="No sign-in code supplied.")
    if not verifier:
        raise HTTPException(status_code=400, detail="No code_verifier supplied.")

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

    challenge = str(stored.get("code_challenge", ""))
    if not challenge:
        # Should be unreachable: /auth/start requires a challenge. If it ever
        # happens, refuse rather than quietly downgrade to no PKCE at all.
        raise HTTPException(
            status_code=400,
            detail="This sign-in is missing its security challenge. Sign in again.",
        )
    try:
        auth.verify_code_verifier(verifier, challenge=challenge)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user_id = str(stored["user_id"])
    return {
        "token": auth.issue_session_token(
            user_id=user_id,
            signing_key=CFG.jwt_signing_key,
            token_version=int(stored.get("token_version") or 0),
        ),
        "expires_in": auth.SESSION_TTL_SECONDS,
    }


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> quota.Principal:
    """The account behind this request, and what it may spend.

    Returns a Principal rather than a bare id so the per-account limit rides
    along with the identity. Resolving it separately would mean a second read
    of the same document, and two places that could disagree about what an
    account is allowed.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in to use the hosted service.")
    try:
        user_id, token_version = auth.read_session_token(
            credentials.credentials, signing_key=CFG.jwt_signing_key
        )
    except auth.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    try:
        return quota.load_principal(
            db,
            user_id,
            token_version=token_version,
            default_limit=CFG.free_daily_micros,
        )
    except quota.SessionRevoked as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


# ── Account ─────────────────────────────────────────────────────────────────


# What the app tells us about itself. Three values, none of which locate or
# identify a person: a random per-installation UUID, the operating system, and
# the app version. No IP address is recorded anywhere in this service.
INSTALL_HEADER = "x-skellyspeak-install"
PLATFORM_HEADER = "x-skellyspeak-platform"
VERSION_HEADER = "x-skellyspeak-version"
# Long enough for a UUID and a version string, short enough that a header
# cannot be used to write arbitrary bulk into Firestore.
MAX_CLIENT_FIELD = 64

# Used only to turn a remaining balance into "about N more replies" before the
# account has any history of its own to average. Deliberately pessimistic: an
# estimate that promises more than it delivers is worse than one that surprises
# you upward.
FALLBACK_MICROS_PER_TURN = 2_000


@app.get("/v1/me")
def me(request: Request, who: quota.Principal = Depends(current_user)) -> dict[str, object]:
    """Identity and remaining allowance, for the quota display in the app.

    Doubles as the device check-in, so "which machines" stays current instead
    of frozen at whenever the person last signed in.
    """
    user_id = who.user_id
    quota.record_device(
        db,
        user_id,
        install_id=request.headers.get(INSTALL_HEADER, "")[:MAX_CLIENT_FIELD],
        platform=request.headers.get(PLATFORM_HEADER, "")[:MAX_CLIENT_FIELD],
        app_version=request.headers.get(VERSION_HEADER, "")[:MAX_CLIENT_FIELD],
    )
    balance = quota.read_balance(db, who.user_id, limit=who.daily_limit)
    profile = db.collection(quota.USERS).document(user_id).get().to_dict() or {}

    # Money is the truth, but nobody plans their afternoon in micro-dollars.
    # The estimates come from this account's own average so far, so they track
    # whatever model and conversation length are actually in use.
    per_turn = balance.micros_per_request or FALLBACK_MICROS_PER_TURN
    return {
        "user_id": user_id,
        "email": profile.get("email", ""),
        "name": profile.get("name", ""),
        "used_micros": balance.used,
        "limit_micros": balance.limit,
        "remaining_micros": balance.remaining,
        "used_usd": round(quota.micros_to_dollars(balance.used), 4),
        "limit_usd": round(quota.micros_to_dollars(balance.limit), 4),
        "remaining_usd": round(quota.micros_to_dollars(balance.remaining), 4),
        # Reporting, not limits.
        "tokens_today": balance.tokens,
        "requests_today": balance.requests,
        "estimated_turns_remaining": balance.remaining // per_turn,
        "estimated_tokens_remaining": (
            (balance.remaining // per_turn) * balance.tokens_per_request
            if balance.tokens_per_request
            else 0
        ),
        "resets": "00:00 UTC",
        # True when this account carries its own limit instead of the default,
        # so an unusually large allowance is explained rather than puzzling.
        "custom_limit": who.overridden,
    }


# ── Proxy ───────────────────────────────────────────────────────────────────

# Nothing may read a request body without a ceiling. `await request.body()`
# buffers the whole thing in memory first, so a size check afterwards runs when
# the damage is already done — on a 512Mi instance, after the process died.
MAX_JSON_BYTES = 1 * 1024 * 1024
MAX_AUDIO_BYTES = 25 * 1024 * 1024


async def read_capped_body(request: Request, limit: int, what: str) -> bytes:
    """The request body, or 413 before it is all in memory.

    Content-Length is checked first because it is free and rejects the common
    case immediately, and then the running total is checked as chunks arrive —
    a missing or dishonest Content-Length must not be a way around the cap.
    """
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            size = int(declared)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Malformed Content-Length.") from exc
        if size > limit:
            raise HTTPException(
                status_code=413,
                detail=f"{what} is too large ({size // 1_048_576} MB). The limit is {limit // 1_048_576} MB.",
            )

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise HTTPException(
                status_code=413,
                detail=f"{what} is too large. The limit is {limit // 1_048_576} MB.",
            )
    return bytes(body)



def _usage_from(payload: dict) -> tuple[int | None, int]:
    """Cost in micro-dollars and total tokens, as OpenRouter reported them.

    Cost is `None` when the response carried no usage at all. That is not a
    free request — it is a request whose cost is unknown, and the caller must
    treat it as such.
    """
    usage = payload.get("usage") or {}
    if not usage:
        return None, 0
    tokens = int(usage.get("total_tokens") or 0)
    cost = usage.get("cost")
    if cost is None:
        return None, tokens
    return quota.dollars_to_micros(float(cost)), tokens


# What an unmetered request is charged. OpenRouter returns usage on every
# response, so a missing figure means something changed upstream. Charging zero
# would make every request free with no signal that anything was wrong; this
# charges a deliberate over-estimate and logs loudly.
UNKNOWN_COST_MICROS = 20_000  # $0.02


def _settle(user_id: str, *, reserved: int, cost_micros: int | None, tokens: int, where: str) -> None:
    """Replace the reservation with the real cost, or with a loud estimate."""
    if cost_micros is None:
        log.error(
            "%s returned no usage for %s — charging the $%.2f unknown-cost rate. "
            "OpenRouter reports usage on every response, so this means the "
            "upstream contract changed and metering is no longer accurate.",
            where,
            user_id,
            quota.micros_to_dollars(UNKNOWN_COST_MICROS),
        )
        cost_micros = UNKNOWN_COST_MICROS
    quota.settle(
        db,
        user_id,
        reserved_micros=reserved,
        actual_micros=cost_micros,
        tokens=tokens,
    )


def _guard_request(parsed: dict) -> None:
    """Refuse a request we are not willing to pay for.

    The body is otherwise forwarded untouched, which is what lets the app's
    structured-output options through unchanged — and would also let the caller
    pick any model on OpenRouter. Prices there span two orders of magnitude, so
    without this the daily limit is denominated in a unit the caller controls.
    """
    model = str(parsed.get("model") or "")
    if model not in CFG.allowed_models:
        raise HTTPException(
            status_code=400,
            detail=(
                f"The hosted service does not serve {model or '(no model)'!r}. "
                f"It serves: {', '.join(CFG.allowed_models)}. Choose a different "
                "AI provider in Settings to use another model."
            ),
        )
    requested = parsed.get("max_tokens")
    if requested is not None and int(requested) > CFG.max_completion_tokens:
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_tokens of {int(requested):,} is above the hosted limit of "
                f"{CFG.max_completion_tokens:,}."
            ),
        )


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, who: quota.Principal = Depends(current_user)):
    """Authenticated passthrough to OpenRouter, metered per user in money.

    The request body is forwarded as-is so the app's structured-output options
    reach the provider unchanged — this service does not reinterpret them. It
    does refuse models it will not pay for, and caps the completion length.
    """
    user_id = who.user_id
    try:
        quota.check_allowed(
            db,
            user_id,
            user_limit=who.daily_limit,
            global_limit=CFG.global_daily_micros,
        )
    except quota.QuotaExceeded as exc:
        # 429 with a human message; the app shows it in the fault bar.
        return JSONResponse(status_code=429, content={"detail": str(exc)})

    body = await read_capped_body(request, MAX_JSON_BYTES, "That request")
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Malformed request body: {exc}") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object.")
    _guard_request(parsed)
    streaming = bool(parsed.get("stream"))

    # Charged before the call and corrected after. Between the check above and
    # the settle below there is otherwise nothing holding the money, and
    # concurrent requests would all pass the same check.
    reserved = FALLBACK_MICROS_PER_TURN
    quota.reserve(db, user_id, micros=reserved)

    upstream_url = f"{CFG.openrouter_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {CFG.openrouter_key}",
        "Content-Type": "application/json",
        # OpenRouter attribution for the shared account.
        "HTTP-Referer": "https://github.com/freemocap/skellyspeak",
        "X-Title": "SkellySpeak",
    }

    if not streaming:
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                upstream = await client.post(upstream_url, content=body, headers=headers)
        except httpx.HTTPError as exc:
            # The reservation must not be left standing for a call that never
            # happened.
            quota.settle(db, user_id, reserved_micros=reserved, actual_micros=0, tokens=0)
            raise HTTPException(status_code=502, detail=f"Could not reach the AI provider: {exc}") from exc
        if upstream.status_code == 200:
            payload = upstream.json()
            cost_micros, tokens = _usage_from(payload)
            _settle(
                user_id,
                reserved=reserved,
                cost_micros=cost_micros,
                tokens=tokens,
                where="openrouter",
            )
            return JSONResponse(content=payload)
        # Nothing was generated, so nothing is owed.
        quota.settle(db, user_id, reserved_micros=reserved, actual_micros=0, tokens=0)
        log.error("upstream %s", upstream.status_code)
        return JSONResponse(
            status_code=upstream.status_code,
            content={"detail": f"The AI provider returned {upstream.status_code}."},
        )

    async def relay():
        """Stream through untouched, reading the usage total on the way past.

        OpenRouter reports usage in the final chunk, so metering happens as the
        bytes flow rather than by buffering the whole response.
        """
        cost_micros: int | None = None
        tokens = 0
        started = False
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                async with client.stream(
                    "POST", upstream_url, content=body, headers=headers
                ) as upstream:
                    if upstream.status_code != 200:
                        await upstream.aread()
                        log.error("upstream stream %s", upstream.status_code)
                        yield (
                            "data: "
                            + json.dumps(
                                {"error": f"The AI provider returned {upstream.status_code}."}
                            )
                            + "\n\n"
                        ).encode()
                        return
                    started = True
                    async for line in upstream.aiter_lines():
                        if line.startswith("data: "):
                            chunk = line[6:].strip()
                            if chunk and chunk != "[DONE]":
                                try:
                                    chunk_cost, chunk_tokens = _usage_from(json.loads(chunk))
                                except json.JSONDecodeError:
                                    chunk_cost, chunk_tokens = None, 0
                                if chunk_cost is not None:
                                    cost_micros = chunk_cost
                                if chunk_tokens:
                                    tokens = chunk_tokens
                        yield (line + "\n").encode()
        finally:
            # `finally`, not a trailing statement: when the client disconnects
            # the generator is closed with GeneratorExit and anything after the
            # `async with` never runs. That is how a cancelled answer used to
            # cost the provider real money and this service nothing.
            if started:
                _settle(
                    user_id,
                    reserved=reserved,
                    cost_micros=cost_micros,
                    tokens=tokens,
                    where="openrouter stream",
                )
            else:
                quota.settle(
                    db, user_id, reserved_micros=reserved, actual_micros=0, tokens=0
                )

    return StreamingResponse(relay(), media_type="text/event-stream")


# Whisper bills by audio duration, not tokens, and Groq does not report a cost
# figure. A flat charge per transcription keeps one currency in front of the
# user; it is set above what a short clip actually costs so voice input is
# never the thing that quietly runs the budget down.
TRANSCRIPTION_MICROS = 1_000  # $0.001


@app.post("/v1/audio/transcriptions")
async def transcriptions(request: Request, who: quota.Principal = Depends(current_user)):
    """Authenticated passthrough to Groq Whisper, so hosted users need no
    second API key for voice input."""
    user_id = who.user_id
    try:
        quota.check_allowed(
            db,
            user_id,
            user_limit=who.daily_limit,
            global_limit=CFG.global_daily_micros,
        )
    except quota.QuotaExceeded as exc:
        return JSONResponse(status_code=429, content={"detail": str(exc)})

    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("multipart/form-data"):
        raise HTTPException(
            status_code=400,
            detail="Audio must be sent as multipart/form-data.",
        )

    body = await read_capped_body(request, MAX_AUDIO_BYTES, "Recording")

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            upstream = await client.post(
                f"{CFG.groq_base_url}/audio/transcriptions",
                content=body,
                headers={
                    "Authorization": f"Bearer {CFG.groq_key}",
                    "Content-Type": content_type,
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not reach the transcription service: {exc}"
        ) from exc
    if upstream.status_code != 200:
        log.error("groq %s", upstream.status_code)
        return JSONResponse(
            status_code=upstream.status_code,
            content={"detail": f"Transcription failed ({upstream.status_code})."},
        )
    quota.record_usage(db, user_id, micros=TRANSCRIPTION_MICROS)
    return JSONResponse(content=upstream.json())
