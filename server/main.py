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

import asyncio
import io
import math
import wave
from collections.abc import AsyncIterator
from collections.abc import Awaitable, Callable
import json
import logging
import time
from threading import Lock
from functools import partial
from collections import deque
from contextlib import asynccontextmanager
from urllib.parse import quote

import httpx
import anyio
import jwt as pyjwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.exceptions import RequestValidationError
from google.cloud import firestore

import audio_input
import admission
import grouped
import work_admission
import budget
import contracts
import auth
import auth_store
import config
import quota
import streaming
import observability
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("skellyspeak-api")

CFG = config.load()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    await asyncio.to_thread(audio_input.verify_decoder)
    yield


app = FastAPI(title="SkellySpeak API", lifespan=lifespan)
ingress: admission.Ingress = admission.Ingress()
liveness_ingress = admission.Ingress(60)
authenticated_ingress = admission.AuthenticatedIngress()
db = firestore.Client()
bearer = HTTPBearer(auto_error=False)
_google_jwks = pyjwt.PyJWKClient(auth.GOOGLE_JWKS_URL)


def admit_http(request: Request) -> None:
    if request.method == "GET" and request.url.path == "/health":
        liveness_ingress.take()
        return
    protected = {"/v1/me", "/v1/diagnostics", "/v1/chat/completions", "/v1/audio/transcriptions", "/v1/operations", "/v1/protocol"}
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if request.url.path in protected and scheme.lower() == "bearer" and 0 < len(token) <= 4096:
        try:
            subject, _ = auth.read_session_token(token, signing_key=CFG.jwt_signing_key)
        except (auth.AuthError, ValueError, TypeError):
            pass
        else:
            authenticated_ingress.take(subject, lane="control" if request.url.path in {"/v1/me", "/v1/diagnostics", "/v1/protocol"} else "inference")
            return
    # An unverified Authorization header never earns an authenticated allowance.
    ingress.take()


