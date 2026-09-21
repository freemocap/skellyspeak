"""Bounded provider error bodies, with request echoes and sensitive fields removed."""
from __future__ import annotations

import asyncio
import json
import re

import httpx

LIMIT = 16_384
SAFE_TEXT = {"type", "code", "status", "param", "id", "request_id", "requestId", "model", "model_id", "requested_model", "actual_model", "provider", "provider_name", "finish_reason", "native_finish_reason", "detected_language", "language_code", "format", "cost_basis", "allowance_basis", "stage", "reason", "path", "expected", "exception_type", "name", "source_file", "function"}
CONTENT = {"answers", "questions", "state", "content", "text", "transcript", "prompt", "messages", "input", "output", "audio", "audio_base64", "data", "arguments", "reasoning", "reasoning_details", "file", "request", "body", "url", "user_id", "organization_id", "email", "headers", "authorization", "api_key", "key", "token", "password", "secret"}
TEXT_FIELDS = {"message", "detail", "error"}
HEADER_FIELDS = {"request-id", "x-request-id", "retry-after", "content-type", "processing-ms", "openai-processing-ms"}


def request_strings(value):
    if isinstance(value, str):
        if value.strip():
            yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            if key not in {"model", "model_id", "language", "language_code", "response_format"}:
                if key.lower() == "authorization" and isinstance(item, str) and item.startswith("Bearer "):
                    yield item[7:]
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
    ]
    for pattern in patterns:
        text = re.sub(pattern, "[redacted]", text)
    text = re.sub(r'''["'`]([^"'`\n]*)["'`]''',
                  lambda m: m.group(0) if re.fullmatch(r"[a-zA-Z0-9]+(?:[_/.-][a-zA-Z0-9]+)+", m[1]) else "[redacted]", text)
    text = " ".join(text.split())
    return text if len(text) <= 2048 else text[:2048] + "[truncated: string limit]"


def sanitize(value, private=(), depth=0, field="", budget=None):
    """Retain metadata; unknown strings and content get explicit redaction markers."""
    if budget is None:
        budget = [512]
    budget[0] -= 1
    if depth > 8 or budget[0] < 0:
        return "[truncated: metadata limit]"
    if isinstance(value, dict):
        result = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= 64:
                result["truncated_fields"] = len(value) - index
                break
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,63}", key) or key in private:
                result[f"redacted_field_{index}"] = "[redacted: field name]"
            elif key.lower() in CONTENT or any(part in key.lower() for part in ("secret", "password", "authorization", "api_key", "access_token")):
                result[key] = "[redacted: content or credential]"
            else:
                result[key] = sanitize(item, private, depth + 1, key, budget)
        return result
    if isinstance(value, list):
        items = [sanitize(item, private, depth + 1, field, budget) for item in value[:32]]
        if len(value) > 32:
            items.append({"truncated_items": len(value) - 32})
        return items
    if isinstance(value, str):
        if value.startswith(("[redacted", "[truncated", "[response body")):
            return value[:128]
        if field in SAFE_TEXT or field in {"request_id", "x_request_id", "retry_after", "content_type", "processing_ms", "openai_processing_ms"} or field.startswith(("x_ratelimit_", "ratelimit_")):
            if value in private:
                return "[redacted: request value]"
            if field in {"id", "request_id", "x_request_id", "requestId"} and re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", value) and not value.startswith(("sk-", "gsk_", "eyJ")):
                return value
            return scrub(value, private)
        if field in TEXT_FIELDS:
            return scrub(value, private)
        return "[redacted: unclassified string]"
    if value is None or type(value) in (int, bool, float):
        return value
    return "[redacted: unsupported value]"


def response_headers(response):
    kept = {name.replace("-", "_"): sanitize(value, field=name.replace("-", "_")) for name, value in response.headers.items()
            if name in HEADER_FIELDS or name.startswith(("x-ratelimit-", "ratelimit-"))}
    kept["redacted_header_count"] = len(response.headers) - len(kept)
    return kept


def reason(metadata):
    if not isinstance(metadata, dict):
        return None
    detail = metadata.get("detail", metadata.get("error", metadata))
    if not isinstance(detail, dict):
        return None
    return {key: detail[key] for key in ("code", "status", "type", "param", "message") if key in detail}


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
    private = tuple(request_strings(request))
    cleaned = sanitize(value, private)
    if not isinstance(cleaned, dict):
        cleaned = {"reason": "non_json_error_body", "body": "[redacted: unstructured content]"}
    cleaned["http"] = {"status": response.status_code, "response_headers": response_headers(response),
                       "truncated": truncated, "unreadable": unreadable}
    record(provider, response.status_code, cleaned, truncated=truncated, unreadable=unreadable)
    return cleaned
