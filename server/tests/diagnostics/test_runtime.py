"""Full response lifetime and concurrency-safe, content-free correlation."""
import asyncio
import json
import logging

import pytest

from server.app.diagnostics import runtime


@pytest.mark.asyncio
async def test_stream_lifetime_and_concurrent_correlation(caplog):
    caplog.set_level(logging.INFO, logger="skellyspeak.runtime")
    async def app(scope, receive, send):
        runtime.emit("provider_started", provider="OPENROUTER")
        await asyncio.sleep(0)
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"private", "more_body": True})
        runtime.emit("provider_finished", provider="OPENROUTER")
        await send({"type": "http.response.body", "body": b" text"})
    async def receive():
        return {"type": "http.request"}
    async def send(message):
        pass
    async def run():
        await runtime.RequestActivity(app)({"type": "http", "path": "/private-path", "method": "GET"}, receive, send)
    await asyncio.gather(run(), run())
    events = [json.loads(r.message) for r in caplog.records]
    ids = {e["request_id"] for e in events}
    assert len(ids) == 2
    for identity in ids:
        rows = [e for e in events if e["request_id"] == identity]
        assert [e["event"] for e in rows] == ["request_started", "provider_started", "provider_finished", "request_finished"]
        assert rows[-1]["bytes"] == 12 and rows[-1]["chunks"] == 2
    assert "private" not in caplog.text
    assert runtime.request_id.get() is None


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [RuntimeError("private-secret"), asyncio.CancelledError()])
async def test_failed_response_resets_context(error, caplog):
    caplog.set_level(logging.INFO, logger="skellyspeak.runtime")
    async def app(*args):
        raise error
    with pytest.raises(type(error)):
        await runtime.RequestActivity(app)({"type": "http", "path": "/health", "method": "GET"}, None, None)
    assert runtime.request_id.get() is None
    assert "private-secret" not in caplog.text
    assert json.loads(caplog.records[-1].message)["event"] == (
        "request_cancelled" if isinstance(error, asyncio.CancelledError) else "request_failed")

