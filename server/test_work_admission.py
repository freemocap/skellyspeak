"""Admission invariants under fake transactional storage; no inference calls."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import pytest
from fastapi import HTTPException

import work_admission as work
from test_budget import ledger
from test_quota import FakeDb

NOW = 2_000_000_000
DIGEST = "a" * 64


def key(index: int) -> str:
    return f"{NOW}-{index:032x}"


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(work.time, "time", lambda: float(NOW))


def test_duplicate_has_one_owner_and_account_scope(ledger: FakeDb) -> None:
    def acquire(_: int) -> work.Claim:
        return work.claim(ledger, user_id="one", attempt_id=key(1), digest=DIGEST)
    with ThreadPoolExecutor(max_workers=12) as pool:
        claims = list(pool.map(acquire, range(24)))
    assert sum(c.acquired for c in claims) == 1
    assert all(c.owner is None for c in claims if not c.acquired)
    assert work.claim(ledger, user_id="two", attempt_id=key(1), digest=DIGEST).acquired
    with pytest.raises(HTTPException) as error:
        work.claim(ledger, user_id="one", attempt_id=key(1), digest="b" * 64)
    assert error.value.status_code == 409


def test_capacity_is_atomic_and_completion_cannot_release_another_slot(ledger: FakeDb) -> None:
    def acquire(index: int) -> work.Claim | None:
        try:
            return work.claim(ledger, user_id="one", attempt_id=key(index), digest=DIGEST)
        except HTTPException as error:
            assert error.status_code == 429
            return None
    with ThreadPoolExecutor(max_workers=12) as pool:
        claims = [c for c in pool.map(acquire, range(24)) if c is not None]
    assert len(claims) == work.MAX_INFLIGHT
    first = claims[0]
    with pytest.raises(RuntimeError):
        work.finish(ledger, claim=replace(first, owner="wrong"), state="succeeded")
    work.finish(ledger, claim=first, state="succeeded")
    work.finish(ledger, claim=first, state="succeeded")
    assert acquire(100) is not None
    assert acquire(101) is None
    duplicate = work.claim(ledger, user_id="one", attempt_id=first.attempt_id, digest=DIGEST)
    assert not duplicate.acquired and duplicate.state == "succeeded"


def test_unknown_and_crashed_work_expire_without_reexecution(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    claims = [work.claim(ledger, user_id="one", attempt_id=key(i), digest=DIGEST) for i in range(work.MAX_INFLIGHT)]
    work.finish(ledger, claim=claims[0], state="unknown")
    with pytest.raises(HTTPException):
        work.claim(ledger, user_id="one", attempt_id=key(99), digest=DIGEST)
    monkeypatch.setattr(work.time, "time", lambda: float(NOW + work.LEASE_SECONDS))
    duplicate = work.claim(ledger, user_id="one", attempt_id=key(1), digest=DIGEST)
    assert duplicate.state == "unknown" and not duplicate.acquired
    assert work.claim(ledger, user_id="one", attempt_id=key(99), digest=DIGEST).acquired
    # A late completion only removes its own identity, never the replacement.
    work.finish(ledger, claim=claims[1], state="succeeded")
    assert key(99) in ledger.store["users/one/work_control/slots"]["active"]
    ledger.store.pop("users/one/work_attempts/" + key(1))
    monkeypatch.setattr(work.time, "time", lambda: float(NOW + work.RETENTION_SECONDS))
    with pytest.raises(HTTPException):
        work.claim(ledger, user_id="one", attempt_id=key(1), digest=DIGEST)


def test_invalid_input_does_not_write(ledger: FakeDb) -> None:
    for attempt in ("../bad", "x" * 10000, f"{NOW + 31}-" + "0" * 32):
        with pytest.raises(HTTPException):
            work.claim(ledger, user_id="one", attempt_id=attempt, digest=DIGEST)
    assert ledger.store == {}
