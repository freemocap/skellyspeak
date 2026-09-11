"""Legacy endpoint ownership under request cancellation; no real provider or DB."""
from __future__ import annotations

import json
import threading

import anyio
import pytest
from starlette.requests import ClientDisconnect, Request

import budget
import main
import quota
from test_budget import ledger
from test_quota import FakeDb


def incoming(audio: bool = False, streaming: bool = False) -> Request:
    body = b"synthetic audio" if audio else json.dumps({
        "model": "google/gemini-2.5-flash", "stream": streaming,
        "messages": [{"role": "user", "content": "synthetic"}], "max_tokens": 2000,
    }).encode()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request({"type": "http", "method": "POST", "path": "/",
                    "headers": [(b"content-type", b"multipart/form-data; boundary=test" if audio else b"application/json")]}, receive)


def records(db: FakeDb):
    return [value for path, value in db.store.items() if f"/{budget.RESERVATIONS}/" in path]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["chat", "stream", "audio"])
async def test_cancel_during_reservation_keeps_cleanup_owner(
    kind: str, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main, "db", ledger)
    started = threading.Event()
    release = threading.Event()
    reserve = main._reserve
    settlements = []
    settle = main._settle

    def delayed(*args):
        started.set()
        assert release.wait(5), "test failed to release transaction"
        return reserve(*args)

    async def counted(*args, **kwargs):
        settlements.append(kwargs["cost"])
        await settle(*args, **kwargs)

    def no_provider(*args, **kwargs):
        pytest.fail("cancelled reservation must not submit provider work")

    monkeypatch.setattr(main, "_reserve", delayed)
    monkeypatch.setattr(main, "_settle", counted)
    monkeypatch.setattr(main.httpx, "AsyncClient", no_provider)
    who = quota.Principal(user_id="learner", daily_limit=500_000, overridden=False)
    scopes = []

    async def run():
        with anyio.CancelScope() as scope:
            scopes.append(scope)
            if kind == "audio":
                await main.transcriptions(incoming(audio=True), who)
            else:
                await main.chat_completions(incoming(streaming=kind == "stream"), who)
            pytest.fail("pending cancellation was not delivered")

    async with anyio.create_task_group() as tasks:
        tasks.start_soon(run)
        assert await anyio.to_thread.run_sync(started.wait, 5)
        scopes[0].cancel()
        release.set()
    assert settlements == [0]
    assert len(records(ledger)) == 1
    assert records(ledger)[0]["status"] == "settled"
    assert records(ledger)[0]["actual_micros"] == 0
    assert quota.read_balance(ledger, "learner", limit=500_000).used == 0
    assert not main._audio_slots.locked()


@pytest.mark.asyncio
async def test_stream_disconnect_before_generator_start_refunds_once(
    ledger: FakeDb, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main, "db", ledger)
    who = quota.Principal(user_id="learner", daily_limit=500_000, overridden=False)
    response = await main.chat_completions(incoming(streaming=True), who)
    settlements = []
    settle = main._settle

    async def counted(*args, **kwargs):
        settlements.append(kwargs["cost"])
        await settle(*args, **kwargs)

    monkeypatch.setattr(main, "_settle", counted)

    async def send(message):
        assert message["type"] == "http.response.start"
        raise OSError("synthetic disconnected client")

    async def receive():
        pytest.fail("ASGI 2.4 should detect disconnect on send")

    with pytest.raises(ClientDisconnect):
        await response({"type": "http", "asgi": {"spec_version": "2.4"}}, receive, send)
    assert settlements == [0]
    assert records(ledger)[0]["status"] == "settled"
    assert records(ledger)[0]["actual_micros"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["chat", "stream", "audio"])
async def test_cancel_after_submission_keeps_unknown_reservation(
    kind: str, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch,
) -> None:
    import httpx
    from types import SimpleNamespace

    monkeypatch.setattr(main, "db", ledger)
    submitted = anyio.Event()
    count = 0
    settlements = []
    settle = main._settle

    async def counted(*args, **kwargs):
        settlements.append(kwargs["cost"])
        await settle(*args, **kwargs)

    async def upstream(request):
        nonlocal count
        count += 1
        submitted.set()
        await anyio.sleep_forever()

    real_client = httpx.AsyncClient
    monkeypatch.setattr(main.httpx, "AsyncClient", lambda **kwargs: real_client(
        **kwargs, transport=httpx.MockTransport(upstream)))
    monkeypatch.setattr(main, "_settle", counted)
    monkeypatch.setattr(main.audio_input, "decode_upload", lambda *args, **kwargs:
                        SimpleNamespace(cost_micros=1, pcm=b"\0\0", fields={"model": "whisper-large-v3"}))
    who = quota.Principal(user_id="learner", daily_limit=500_000, overridden=False)
    scopes = []

    async def run():
        # Existing accounting intentionally raises after recording unknown usage.
        with pytest.raises(main.UsageUnknown):
            with anyio.CancelScope() as scope:
                scopes.append(scope)
                if kind == "audio":
                    await main.transcriptions(incoming(audio=True), who)
                else:
                    response = await main.chat_completions(incoming(streaming=kind == "stream"), who)
                    if kind == "stream":
                        await anext(response.body_iterator)

    async with anyio.create_task_group() as tasks:
        tasks.start_soon(run)
        with anyio.fail_after(5):
            await submitted.wait()
        scopes[0].cancel()
    assert count == 1
    assert settlements == [None]
    assert len(records(ledger)) == 1
    assert records(ledger)[0]["status"] == "unknown"
    assert records(ledger)[0]["actual_micros"] == records(ledger)[0]["reserved_micros"]
