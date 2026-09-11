"""Concurrent inference waits only at spending admission, without provider replay."""
from __future__ import annotations

import asyncio
from collections.abc import Callable

import httpx
import pytest

import budget
import main
import observability
import quota
from test_budget import ledger
from test_proxy import proxy, request
from test_quota import FakeDb


@pytest.fixture(autouse=True)
def admission_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "RESERVATION_DELAYS", (0.0, 0.01, 0.02, 0.04))
    monkeypatch.setattr(main, "_reservation_waiters", asyncio.Semaphore(2))


@pytest.mark.asyncio
async def test_parallel_calls_complete_while_only_unaffordable_work_waits(
    proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch,
) -> None:
    day: str = quota.utc_day()
    for path in (f"users/learner/usage/{day}", f"global_usage/{day}"):
        ledger.store[path] = {"micros": 157_546, "requests": 2, "tokens": 0}
    active: int = 0
    peak: int = 0
    provider_calls: int = 0
    all_running: asyncio.Event = asyncio.Event()
    release: asyncio.Event = asyncio.Event()
    rejected: asyncio.Event = asyncio.Event()
    loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
    original_reserve: Callable[..., budget.Reservation] = budget.reserve

    def reserve(db: FakeDb, *, user_id: str, micros: int, user_limit: int, global_limit: int) -> budget.Reservation:
        try:
            return original_reserve(db=db, user_id=user_id, micros=micros, user_limit=user_limit, global_limit=global_limit)
        except quota.QuotaExceeded:
            loop.call_soon_threadsafe(rejected.set)
            raise

    async def provider(sent: httpx.Request) -> httpx.Response:
        nonlocal active, peak, provider_calls
        provider_calls += 1
        active += 1
        peak = max(peak, active)
        if active == 3:
            all_running.set()
        try:
            await release.wait()
            return httpx.Response(status_code=200, json={"id": "test-generation", "choices": [],
                                                        "usage": {"cost": 0.000035, "total_tokens": 10}})
        finally:
            active -= 1

    real_client: type[httpx.AsyncClient] = httpx.AsyncClient

    def client(*, timeout: float) -> httpx.AsyncClient:
        return real_client(timeout=timeout, transport=httpx.MockTransport(provider))

    monkeypatch.setattr(budget, "reserve", reserve)
    monkeypatch.setattr(main.httpx, "AsyncClient", client)
    payload: dict[str, object] = request(stream=False)
    payload["max_tokens"] = 32_000
    tasks: list[asyncio.Task[httpx.Response]] = [
        asyncio.create_task(proxy.post("/v1/chat/completions", json=payload)) for _ in range(3)
    ]
    try:
        await asyncio.wait_for(all_running.wait(), timeout=2)
        tasks.append(asyncio.create_task(proxy.post("/v1/chat/completions", json=payload)))
        await asyncio.wait_for(rejected.wait(), timeout=2)
        assert provider_calls == 3
        assert not tasks[-1].done()
        release.set()
        responses: list[httpx.Response] = await asyncio.wait_for(asyncio.gather(*tasks), timeout=2)
        assert [response.status_code for response in responses] == [200] * 4
        assert peak == 3
        assert provider_calls == 4
        assert quota.read_balance(db=ledger, user_id="learner", limit=500_000).used == 157_686
        assert len([path for path in ledger.store if "/reservations/" in path]) == 4
    finally:
        release.set()
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


@pytest.mark.asyncio
@pytest.mark.parametrize("code,expected_attempts", [
    ("PERSONAL_ALLOWANCE_EXHAUSTED", 4), ("SHARED_ALLOWANCE_EXHAUSTED", 4), ("SPENDING_PAUSED", 1),
])
async def test_admission_rechecks_are_finite_and_do_not_dispatch(
    code: str, expected_attempts: int, monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts: int = 0

    def refuse(db: FakeDb, *, user_id: str, micros: int, user_limit: int, global_limit: int) -> budget.Reservation:
        nonlocal attempts
        attempts += 1
        raise quota.QuotaExceeded("Test refusal", code=code)

    monkeypatch.setattr(budget, "reserve", refuse)
    with pytest.raises(observability.Rejection) as error:
        await main._reserve(who=quota.Principal(user_id="learner", daily_limit=500_000, overridden=False), micros=100_000)
    assert error.value.code == code
    assert attempts == expected_attempts
    assert main._reservation_waiters._value == 2


@pytest.mark.asyncio
async def test_cancelled_budget_wait_releases_capacity_without_late_reservation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempted: asyncio.Event = asyncio.Event()
    loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
    attempts: int = 0

    def refuse(db: FakeDb, *, user_id: str, micros: int, user_limit: int, global_limit: int) -> budget.Reservation:
        nonlocal attempts
        attempts += 1
        loop.call_soon_threadsafe(attempted.set)
        raise quota.QuotaExceeded("Test refusal", code="PERSONAL_ALLOWANCE_EXHAUSTED")

    monkeypatch.setattr(budget, "reserve", refuse)
    monkeypatch.setattr(main, "RESERVATION_DELAYS", (0.0, 60.0))
    task: asyncio.Task[budget.Reservation] = asyncio.create_task(main._reserve(
        who=quota.Principal(user_id="learner", daily_limit=500_000, overridden=False), micros=100_000))
    await asyncio.wait_for(attempted.wait(), timeout=2)
    # Allow the failed worker's result to reach the admission wait.
    for _ in range(100):
        if main._reservation_waiters._value == 1:
            break
        await asyncio.sleep(0.001)
    assert main._reservation_waiters._value == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert attempts == 1
    assert main._reservation_waiters._value == 2


@pytest.mark.asyncio
async def test_full_wait_capacity_fails_without_an_unbounded_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(db: FakeDb, *, user_id: str, micros: int, user_limit: int, global_limit: int) -> budget.Reservation:
        raise quota.QuotaExceeded("Test refusal", code="PERSONAL_ALLOWANCE_EXHAUSTED")

    monkeypatch.setattr(budget, "reserve", refuse)
    for _ in range(2):
        await main._reservation_waiters.acquire()
    with pytest.raises(main.HTTPException) as error:
        await main._reserve(who=quota.Principal(user_id="learner", daily_limit=500_000, overridden=False), micros=100_000)
    assert error.value.status_code == 503
    assert main._reservation_waiters._value == 0


@pytest.mark.asyncio
async def test_request_larger_than_entire_allowance_never_waits(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(db: FakeDb, *, user_id: str, micros: int, user_limit: int, global_limit: int) -> budget.Reservation:
        raise quota.QuotaExceeded("Test refusal", code="PERSONAL_ALLOWANCE_EXHAUSTED")

    async def forbidden_wait(delay: float) -> None:
        raise AssertionError("An impossible reservation must not wait")

    monkeypatch.setattr(budget, "reserve", refuse)
    monkeypatch.setattr(main.asyncio, "sleep", forbidden_wait)
    with pytest.raises(observability.Rejection):
        await main._reserve(who=quota.Principal(user_id="learner", daily_limit=50_000, overridden=False), micros=100_000)
