"""Content-free runtime events shared by hosted and local diagnostics."""
from __future__ import annotations
from server.app.diagnostics.exceptions import DiagnosticValueError

import asyncio
from contextlib import asynccontextmanager
from contextvars import ContextVar
import json
import logging
import time
import uuid

log = logging.getLogger("skellyspeak.runtime")
request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
EVENTS = {
    "request_started", "request_finished", "request_failed", "request_cancelled",
    "response_progress", "client_disconnected", "runtime_started",
    "runtime_stopped", "decoder_check_started", "decoder_check_finished",
    "provider_credential_checked", "provider_retry_scheduled", "provider_error_response", "provider_headers", "provider_started", "provider_finished", "provider_failed", "provider_cancelled",
    "reservation_started", "reservation_finished", "reservation_failed",
    "settlement_started", "settlement_finished", "settlement_failed",
    "operation_started", "operation_claimed", "operation_duplicate", "operation_finished",
}
ROUTES = {"/health", "/v1/me", "/v1/diagnostics", "/v1/operations", "/v1/protocol",
          "/v1/chat/completions", "/v1/audio/speech", "/v1/audio/transcriptions", "/auth/start",
          "/auth/callback/google", "/auth/exchange", "unmatched",
          "/admin", "/admin/login", "/admin/logout", "/admin/api/overview", "/admin/api/timeline",
          "/admin/api/audit", "/admin/api/logs", "/admin/api/change",
          "/admin/api/users/{user_id}", "/admin/assets/{name}"}
ENUMS = {"credential_state": {"accepted", "rejected", "unreachable", "invalid_response"},"route": ROUTES, "method": {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "OTHER"},
         "provider": {"OPENROUTER", "GROQ", "ELEVENLABS", "UPSTREAM"}, "outcome": {"known", "unknown"}}
COUNTS = {"duration_ms", "bytes", "chunks", "item_index", "item_count", "micros", "tokens", "status"}


def sanitize(data: dict) -> dict:
    """Validate every field, including records submitted through ordinary logging."""
    if not isinstance(data.get("event"), str) or data["event"] not in EVENTS:
        return {}
    result = {"event": data["event"]}
    for key, values in ENUMS.items():
        if isinstance(data.get(key), str) and data[key] in values:
            result[key] = data[key]
    for key in COUNTS:
        value = data.get(key)
        if type(value) is int and 0 <= value <= 2**53:
            result[key] = value
    value = data.get("request_id")
    if isinstance(value, str) and len(value) == 32 and all(c in "0123456789abcdef" for c in value):
        result["request_id"] = value
    if data.get("diagnostics") is not None:
        from server.app.diagnostics.provider_errors import sanitize
        result["diagnostics"] = sanitize(data["diagnostics"])
    if data["event"] in {"provider_error_response", "provider_retry_scheduled"}:
        from server.app.diagnostics.provider_errors import sanitize
        result["response_body"] = sanitize(data.get("response_body"))
        for key in ("body_truncated", "body_unreadable"):
            if type(data.get(key)) is bool:
                result[key] = data[key]
    return result


def emit(event: str, **fields) -> None:
    data = sanitize({"event": event, "request_id": request_id.get(), **fields})
    if not data:
        raise DiagnosticValueError("Unknown runtime log event")
    level = logging.ERROR if event.endswith("failed") else logging.INFO
    log.log(level, json.dumps(data))


@asynccontextmanager
async def phase(name: str, **fields):
    started = time.monotonic()
    emit(f"{name}_started", **fields)
    try:
        yield
    except BaseException as error:
        suffix = "cancelled" if name == "provider" and isinstance(error, asyncio.CancelledError) else "failed"
        from server.app.diagnostics.exceptions import describe
        emit(f"{name}_{suffix}", diagnostics=describe(error), duration_ms=round((time.monotonic() - started) * 1000), **fields)
        raise
    else:
        emit(f"{name}_finished", duration_ms=round((time.monotonic() - started) * 1000), **fields)


class RequestActivity:
    """Observe the entire ASGI response, including stream completion and cancellation."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        identity = uuid.uuid4().hex
        token = request_id.set(identity)
        scope.setdefault("state", {})["request_id"] = identity
        route = scope.get("path")
        if isinstance(route, str):
            if route.startswith('/admin/api/users/') and route.count('/') == 4:
                route = '/admin/api/users/{user_id}'
            elif route.startswith('/admin/assets/') and route.count('/') == 3:
                route = '/admin/assets/{name}'
        fields = {"route": route if route in ROUTES else "unmatched",
                  "method": scope.get("method") if scope.get("method") in ENUMS["method"] else "OTHER"}
        started = last_progress = time.monotonic()
        size = chunks = 0
        status = 500
        complete = False
        emit("request_started", **fields)

        async def observed_receive():
            message = await receive()
            if message["type"] == "http.disconnect":
                emit("client_disconnected", **fields)
            return message

        async def observed_send(message):
            nonlocal size, chunks, status, complete, last_progress
            await send(message)
            if message["type"] == "http.response.start":
                status = message["status"]
            elif message["type"] == "http.response.body":
                size += len(message.get("body", b""))
                chunks += 1
                complete = not message.get("more_body", False)
                if time.monotonic() - last_progress >= 5:
                    emit("response_progress", bytes=size, chunks=chunks, **fields)
                    last_progress = time.monotonic()

        outcome = "request_finished"
        failure = None
        try:
            await self.app(scope, observed_receive, observed_send)
            if not complete:
                outcome = "request_cancelled"
        except asyncio.CancelledError:
            outcome = "request_cancelled"
            raise
        except BaseException as error:
            from server.app.diagnostics.exceptions import describe
            failure = describe(error)
            outcome = "request_failed"
            raise
        finally:
            try:
                emit(outcome, diagnostics=failure, status=status, bytes=size, chunks=chunks,
                     duration_ms=round((time.monotonic() - started) * 1000), **fields)
            finally:
                request_id.reset(token)
