"""Bounded, UTF-8-safe decoding of provider SSE events.

`frames` only frames events: lines, UTF-8, size limits and the `[DONE]` marker.
It makes no judgement about errors or finish reasons, so nothing the provider
sent is lost. `events` adds the strict judgement the chat relay relies on, and
`CompletionAccumulator` keeps text, finish reasons, trailing usage and
metadata so a completed stream becomes an ordinary completion object.
"""

from __future__ import annotations

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
    async for chunk in chunks:
        if len(pending) + len(chunk) > MAX_EVENT_BYTES:
            raise ValueError("Provider stream event exceeded its size limit.")
        pending.extend(chunk)
        while (end := pending.find(b"\n")) >= 0:
            raw_line = bytes(pending[:end]).rstrip(b"\r")
            del pending[:end + 1]
            line = raw_line.decode("utf-8", errors="strict")
            if line.startswith("data:"):
                event_size += len(raw_line)
                if event_size > MAX_EVENT_BYTES:
                    raise ValueError("Provider stream event exceeded its size limit.")
                data.append(line[5:].removeprefix(" "))
            elif not line and data:
                raw = "\n".join(data)
                data.clear()
                event_size = 0
                if raw == "[DONE]":
                    if pending.strip():
                        raise ValueError("Provider sent data after completion.")
                    yield None
                    return
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError("Provider stream payload must be an object.")
                yield payload
    raise ValueError("Provider stream ended without a completion marker.")


async def events(chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, object] | None]:
    """Frames, failing on provider errors and incomplete finishes."""
    async for payload in frames(chunks):
        if payload is None:
            yield None
            return
        if payload.get("error"):
            raise ValueError("Provider reported a streaming error.")
        for choice in payload.get("choices", []):
            if choice.get("finish_reason") in {"length", "content_filter", "error"}:
                raise ValueError("Provider stopped before completing the response.")
        yield payload


class ResponseLimitExceeded(Exception):
    def __init__(self, chars: int):
        super().__init__("Provider response exceeded its limit.")
        self.chars = chars


class CompletionAccumulator:
    """Everything a provider stream carried, rebuilt as a completion."""

    def __init__(self, private: tuple[str, ...] = ()) -> None:
        self.text = ""
        self.text_bytes = 0
        self.top: dict[str, object] = {}
        self.finish_reason: object = None
        self.native_finish_reason: object = None
        self.usage: dict[str, object] | None = None
        self.error: object = None
        self.done = False
        self.private = private
        self.http: dict[str, object] | None = None

    def accept(self, payload: dict[str, object] | None) -> str:
        """Take one frame; return the text it added."""
        if payload is None:
            self.done = True
            return ""
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
        added = ""
        choices = payload.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], dict):
            choice = choices[0]
            delta = choice.get("delta")
            content = delta.get("content") if isinstance(delta, dict) else None
            if isinstance(content, str) and content:
                size = len(content.encode("utf-8"))
                if self.text_bytes + size > RESPONSE_TEXT_LIMIT:
                    raise ResponseLimitExceeded(len(self.text))
                self.text += content
                self.text_bytes += size
                added = content
            if choice.get("finish_reason") is not None:
                self.finish_reason = choice["finish_reason"]
            if choice.get("native_finish_reason") is not None:
                self.native_finish_reason = choice["native_finish_reason"]
        return added

    def end(self) -> str:
        if self.error:
            return "provider_error"
        return "completed" if self.done else "transport_broken"

    def completion(self) -> dict[str, object]:
        """The non-streaming completion this stream is equivalent to."""
        choice: dict[str, object] = {"index": 0, "message": {"role": "assistant", "content": self.text},
                                     "finish_reason": self.finish_reason}
        if self.native_finish_reason is not None:
            choice["native_finish_reason"] = self.native_finish_reason
        result: dict[str, object] = {**self.top, "object": "chat.completion", "choices": [choice]}
        if self.usage is not None:
            result["usage"] = self.usage
        return result

    def partial(self, reason: str) -> dict[str, object]:
        """Bounded facts about an incomplete stream. Never its text."""
        private = self.private + ((self.text,) if self.text else ())
        return provider_errors.sanitize({**self.top, "stage": "stream", "reason": reason,
                "chars": len(self.text), "finish_reason": self.finish_reason,
                "native_finish_reason": self.native_finish_reason, "usage": self.usage,
                "error": self.error, "http": self.http}, private)
