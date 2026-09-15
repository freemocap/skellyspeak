"""Bounded, allowlisted diagnostics. Never log headers, bodies, URLs or identities."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
import os
import uuid
import time

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

log = logging.getLogger("skellyspeak.requests")


def reset_at() -> str:
    now = datetime.now(timezone.utc)
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


class Rejection(HTTPException):
    def __init__(self, code: str, detail: str, *, daily: bool = False, retry: int | None = None):
        super().__init__(429, detail, headers={"Retry-After": str(retry)} if retry is not None else None)
        self.code = code
        self.resets_at = reset_at() if daily else None


def error_response(request: Request, error: HTTPException) -> JSONResponse:
    code = getattr(error, "code", {
        400: "INVALID_REQUEST", 401: "AUTHENTICATION_REQUIRED", 403: "ACCESS_DENIED",
        404: "NOT_FOUND", 429: "RATE_LIMITED", 502: "UPSTREAM_FAILURE",
    }.get(error.status_code, "REQUEST_REJECTED"))
    request.state.error_code = code
    return JSONResponse(status_code=error.status_code, headers=error.headers,
                        content={"detail": error.detail, "code": code,
                                 "request_id": request.state.request_id,
                                 "resets_at": getattr(error, "resets_at", None)})


async def observe(request: Request, call_next, ingress, admit=None):
    # Ignore client-provided IDs: they can contain secrets, log injection or collisions.
    request.state.request_id = uuid.uuid4().hex
    request.state.error_code = None
    started = time.monotonic()
    try:
        admit() if admit is not None else ingress.take()
        response = await call_next(request)
    except HTTPException as error:
        response = error_response(request, error)
    except Exception as error:
        request.state.exception_type = type(error).__name__
        request.state.error_code = "INTERNAL_ERROR"
        response = JSONResponse(status_code=500, content={
            "detail": "The service could not complete this request.",
            "code": "INTERNAL_ERROR", "request_id": request.state.request_id,
        })
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    route = request.scope.get("route")
    log.info(json.dumps({"event": "request_headers", "severity": "ERROR" if response.status_code >= 500 else "WARNING" if response.status_code >= 400 else "INFO", "request_id": request.state.request_id,
        "route": getattr(route, "path", "unmatched"), "status": response.status_code,
        "code": request.state.error_code,
        "exception_type": getattr(request.state, "exception_type", None),
        "duration_ms": round((time.monotonic() - started) * 1000),
        "revision": os.environ.get("K_REVISION", "local")[:128]}))
    return response
