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
from server.app.diagnostics.exceptions import DiagnosticValueError, DiagnosticRuntimeError

from server.app.inference import decisions

# `python app/main.py` is a convenient local command but cannot import the
# repository-level `server` package by itself. Delegate it to the supported
# launcher before importing the hosted application.
if __name__ == "__main__":
    import importlib
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    importlib.import_module("server.development.launcher").run()
    raise SystemExit

import asyncio
import math
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

import server.app.inference.audio_input as audio_input
import server.app.inference.audio_service as audio_service
import server.app.admission.admission as admission
import server.app.inference.grouped as grouped
import server.app.inference.model_routing as model_routing
import server.app.admission.work_admission as work_admission
import server.app.accounting.budget as budget
import server.app.inference.contracts as contracts
import server.app.identity.auth as auth
import server.app.identity.auth_store as auth_store
import server.app.config as config
import server.app.accounting.quota as quota
import server.app.inference.streaming as streaming
import server.app.diagnostics.observability as observability
import server.app.diagnostics.runtime as runtime
import server.app.diagnostics.provider_errors as provider_errors
import server.app.diagnostics.provider_health as provider_health
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
log = logging.getLogger("skellyspeak-api")

CFG = config.load()


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    runtime.emit("runtime_started")
    runtime.emit("decoder_check_started")
    await asyncio.to_thread(audio_input.verify_decoder)
    runtime.emit("decoder_check_finished")
    try:
        yield
    finally:
        runtime.emit("runtime_stopped")


app = FastAPI(title="SkellySpeak API", lifespan=lifespan)
ingress: admission.Ingress = admission.Ingress()
liveness_ingress = admission.Ingress(60)
admin_ingress = admission.Ingress(180)
authenticated_ingress = admission.AuthenticatedIngress()
db = firestore.Client()
bearer = HTTPBearer(auto_error=False)
_google_jwks = pyjwt.PyJWKClient(auth.GOOGLE_JWKS_URL)


def admit_http(request: Request) -> None:
    if request.url.path.startswith('/admin'):
        from server.app.identity.admin_auth import claims_for
        try:
            local = getattr(request.app.state, "development_admin", None)
            if local:
                local.require(request)
            else:
                claims_for(request, CFG)
        except HTTPException:
            pass
        else:
            admin_ingress.take()
            return
    if request.method == "GET" and request.url.path == "/health":
        liveness_ingress.take()
        return
    protected = {"/v1/me", "/v1/diagnostics", "/v1/chat/completions", "/v1/audio/transcriptions", "/v1/audio/speech", "/v1/operations", "/v1/protocol"}
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
    failure = HTTPException(422, "Missing or invalid request parameters.")
    failure.diagnostics = {"stage": "request_validation", "errors": [
        {"type": item["type"], "path": ".".join(str(p) for p in item["loc"] if isinstance(p, (str, int)))}
        for item in error.errors()[:32]]}
    return observability.error_response(request, failure)


class UpstreamHTTPError(HTTPException):
    def __init__(self, status: int, provider: str = "UPSTREAM", diagnostics=None):
        super().__init__(502, f"{provider} returned HTTP {status}.")
        self.upstream_status = status
        self.diagnostics = diagnostics
        self.code = f"{provider}_HTTP_{status}" if provider in {"OPENROUTER", "GROQ"} else "UPSTREAM_FAILURE"


