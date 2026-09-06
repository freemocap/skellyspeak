"""End-to-end proxy admission and settlement with a controlled upstream."""

from __future__ import annotations

import json
from collections.abc import Callable, AsyncIterator

import httpx
import pytest
import pytest_asyncio

import budget
import main
import quota
from test_budget import ledger
from test_quota import FakeDb


@pytest_asyncio.fixture
async def proxy(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setattr(main, "db", ledger)
    main.app.dependency_overrides[main.current_user] = lambda: quota.Principal(
        user_id="learner", daily_limit=500_000, overridden=False)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        yield client
    main.app.dependency_overrides.clear()


def upstream(monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]) -> None:
    real_client = httpx.AsyncClient

    def client(*, timeout: float) -> httpx.AsyncClient:
        return real_client(timeout=timeout, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(main.httpx, "AsyncClient", client)


def request(*, stream: bool) -> dict[str, object]:
    return {"model": "google/gemini-2.5-flash", "stream": stream,
            "messages": [{"role": "user", "content": "Hola"}], "max_tokens": 2000}


@pytest.mark.asyncio
async def test_rejected_routing_never_reserves(proxy: httpx.AsyncClient, ledger: FakeDb) -> None:
    payload = request(stream=False)
    payload["models"] = ["unpriced/model"]
    assert (await proxy.post("/v1/chat/completions", json=payload)).status_code == 400
    assert ledger.store == {}


@pytest.mark.asyncio
async def test_success_settles_reported_cost(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        body = json.loads(sent.content)
        assert body["provider"]["max_price"]["request"] == 0
        return httpx.Response(status_code=200, json={"id": "generation-1", "choices": [],
                                                   "usage": {"cost": 0.000035, "total_tokens": 10}})

    upstream(monkeypatch, respond)
    assert (await proxy.post("/v1/chat/completions", json=request(stream=False))).status_code == 200
    balance = quota.read_balance(ledger, "learner", limit=500_000)
    assert (balance.used, balance.tokens, balance.requests) == (35, 10, 1)


@pytest.mark.asyncio
async def test_truncated_stream_retains_reservation_and_reports_error(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, text='data: {"id":"generation-1","choices":[]}\n\n')

    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert '"error"' in response.text
    assert "[DONE]" not in response.text
    records = [value for path, value in ledger.store.items() if f"/{budget.RESERVATIONS}/" in path]
    assert len(records) == 1
    assert records[0]["status"] == "unknown"
    assert records[0]["actual_micros"] == records[0]["reserved_micros"]


@pytest.mark.asyncio
async def test_complete_stream_settles_before_done(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, text='data: {"id":"generation-1","usage":{"cost":0.000035,"total_tokens":10}}\n\ndata: [DONE]\n\n')

    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert "[DONE]" in response.text
    assert '"error"' not in response.text
    assert quota.read_balance(ledger, "learner", limit=500_000).used == 35