@app.middleware("http")
async def bound_ingress(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    return await observability.observe(request, call_next, ingress, admit=lambda: admit_http(request))


@app.exception_handler(StarletteHTTPException)
async def explain_rejection(request: Request, error: StarletteHTTPException) -> JSONResponse:
    return observability.error_response(request, error)


@app.exception_handler(RequestValidationError)
async def invalid_parameters(request: Request, error: RequestValidationError) -> JSONResponse:
    # Framework validation errors can include submitted values. Keep them private.
    return observability.error_response(request, HTTPException(422, "Missing or invalid request parameters."))


class UpstreamHTTPError(HTTPException):
    def __init__(self, status: int):
        super().__init__(502, f"Upstream provider returned HTTP {status}.")
        self.upstream_status = status
        self.code = "UPSTREAM_FAILURE"


async def provider_json(client: httpx.AsyncClient, url: str, *, limit: int, **kwargs) -> dict:
    """Bound decoded upstream bytes before buffering, including compressed responses."""
    async with client.stream("POST", url, follow_redirects=False, **kwargs) as response:
        if not response.is_success:
            raise UpstreamHTTPError(response.status_code)
        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > limit:
                raise HTTPException(502, "Upstream response exceeds its size limit.")
            body.extend(chunk)
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise HTTPException(502, "Upstream returned invalid JSON.") from exc
    if not isinstance(payload, dict):
        raise HTTPException(502, "Upstream returned an invalid response.")
    return payload


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
_auth_start_lock = Lock()


def _throttle_auth_start() -> None:
    with _auth_start_lock:
        _check_auth_start_rate()


def _check_auth_start_rate() -> None:
    now = time.monotonic()
    while _auth_start_hits and now - _auth_start_hits[0] > 60:
        _auth_start_hits.popleft()
    if len(_auth_start_hits) >= AUTH_START_MAX_PER_MINUTE:
        raise observability.Rejection("AUTH_RATE_LIMIT",
            "Too many sign-in attempts right now. Wait a minute and try again.", retry=60)
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
    if len(app_state) > 128:
        raise HTTPException(status_code=400, detail="Sign-in state is too long.")
    if provider != "google":
        raise HTTPException(
            status_code=400,
            detail="Only Google sign-in is available.",
        )
    try:
        target = auth.validate_redirect_uri(redirect_uri)
        challenge = auth.validate_challenge(code_challenge, code_challenge_method)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    admission.take(db, lane="auth", subject="public")
    state = auth.issue_code(purpose="state", signing_key=CFG.jwt_signing_key)
    # The provider echoes `state` back untouched; we stash what it means so the
    # callback knows where to return the user and can prove it started here.
    db.collection(quota.AUTH_STATES).document(state).set(
        {
            "redirect_uri": target,
            "app_state": app_state,
            "code_challenge": challenge,
            "created_at": firestore.SERVER_TIMESTAMP,
            "expires_at": int(time.time()) + auth.AUTH_STATE_TTL_SECONDS,
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
async def auth_callback_google(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    """Where Google returns. Exchanges the code, then hands the app a one-time
    code through its own redirect — never the session token itself."""
    if error:
        raise HTTPException(status_code=400, detail="Google sign-in was declined or failed.")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Sign-in response was incomplete.")

    def validate_state(stored: dict[str, object]) -> None:
        auth.validate_redirect_uri(str(stored["redirect_uri"]))

    try:
        auth.verify_issued_code(state, purpose="state", signing_key=CFG.jwt_signing_key)
        await asyncio.to_thread(admission.take, db, lane="auth", subject="public")
        stored = await asyncio.to_thread(auth_store.consume, db, collection=quota.AUTH_STATES,
                                         code=state, validate=validate_state)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async with httpx.AsyncClient(timeout=20) as client:
        token_payload = await provider_json(client,
            auth.GOOGLE_TOKEN_URL, limit=65536,
            data={
                "code": code,
                "client_id": CFG.google_client_id,
                "client_secret": CFG.google_client_secret,
                "redirect_uri": CFG.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    id_token = token_payload.get("id_token", "")
    if not id_token:
        raise HTTPException(status_code=502, detail="Google returned no identity token.")
    try:
        identity = await asyncio.to_thread(auth.parse_google_id_token,
            id_token, client_id=CFG.google_client_id, jwks_client=_google_jwks
        )
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        token_version = await asyncio.to_thread(quota.upsert_user,
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

    login_code = auth.issue_code(purpose="login", signing_key=CFG.jwt_signing_key)
    await asyncio.to_thread(db.collection(quota.LOGIN_CODES).document(login_code).set,
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
async def auth_exchange(request: Request) -> dict[str, str | int]:
    body = await read_capped_body(request, 4096, "Sign-in request")
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeError, RecursionError) as exc:
        raise HTTPException(status_code=400, detail="Malformed sign-in request.") from exc
    if not isinstance(payload, dict) or set(payload) != {"code", "code_verifier"}:
        raise HTTPException(status_code=400, detail="code and code_verifier are required.")
    if not all(isinstance(value, str) for value in payload.values()):
        raise HTTPException(status_code=400, detail="Sign-in fields must be strings.")

    def validate_code(stored: dict[str, object]) -> None:
        auth.verify_code_verifier(payload["code_verifier"], challenge=str(stored["code_challenge"]))

    try:
        auth.verify_issued_code(payload["code"], purpose="login", signing_key=CFG.jwt_signing_key)
        await asyncio.to_thread(admission.take, db, lane="auth", subject="public")
        stored = await asyncio.to_thread(auth_store.consume, db, collection=quota.LOGIN_CODES,
                                         code=payload["code"], validate=validate_code)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "token": auth.issue_session_token(user_id=str(stored["user_id"]), signing_key=CFG.jwt_signing_key,
                                          token_version=int(stored["token_version"])),
        "expires_in": auth.SESSION_TTL_SECONDS,
    }

def admitted_user(credentials: HTTPAuthorizationCredentials | None, lane: str) -> quota.Principal:
    """Verify signature, bound database work, then check revocation and account scope."""
    if credentials is None:
        raise HTTPException(401, "Sign in to use the hosted service.")
    try:
        user_id, token_version = auth.read_session_token(credentials.credentials, signing_key=CFG.jwt_signing_key)
    except auth.AuthError as exc:
        raise HTTPException(401, "Your session is invalid.") from exc
    admission.take(db, lane=lane, subject=user_id)
    try:
        return quota.load_principal(db, user_id, token_version=token_version,
                                    default_limit=CFG.free_daily_micros)
    except quota.SessionRevoked as exc:
        raise HTTPException(401, "Your session is no longer authorized.") from exc


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> quota.Principal:
    return admitted_user(credentials, "account")


def diagnostic_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> quota.Principal:
    return admitted_user(credentials, "diagnostics")


@app.get("/v1/diagnostics")
def diagnostics(who: quota.Principal = Depends(diagnostic_user)) -> dict[str, object]:
    import diagnostics as reports
    return reports.read(db, who, global_limit=CFG.global_daily_micros)


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
FALLBACK_MICROS_PER_REQUEST = 2_000


@app.get("/v1/me")
def me(request: Request, who: quota.Principal = Depends(diagnostic_user)) -> dict[str, object]:
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
    per_request = balance.micros_per_request or FALLBACK_MICROS_PER_REQUEST
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
        "estimated_turns_remaining": balance.remaining // per_request,
        "estimated_tokens_remaining": (
            (balance.remaining // per_request) * balance.tokens_per_request
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
        if size < 0:
            raise HTTPException(status_code=400, detail="Content-Length cannot be negative.")
        if size > limit:
            raise HTTPException(
                status_code=413,
                detail=f"{what} is too large ({size // 1_048_576} MB). The limit is {limit // 1_048_576} MB.",
            )

    body = bytearray()
    try:
        async with asyncio.timeout(30):
            async for chunk in request.stream():
                if len(body) + len(chunk) > limit:
                    raise HTTPException(
                        status_code=413,
                        detail=f"{what} is too large. The limit is {limit // 1_048_576} MB.",
                    )
                body.extend(chunk)
    except TimeoutError as error:
        raise HTTPException(status_code=408, detail="Upload timed out.") from error
    return bytes(body)



def _usage_from(payload: dict[str, object]) -> tuple[int | None, int]:
    usage = payload.get("usage")
    if usage is None:
        return None, 0
    if not isinstance(usage, dict):
        raise ValueError("Provider usage must be an object.")
    tokens = usage.get("total_tokens", 0)
    cost = usage.get("cost")
    if type(tokens) is not int or tokens < 0:
        raise ValueError("Provider token count must be a nonnegative integer.")
    if cost is None:
        return None, tokens
    if type(cost) not in (int, float) or not math.isfinite(cost) or cost < 0:
        raise ValueError("Provider cost must be finite and nonnegative.")
    return quota.dollars_to_micros(cost), tokens


def _reserve(who: quota.Principal, micros: int) -> budget.Reservation:
    try:
        return budget.reserve(db, user_id=who.user_id, micros=micros,
                              user_limit=who.daily_limit, global_limit=CFG.global_daily_micros)
    except quota.QuotaExceeded as exc:
        raise observability.Rejection(exc.code, str(exc), daily=exc.code != "SPENDING_PAUSED") from exc


class UsageUnknown(RuntimeError):
    """Accounting retained the reservation but cannot confirm provider usage."""


async def _settle(reservation: budget.Reservation, *, cost: int | None, tokens: int, provider_id: str) -> None:
    with anyio.CancelScope(shield=True):
        await anyio.to_thread.run_sync(partial(
            budget.settle, db, reservation=reservation,
            actual_micros=reservation.micros if cost is None else cost,
            tokens=tokens, status="unknown" if cost is None else "settled", provider_id=provider_id,
        ))
    if cost is None:
        raise UsageUnknown(f"Provider usage is unknown; reservation {reservation.request_id} requires reconciliation.")


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    body = await read_capped_body(request, MAX_JSON_BYTES, "That request")
    try:
        parsed = json.loads(body)
    except (json.JSONDecodeError, UnicodeError, RecursionError) as exc:
        raise HTTPException(status_code=400, detail="Malformed JSON request.") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="Request body must be an object.")
    contract = contracts.chat_request(parsed, allowed_models=CFG.allowed_models, max_tokens=CFG.max_completion_tokens)
    # Keep the reservation handle even if the request is cancelled while the
    # transaction is committing. Deliver pending cancellation before submission.
    with anyio.CancelScope(shield=True):
        reservation = await anyio.to_thread.run_sync(partial(_reserve, who, contract.reserve_micros))
    try:
        await anyio.lowlevel.checkpoint()
    except BaseException:
        await _settle(reservation, cost=0, tokens=0, provider_id="")
        raise
    url = f"{CFG.openrouter_base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {CFG.openrouter_key}", "X-Title": "SkellySpeak"}

    if not contract.payload.get("stream", False):
        cost: int | None = None
        tokens = 0
        provider_id = ""
        try:
            async with asyncio.timeout(180), httpx.AsyncClient(timeout=180) as client:
                payload = await provider_json(client, url, limit=4 * 1024 * 1024,
                                              json=contract.payload, headers=headers)
            if not isinstance(payload, dict) or payload.get("error"):
                raise HTTPException(status_code=502, detail="AI provider returned an invalid response.")
            provider_id = str(payload.get("id", ""))
            cost, tokens = _usage_from(payload)
            return JSONResponse(content=payload)
        finally:
            # Settlement is shielded from disconnect cancellation.
            await _settle(reservation, cost=cost, tokens=tokens, provider_id=provider_id)

    relay_started = False

    async def relay() -> AsyncIterator[bytes]:
        nonlocal relay_started
        relay_started = True
        cost: int | None = None
        tokens = 0
        provider_id = ""
        completed = False
        settled = False
        upstream_status: int | None = None
        try:
            async with asyncio.timeout(180), httpx.AsyncClient(timeout=180) as client:
                async with client.stream("POST", url, json=contract.payload, headers=headers) as upstream:
                    if not upstream.is_success:
                        upstream_status = upstream.status_code
                        raise RuntimeError(f"AI provider returned {upstream.status_code}.")
                    async for payload in streaming.events(upstream.aiter_bytes()):
                        if payload is None:
                            completed = True
                            settled = True
                            await _settle(reservation, cost=cost, tokens=tokens, provider_id=provider_id)
                            yield b"data: [DONE]\n\n"
                            return
                        provider_id = str(payload.get("id", provider_id))
                        chunk_cost, chunk_tokens = _usage_from(payload)
                        if chunk_cost is not None:
                            cost = chunk_cost
                        tokens = max(tokens, chunk_tokens)
                        yield ("data: " + json.dumps(payload, ensure_ascii=False) + "\n\n").encode("utf-8")
            if not completed:
                raise RuntimeError("AI provider stream ended without a completion marker.")
        except Exception as exc:
            if not settled:
                settled = True
                try:
                    await _settle(reservation, cost=None, tokens=tokens, provider_id=provider_id)
                except Exception as settlement_error:
                    exc = RuntimeError(f"{exc}; {settlement_error}")
            log.error("Chat stream failed for reservation %s (%s)", reservation.request_id, type(exc).__name__)
            error_payload: dict[str, object] = {"message": "Chat stream failed. The reservation remains charged unless usage was verified."}
            if upstream_status is not None:
                error_payload["code"] = upstream_status
            yield ("data: " + json.dumps({"error": error_payload}) + "\n\n").encode()
        finally:
            if not settled:
                await _settle(reservation, cost=None, tokens=tokens, provider_id=provider_id)

    class ReservedStreamResponse(StreamingResponse):
        async def __call__(self, scope, receive, send) -> None:
            try:
                await super().__call__(scope, receive, send)
            finally:
                # A disconnect can prevent the generator from ever starting.
                # In that case there was no upstream submission to account for.
                if not relay_started:
                    await _settle(reservation, cost=0, tokens=0, provider_id="")

    return ReservedStreamResponse(relay(), media_type="text/event-stream")


_audio_slots = asyncio.Semaphore(2)


@app.post("/v1/audio/transcriptions")
async def transcriptions(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    if _audio_slots.locked():
        raise observability.Rejection("TRANSCRIPTION_BUSY", "Transcription is busy. Try again shortly.", retry=5)
    async with _audio_slots:
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("multipart/form-data"):
            raise HTTPException(status_code=400, detail="Audio must be multipart/form-data.")
        reservation: budget.Reservation | None = None
        cost: int | None = 0
        try:
            with anyio.CancelScope(shield=True):
                reservation = await anyio.to_thread.run_sync(partial(_reserve, who, audio_input.MAX_COST_MICROS))
            await anyio.lowlevel.checkpoint()
            body = await read_capped_body(request, MAX_AUDIO_BYTES, "Recording")
            audio = await anyio.to_thread.run_sync(partial(audio_input.decode_upload, body, content_type=content_type))
            if audio.cost_micros > reservation.micros:
                raise RuntimeError("Decoded audio exceeds its reserved cost.")
            output = io.BytesIO()
            with wave.open(output, "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(audio_input.SAMPLE_RATE)
                wav.writeframes(audio.pcm)
            cost = None
            async with asyncio.timeout(60), httpx.AsyncClient(timeout=60) as client:
                payload = await provider_json(client,
                    f"{CFG.groq_base_url}/audio/transcriptions", limit=262144,
                    headers={"Authorization": f"Bearer {CFG.groq_key}"}, data=audio.fields,
                    files={"file": ("audio.wav", output.getvalue(), "audio/wav")},
                )
            cost = audio.cost_micros
            if not isinstance(payload, dict) or not isinstance(payload.get("text"), str):
                raise HTTPException(status_code=502, detail="Transcription provider returned invalid text.")
            return JSONResponse(content=payload)
        finally:
            if reservation is not None:
                await _settle(reservation, cost=cost, tokens=0, provider_id="groq")



async def execute_grouped_item(item: grouped.Item, held: work_admission.Claim,
                               *, who: quota.Principal) -> dict[str, object]:
    reservation: budget.Reservation | None = None
    cost: int | None = 0
    tokens: int = 0
    provider_id: str = ""
    state = "failed"
    execution_error: BaseException | None = None
    try:
        with anyio.CancelScope(shield=True):
            reservation = await anyio.to_thread.run_sync(partial(_reserve, who, item.contract.reserve_micros))
        # Leave a full work deadline inside the lease, including after slow ledger work.
        if time.time() + work_admission.WORK_SECONDS >= held.expires_at:
            raise HTTPException(409, "Admission lease is too close to expiry.")
        with anyio.fail_after(work_admission.WORK_SECONDS):
            async with httpx.AsyncClient(timeout=work_admission.WORK_SECONDS) as client:
                cost = None
                state = "unknown"
                payload = await provider_json(client, f"{CFG.openrouter_base_url}/chat/completions",
                    limit=4 * 1024 * 1024, json=item.contract.payload,
                    headers={"Authorization": f"Bearer {CFG.openrouter_key}", "X-Title": "SkellySpeak"})
        if payload.get("error"):
            raise HTTPException(502, "Invalid provider response.")
        provider_id = str(payload.get("id", ""))
        cost, tokens = _usage_from(payload)
        if cost is not None:
            state = "succeeded"
        return {"type": "result", "response": payload}
    except BaseException as error:
        execution_error = error
        raise
    finally:
        with anyio.CancelScope(shield=True):
            try:
                if reservation is not None:
                    await _settle(reservation, cost=cost, tokens=tokens, provider_id=provider_id)
            except UsageUnknown:
                state = "unknown"
                # Keep the original execution failure after conservative settlement.
                # Storage failures still propagate through the separate handler.
                if execution_error is None:
                    raise
            except BaseException:
                state = "unknown"
                raise
            finally:
                await anyio.to_thread.run_sync(partial(work_admission.finish, db, claim=held, state=state))


@app.post("/v1/operations")
async def operations(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    body = await read_capped_body(request, MAX_JSON_BYTES, "Operation group")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeError, RecursionError) as error:
        raise HTTPException(400, "Malformed operation group.") from error
    items = grouped.parse(payload, allowed_models=CFG.allowed_models, max_tokens=CFG.max_completion_tokens)
    return StreamingResponse(grouped.results(items, db=db, who=who,
        execute=partial(execute_grouped_item, who=who)), media_type="application/x-ndjson")


@app.get("/v1/protocol")
def protocol(who: quota.Principal = Depends(diagnostic_user)) -> dict[str, object]:
    return {"protocol": "skellyspeak", "version": 1, "max_items": grouped.MAX_ITEMS,
            "chat_models": [model for model in CFG.allowed_models if model == "google/gemini-2.5-flash"],
            "transcription_model": "whisper-large-v3"}