async def provider_json(client: httpx.AsyncClient, url: str, *, limit: int, provider: str = "UPSTREAM", **kwargs) -> dict:
    """Bound decoded upstream bytes before buffering, including compressed responses."""
    async with runtime.phase("provider", provider=provider):
        async with client.stream("POST", url, follow_redirects=False, **kwargs) as response:
            runtime.emit("provider_headers", provider=provider, status=response.status_code)
            if not response.is_success:
                metadata = await provider_errors.capture(response, provider, kwargs)
                raise UpstreamHTTPError(response.status_code, provider, metadata)
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
        if provider in {"OPENROUTER", "GROQ"} and payload.get("error"):
            provider_errors.record(provider, response.status_code, {"error": payload["error"]}, kwargs)
            error = payload["error"]
            status = error.get("code") if isinstance(error, dict) else None
            metadata = provider_errors.sanitize(payload, tuple(provider_errors.request_strings(kwargs)))
            metadata["chars"] = sum(len(choice.get("message", {}).get("content", ""))
                                    for choice in payload.get("choices", [])
                                    if isinstance(choice, dict) and isinstance(choice.get("message"), dict)
                                    and isinstance(choice["message"].get("content"), str))
            metadata["http"] = {"status": response.status_code, "response_headers": provider_errors.response_headers(response)}
            raise UpstreamHTTPError(status if type(status) is int and 400 <= status <= 599 else 502, provider, metadata)
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
async def auth_callback_google(request: Request, code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    """Where Google returns. Exchanges the code, then hands the app a one-time
    code through its own redirect — never the session token itself."""
    if error:
        raise HTTPException(status_code=400, detail="Google sign-in was declined or failed.")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Sign-in response was incomplete.")

    def validate_state(stored: dict[str, object]) -> None:
        if (stored.get("admin_flow") is True) != admin_flow:
            raise auth.AuthError("Sign-in state does not match this flow.")
        if admin_flow:
            from server.app.identity.admin_auth import validate_flow
            validate_flow(stored, request)
        else:
            auth.validate_redirect_uri(str(stored["redirect_uri"]))

    try:
        try:
            auth.verify_issued_code(state, purpose="admin-state", signing_key=CFG.jwt_signing_key)
            admin_flow = True
        except auth.AuthError:
            auth.verify_issued_code(state, purpose="state", signing_key=CFG.jwt_signing_key)
            admin_flow = False
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

    if stored.get("admin_flow") is True:
        from server.app.identity.admin_auth import finish
        return await asyncio.to_thread(finish, identity, CFG, db)
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
    import server.app.diagnostics.diagnostics as reports
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
        "allowance_credit_micros": balance.allowance_credit,
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
        raise DiagnosticValueError("Provider usage must be an object.")
    tokens = usage.get("total_tokens", 0)
    if "total_tokens" not in usage and ("input_tokens" in usage or "output_tokens" in usage):
        counts = [usage.get("input_tokens", 0), usage.get("output_tokens", 0)]
        if any(type(n) is not int or n < 0 for n in counts):
            raise DiagnosticValueError("Provider token counts must be nonnegative integers.")
        tokens = sum(counts)
    cost = usage.get("cost")
    if type(tokens) is not int or tokens < 0:
        raise DiagnosticValueError("Provider token count must be a nonnegative integer.")
    if cost is None:
        return None, tokens
    if type(cost) not in (int, float) or not math.isfinite(cost) or cost < 0:
        raise DiagnosticValueError("Provider cost must be finite and nonnegative.")
    return quota.dollars_to_micros(cost), tokens


def _reserve(who: quota.Principal, micros: int) -> budget.Reservation:
    try:
        runtime.emit("reservation_started", micros=micros)
        reservation = budget.reserve(db, user_id=who.user_id, micros=micros,
                              user_limit=who.daily_limit, global_limit=CFG.global_daily_micros)
        runtime.emit("reservation_finished", micros=micros)
        return reservation
    except quota.QuotaExceeded as exc:
        runtime.emit("reservation_failed", micros=micros)
        raise observability.Rejection(exc.code, str(exc), daily=exc.code != "SPENDING_PAUSED") from exc
    except BaseException:
        runtime.emit("reservation_failed", micros=micros)
        raise


class UsageUnknown(RuntimeError):
    """Accounting retained the reservation but cannot confirm provider usage."""


async def _settle(reservation: budget.Reservation, *, cost: int | None, tokens: int, provider_id: str, cost_basis: str = "reported", raise_unknown: bool = True) -> None:
    async with runtime.phase("settlement", outcome="unknown" if cost is None else "known", tokens=tokens):
        with anyio.CancelScope(shield=True):
            await anyio.to_thread.run_sync(partial(
                budget.settle, db, reservation=reservation,
                actual_micros=reservation.micros if cost is None else cost,
                tokens=tokens, status="unknown" if cost is None else "settled", provider_id=provider_id, cost_basis=cost_basis,
            ))
        if cost is None and raise_unknown:
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
    contract = contracts.chat_request(parsed, max_tokens=CFG.max_completion_tokens)
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
        execution_error: BaseException | None = None
        try:
            async with asyncio.timeout(180), httpx.AsyncClient(timeout=180) as client:
                payload = await provider_json(client, url, limit=4 * 1024 * 1024, provider="OPENROUTER",
                                              json=contract.payload, headers=headers)
            if not isinstance(payload, dict) or payload.get("error"):
                raise HTTPException(status_code=502, detail="AI provider returned an invalid response.")
            provider_id = str(payload.get("id", ""))
            cost, tokens = _usage_from(payload)
            return JSONResponse(content=payload)
        except BaseException as error:
            execution_error = error
            raise
        finally:
            # Preserve the provider error after conservative accounting.
            try:
                await _settle(reservation, cost=cost, tokens=tokens, provider_id=provider_id)
            except UsageUnknown:
                if not isinstance(execution_error, UpstreamHTTPError):
                    raise

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
        upstream_diagnostics = None
        provider_started = time.monotonic()
        runtime.emit("provider_started", provider="OPENROUTER")
        try:
            async with asyncio.timeout(180), httpx.AsyncClient(timeout=180) as client:
                async with client.stream("POST", url, json=contract.payload, headers=headers) as upstream:
                    runtime.emit("provider_headers", provider="OPENROUTER", status=upstream.status_code)
                    if not upstream.is_success:
                        upstream_diagnostics = await provider_errors.capture(upstream, "OPENROUTER", {"json": contract.payload, "headers": headers})
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
                raise DiagnosticRuntimeError("AI provider stream ended without a completion marker.")
        except Exception as exc:
            from server.app.diagnostics.exceptions import describe
            private = tuple(provider_errors.request_strings(contract.payload)) + tuple(provider_errors.request_strings(headers))
            failures = {"stage": "stream", "cause": describe(exc, private=private, include_message=isinstance(exc, httpx.HTTPError))}
            if not settled:
                settled = True
                try:
                    await _settle(reservation, cost=None, tokens=tokens, provider_id=provider_id)
                except Exception as settlement_error:
                    failures["settlement_error"] = describe(settlement_error)
            details = {"response": upstream_diagnostics, **failures}
            runtime.emit("provider_failed", provider="OPENROUTER", diagnostics=details)
            error_payload: dict[str, object] = {"message": "Chat stream failed. The reservation remains charged unless usage was verified."}
            if upstream_status is not None:
                error_payload["code"] = upstream_status
            error_payload["diagnostics"] = details
            yield ("data: " + json.dumps({"error": error_payload}) + "\n\n").encode()
        finally:
            runtime.emit("provider_finished" if completed else "provider_failed", provider="OPENROUTER",
                         duration_ms=round((time.monotonic() - provider_started) * 1000))
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


@app.post("/v1/audio/transcriptions")
async def transcriptions(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    return await audio_service.transcribe(request, who, CFG, _reserve, _settle, read_capped_body)


class StreamFailure(HTTPException):
    """A streamed item that did not complete. `code` and bounded diagnostics
    travel in the existing error event; the text already went out as deltas."""
    def __init__(self, code: str, diagnostics: dict[str, object]):
        super().__init__(502, "Provider stream did not complete.")
        self.code = code
        self.diagnostics = diagnostics


async def stream_grouped_item(client: httpx.AsyncClient, url: str, outbound: dict[str, object],
                              headers: dict[str, str], on_delta: Callable[[str], None],
                              accumulator: streaming.CompletionAccumulator) -> streaming.CompletionAccumulator:
    """Stream one prose item upstream, handing each piece of text to `on_delta`."""
    request = {**outbound, "stream": True, "usage": {"include": True}}
    async with runtime.phase("provider", provider="OPENROUTER"):
        async with client.stream("POST", url, json=request, headers=headers, follow_redirects=False) as response:
            runtime.emit("provider_headers", provider="OPENROUTER", status=response.status_code)
            if not response.is_success:
                metadata = await provider_errors.capture(response, "OPENROUTER", {"json": request, "headers": headers})
                raise UpstreamHTTPError(response.status_code, "OPENROUTER", metadata)
            accumulator.http = {"status": response.status_code, "response_headers": provider_errors.response_headers(response)}
            try:
                async for payload in streaming.frames(response.aiter_bytes()):
                    added = accumulator.accept(payload)
                    if added:
                        on_delta(added)
            except streaming.ResponseLimitExceeded as error:
                raise StreamFailure("RESPONSE_LIMIT", accumulator.partial("response_limit")) from error
            except (ValueError, UnicodeError, httpx.HTTPError) as error:
                from server.app.diagnostics.exceptions import describe
                accumulator.framing_error = describe(error, private=tuple(provider_errors.request_strings(request)) + tuple(provider_errors.request_strings(headers)), include_message=isinstance(error, httpx.HTTPError))

    return accumulator


async def execute_grouped_item(item: grouped.Item, held: work_admission.Claim,
                               on_delta: Callable[[str], None] | None = None,
                               *, who: quota.Principal) -> dict[str, object]:
    from server.app.inference import retry
    state = "unknown"
    try:
        result = await retry.run(lambda: _execute_grouped_round(item, held, on_delta, who=who))
        state = "succeeded"
        return result
    except HTTPException as error:
        if error.status_code < 500:
            state = "failed"
        raise
    finally:
        with anyio.CancelScope(shield=True):
            await anyio.to_thread.run_sync(partial(work_admission.finish, db, claim=held, state=state))


async def _execute_grouped_round(item: grouped.Item, held: work_admission.Claim,
                               on_delta: Callable[[str], None] | None = None,
                               *, who: quota.Principal) -> dict[str, object]:
    reservation: budget.Reservation | None = None
    cost: int | None = 0
    tokens: int = 0
    provider_id: str = ""
    execution_error: BaseException | None = None
    accumulator: streaming.CompletionAccumulator | None = None
    try:
        # Preparation cannot incur provider charges. Fail before reserving money.
        try:
            outbound = item.contract.payload
            json.dumps(outbound, allow_nan=False)
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            raise HTTPException(400, "Invalid structured request for the selected provider.") from error
        with anyio.CancelScope(shield=True):
            reservation = await anyio.to_thread.run_sync(partial(_reserve, who, item.contract.reserve_micros))
        # Leave a full work deadline inside the lease, including after slow ledger work.
        if time.time() + work_admission.WORK_SECONDS >= held.expires_at:
            raise HTTPException(409, "Admission lease is too close to expiry.")
        with anyio.fail_after(work_admission.WORK_SECONDS):
            async with httpx.AsyncClient(timeout=work_admission.WORK_SECONDS) as client:
                cost = None
                base = CFG.openrouter_base_url
                key = CFG.openrouter_key
                headers = {"Authorization": f"Bearer {key}", "X-Title": "SkellySpeak"}
                if on_delta is not None:
                    accumulator = streaming.CompletionAccumulator(tuple(provider_errors.request_strings({"json": outbound, "headers": headers})))
                    await stream_grouped_item(client, f"{base}/chat/completions", outbound, headers, on_delta, accumulator)
                    if accumulator.usage is not None:
                        cost, tokens = _usage_from({"usage": accumulator.usage})
                    provider_id = str(accumulator.top.get("id", ""))
                    ended = accumulator.end()
                    if ended == "provider_error":
                        error = accumulator.error if isinstance(accumulator.error, dict) else {}
                        status = error.get("code")
                        raise UpstreamHTTPError(status if type(status) is int and 400 <= status <= 599 else 502, "OPENROUTER",
                                                {"error": accumulator.partial("provider_error")["error"],
                                                 "partial": accumulator.partial("provider_error")})
                    if ended == "transport_broken":
                        raise StreamFailure("STREAM_BROKEN", accumulator.partial("transport_broken"))
                    payload = accumulator.completion()
                else:
                    payload = await provider_json(client, decisions.endpoint(base) if "questions" in outbound else f"{base}/chat/completions",
                        limit=4 * 1024 * 1024, provider="OPENROUTER", json=outbound, headers=headers)
        if payload.get("error"):
            raise HTTPException(502, "Invalid provider response.")
        provider_id = str(payload.get("id", ""))
        cost, tokens = _usage_from(payload)
        # A streamed item's result has exactly the non-streaming shape, so the
        # client's strict decoder and publication run unchanged on it.
        return {"type": "result", "response": decisions.completion(payload) if "questions" in outbound else payload}
    except BaseException as error:
        # Limit failures and the enclosing work timeout may bypass the normal
        # return from stream_grouped_item. Keep already received billing facts
        # for settlement, and expose the bounded metadata on timeout errors.
        if accumulator is not None:
            provider_id = str(accumulator.top.get("id", ""))
            if accumulator.usage is not None:
                try:
                    cost, tokens = _usage_from({"usage": accumulator.usage})
                except ValueError as invalid_usage:
                    details = accumulator.partial("invalid_usage")
                    details["validation"] = {"stage": "usage", "path": "usage",
                                             "expected": "nonnegative integer total_tokens and finite nonnegative cost"}
                    execution_error = StreamFailure("STREAM_BROKEN", details)
                    raise execution_error from invalid_usage
            if isinstance(error, TimeoutError):
                execution_error = StreamFailure("STREAM_BROKEN", accumulator.partial("timeout"))
                raise execution_error from error
        execution_error = error
        raise
    finally:
        with anyio.CancelScope(shield=True):
            try:
                if reservation is not None:
                    await _settle(reservation, cost=cost, tokens=tokens, provider_id=provider_id)
            except UsageUnknown:
                # Keep the original execution failure after conservative settlement.
                # Storage failures still propagate through the separate handler.
                if execution_error is None:
                    raise


@app.post("/v1/operations")
async def operations(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    body = await read_capped_body(request, MAX_JSON_BYTES, "Operation group")
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeError, RecursionError) as error:
        raise HTTPException(400, "Malformed operation group.") from error
    items = grouped.parse(payload, max_tokens=CFG.max_completion_tokens)
    return StreamingResponse(grouped.results(items, db=db, who=who, request_id=request.state.request_id,
        execute=partial(execute_grouped_item, who=who)), media_type="application/x-ndjson")


@app.post("/v1/audio/speech")
async def audio_speech(request: Request, who: quota.Principal = Depends(current_user)) -> Response:
    return await audio_service.synthesize(request, who, CFG, _reserve, _settle, read_capped_body)


@app.get("/v1/protocol")
async def protocol(who: quota.Principal = Depends(diagnostic_user), verify_providers: bool = False) -> dict[str, object]:
    result = {"protocol": "skellyspeak", "version": 1, "max_items": grouped.MAX_ITEMS,
            "operations_versions": list(grouped.SUPPORTED_VERSIONS),
            "chat_models": list(model_routing.RECOMMENDED_TEXT_MODELS),
            "accepts_other_text_models": True,
            "decisions": {"version": 1, "models": [decisions.MODEL]},
            "transcription_model": "whisper-large-v3",
            "audio": {"version": 1, "transcription_provider": "groq",
                      "transcription_models": ["whisper-large-v3", "whisper-large-v3-turbo"] + (["scribe_v2"] if CFG.elevenlabs_key else []),
                      "speech_provider": "elevenlabs", "speech_model": CFG.tts_model,
                      "speech_ready": bool(CFG.elevenlabs_key and CFG.elevenlabs_voice_id)}}
    if verify_providers:
        result["providers"] = await provider_health.check(CFG)
    return result


# Registered last to surround ingress and retain correlation through streamed bodies.
app.add_middleware(runtime.RequestActivity)


# Admin routes remain separate from the learner API and its daily diagnostic lane.
from server.app.diagnostics.admin_routes import build_router
app.include_router(build_router(lambda: db, lambda: CFG, _throttle_auth_start))
