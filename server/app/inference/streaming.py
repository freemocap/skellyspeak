"""Bounded, UTF-8-safe decoding of provider SSE events."""

from __future__ import annotations

import json
from collections.abc import AsyncIterable, AsyncIterator

MAX_EVENT_BYTES = 4 * 1024 * 1024


async def events(chunks: AsyncIterable[bytes]) -> AsyncIterator[dict[str, object] | None]:
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
                if payload.get("error"):
                    raise ValueError("Provider reported a streaming error.")
                for choice in payload.get("choices", []):
                    if choice.get("finish_reason") in {"length", "content_filter", "error"}:
                        raise ValueError("Provider stopped before completing the response.")
                yield payload
    raise ValueError("Provider stream ended without a completion marker.")
