"""Provider streams preserve Unicode and cannot silently truncate."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

import streaming


async def chunks(parts: list[bytes]) -> AsyncIterator[bytes]:
    for part in parts:
        yield part


@pytest.mark.asyncio
async def test_every_unicode_chunk_boundary() -> None:
    stream = 'data: {"text":"العربية 中文 español"}\r\n\r\ndata: [DONE]\r\n\r\n'.encode()
    for boundary in range(len(stream) + 1):
        result = [event async for event in streaming.events(chunks([stream[:boundary], stream[boundary:]]))]
        assert result == [{"text": "العربية 中文 español"}, None]


@pytest.mark.asyncio
@pytest.mark.parametrize("stream", [
    b'data: {"text":"incomplete"}\n\n', b'data: not-json\n\n',
    b'data: {"error":{"message":"upstream failed"}}\n\n',
    b'data: {"choices":[{"finish_reason":"length"}]}\n\n',
    b'data: "\xff"\n\n',
])
async def test_bad_streams_fail(stream: bytes) -> None:
    with pytest.raises(ValueError):
        _ = [event async for event in streaming.events(chunks([stream]))]
