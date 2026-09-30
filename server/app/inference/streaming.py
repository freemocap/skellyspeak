"""Bounded, UTF-8-safe decoding of provider SSE events.

`frames` preserves payloads and checks framing/resource bounds. The accumulator
observes only accounting/termination facts and content needed for error redaction.
Native code reconstructs the completion and decides whether it is usable.
"""

from __future__ import annotations
from server.app.diagnostics.exceptions import DiagnosticValueError

import json
from collections.abc import AsyncIterable, AsyncIterator
from server.app.diagnostics import provider_errors

MAX_EVENT_BYTES = 4 * 1024 * 1024
# Hard ceiling for a streamed response's text, in UTF-8 bytes. Exceeding it is
# an error, never a truncation; it matches the native response ceiling.
RESPONSE_TEXT_LIMIT = 262_144
MAX_TOP_FIELDS = 64


async def frames(chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, object] | None]:
    """Yield each event payload, then None for `[DONE]`. Raise only on framing."""
    pending = bytearray()
    data: list[str] = []
    event_size = 0
    total_size = 0
    async for chunk in chunks:
        total_size += len(chunk)
        if total_size > MAX_EVENT_BYTES:
            raise DiagnosticValueError("Provider stream exceeded its size limit.")
        if len(pending) + len(chunk) > MAX_EVENT_BYTES:
            raise DiagnosticValueError("Provider stream event exceeded its size limit.")
        pending.extend(chunk)
        while (end := pending.find(b"\n")) >= 0:
            raw_line = bytes(pending[:end]).rstrip(b"\r")
            del pending[:end + 1]
            line = raw_line.decode("utf-8", errors="strict")
            if line.startswith("data:"):
                event_size += len(raw_line)
                if event_size > MAX_EVENT_BYTES:
                    raise DiagnosticValueError("Provider stream event exceeded its size limit.")
                data.append(line[5:].removeprefix(" "))
            elif not line and data:
                raw = "\n".join(data)
                data.clear()
                event_size = 0
                if raw == "[DONE]":
                    if pending.strip():
                        raise DiagnosticValueError("Provider sent data after completion.")
                    yield None
                    return
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise DiagnosticValueError("Provider stream payload must be an object.")
                yield payload
    raise DiagnosticValueError("Provider stream ended without a completion marker.")


# The direct and grouped relays share framing; native interprets finish reasons.
events = frames


class ResponseLimitExceeded(Exception):
    def __init__(self, chars: int):
        super().__init__("Provider response exceeded its limit.")
        self.chars = chars


class CompletionAccumulator:
    """Bounded accounting, termination and diagnostic-redaction observations."""

    def __init__(self, private: tuple[str, ...] = ()) -> None:
        self.chars = 0
        self.wire_bytes = 0
        self.text_bytes = 0
        # Ephemeral, bounded content retained only to redact echoed error messages.
        # Never persisted, logged, or used to build the client's response.
        self.redaction_text = ""
        self.top: dict[str, object] = {}
        self.finish_reason: object = None
        self.native_finish_reason: object = None
        self.usage: dict[str, object] | None = None
        self.error: object = None
        self.done = False
        self.private = private
        self.http: dict[str, object] | None = None
        self.framing_error: dict | None = None

    def accept(self, payload: dict[str, object] | None) -> dict | None:
        """Observe bounded usage/termination facts; forward the original frame."""
        if payload is None:
            self.done = True
            return None
        for key, value in payload.items():
            if key == "choices":
                continue
            if key == "usage":
                if isinstance(value, dict):
                    self.usage = value
            elif key == "error":
                if value:
                    self.error = value
            elif len(self.top) < MAX_TOP_FIELDS or key in self.top:
                self.top[key] = value
        self.wire_bytes += len(json.dumps(payload, ensure_ascii=False).encode())
        if self.wire_bytes > MAX_EVENT_BYTES:
            raise ResponseLimitExceeded(self.chars)
        choices = payload.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            choice = choices[0]
            delta = choice.get("delta")
            content = delta.get("content") if isinstance(delta, dict) else None
            if isinstance(content, str) and content:
                size = len(content.encode("utf-8"))
                if self.text_bytes + size > RESPONSE_TEXT_LIMIT:
                    raise ResponseLimitExceeded(self.chars)
                self.redaction_text += content
                self.chars += len(content)
                self.text_bytes += size
            if choice.get("finish_reason") is not None:
                self.finish_reason = choice["finish_reason"]
            if choice.get("native_finish_reason") is not None:
                self.native_finish_reason = choice["native_finish_reason"]
        return payload

    def end(self) -> str:
        if self.error:
            return "provider_error"
        return "completed" if self.done else "transport_broken"

    def completion(self) -> dict[str, object]:
        """The client reconstructs content; this terminal only confirms completion."""
        result = {**self.top, "stream_complete": True}
        if self.usage is not None:
            result["usage"] = self.usage
        return result

    def partial(self, reason: str) -> dict[str, object]:
        """Bounded facts about an incomplete stream. Never its text."""
        private = self.private + ((self.redaction_text,) if self.redaction_text else ())
        return provider_errors.sanitize({**self.top, "stage": "stream", "reason": reason,
                "chars": self.chars, "finish_reason": self.finish_reason,
                "native_finish_reason": self.native_finish_reason, "usage": self.usage,
                "error": self.error, "http": self.http, "framing_error": self.framing_error}, private)
