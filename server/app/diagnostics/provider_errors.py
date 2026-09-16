"""Bounded provider error bodies, with request echoes and sensitive fields removed."""
from __future__ import annotations

import asyncio
import json
import re

import httpx

LIMIT = 16_384
FIELDS = {"error", "message", "type", "code", "param", "detail", "errors", "redacted_fields"}


def request_strings(value):
    if isinstance(value, str):
        if value.strip():
            yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from request_strings(item)
    elif isinstance(value, (tuple, list)):
        for item in value:
            yield from request_strings(item)


def scrub(text: str, private=()) -> str:
    for value in sorted(set(private), key=len, reverse=True):
        text = re.sub(r"(?<!\w)" + re.escape(value) + r"(?!\w)", "[redacted]", text) if len(value) < 8 else text.replace(value, "[redacted]")
    patterns = [
        r"(?i)\bBearer\s+[^\s,;<>]+",
        r"\b(?:sk-|gsk_)[A-Za-z0-9_-]+",
        r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
        r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
        r"https?://[^\s<>\"']+",
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b",
        r"\b[A-Za-z0-9_-]{40,}\b",
        r'''(?i)\b(?:api[_ -]?key|token|password|secret|authorization|user[_ -]?id|org(?:anization)?[_ -]?id)\s*[:=]\s*["']?[^\s,"'<>}]+''',
        # Quoted free-form values can be echoed prompts, names or credentials.
        r'''"[^"\n]*"|'[^'\n]*'|`[^`\n]*`''',
    ]
    for pattern in patterns:
        text = re.sub(pattern, "[redacted]", text)
    return " ".join(text.split())[:LIMIT]


def sanitize(value, private=(), depth=0):
    if depth > 6:
        return "[depth limit]"
    if isinstance(value, dict):
        result = {key: sanitize(item, private, depth + 1) for key, item in value.items() if key in FIELDS}
        omitted = len(value) - len(result)
        if omitted:
            result["redacted_fields"] = omitted
        return result
    if isinstance(value, list):
        return [sanitize(item, private, depth + 1) for item in value[:16]]
    if isinstance(value, str):
        return scrub(value, private)
    if value is None or type(value) in (int, bool, float):
        return value
    return "[redacted]"


def record(provider: str, status: int, body, request=None, *, truncated=False, unreadable=False):
    from server.app.diagnostics import runtime
    # Never collect audio bytes, file objects or response headers.
    private = tuple(request_strings(request))
    runtime.emit("provider_error_response", provider=provider, status=status,
                 response_body=sanitize(body, private), body_truncated=truncated,
                 body_unreadable=unreadable)


async def capture(response: httpx.Response, provider: str, request=None):
    """Read errors only; failure to read diagnostics must preserve the HTTP refusal."""
    body = bytearray()
    truncated = unreadable = False
    try:
        async with asyncio.timeout(5):
            async for chunk in response.aiter_bytes():
                remaining = LIMIT - len(body)
                body.extend(chunk[:remaining])
                if len(chunk) > remaining:
                    truncated = True
                    break
    except (httpx.HTTPError, TimeoutError):
        unreadable = True
    if truncated or unreadable:
        # Partial JSON cannot be field-filtered safely.
        value = "[response body exceeded limit or could not be fully read]"
    else:
        try:
            value = json.loads(body)
        except (ValueError, UnicodeError, RecursionError):
            value = body.decode("utf-8", errors="replace")
    record(provider, response.status_code, value, request, truncated=truncated, unreadable=unreadable)
