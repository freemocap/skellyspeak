"""Exercise interleaved admission, rollback, and exactly-once settlement."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from threading import Barrier, RLock
from collections.abc import Callable, Iterator
from typing import TypeVar

import pytest
from google.cloud import firestore

import auth
import auth_store
import budget
import quota
from test_quota import FakeDb, FakeTransaction, FakeDocRef

T = TypeVar("T")


@pytest.fixture
def ledger(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeDb]:
    db = FakeDb()
    lock = RLock()

    def transactional(fn: Callable[[FakeTransaction], T]) -> Callable[[FakeTransaction], T]:
        def run(transaction: FakeTransaction) -> T:
            with lock:
                before = deepcopy(db.store)
                try:
                    return fn(transaction)
                except BaseException:
                    db.store.clear()
                    db.store.update(before)
                    raise
        return run

    def delete(transaction: FakeTransaction, ref: FakeDocRef) -> None:
        del db.store[ref.path]

    monkeypatch.setattr(firestore, "transactional", transactional)
    monkeypatch.setattr(FakeTransaction, "delete", delete, raising=False)
    yield db


def reserve(db: FakeDb) -> budget.Reservation:
    return budget.reserve(db, user_id="google:1", micros=100, user_limit=1000, global_limit=1000)


def test_simultaneous_admissions_cannot_overspend(ledger: FakeDb) -> None:
    barrier = Barrier(20)

    def admit(index: int) -> bool:
        barrier.wait(timeout=5)
        try:
            reserve(ledger)
            return True
        except quota.QuotaExceeded:
            return False

    with ThreadPoolExecutor(max_workers=20) as pool:
        assert sum(pool.map(admit, range(20))) == 10
    assert quota.read_balance(ledger, "google:1", limit=1000).used == 1000
    assert ledger.store[f"global_usage/{quota.utc_day()}"]["micros"] == 1000


def test_midnight_settlement_is_dated_and_idempotent(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-01")
    reservation = reserve(ledger)
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-02")
    for _ in range(2):
        budget.settle(ledger, reservation=reservation, actual_micros=35, tokens=10,
                      status="settled", provider_id="generation-1")
    assert ledger.store["users/google:1/usage/2099-01-01"]["micros"] == 35
    assert quota.read_balance(ledger, "google:1", limit=1000).used == 0


def test_partial_writes_roll_back(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    original = FakeTransaction.set

    def fail_shared(transaction: FakeTransaction, ref: FakeDocRef, data: dict[str, object], merge: bool = False) -> None:
        if ref.path.startswith("global_usage/"):
            raise RuntimeError("Injected database failure")
        original(transaction, ref, data, merge=merge)

    monkeypatch.setattr(FakeTransaction, "set", fail_shared)
    with pytest.raises(RuntimeError, match="Injected"):
        reserve(ledger)
    assert ledger.store == {}


def test_unknown_cost_stays_reserved_until_reconciled(ledger: FakeDb) -> None:
    reservation = reserve(ledger)
    budget.settle(ledger, reservation=reservation, actual_micros=100, tokens=2,
                  status="unknown", provider_id="generation-1")
    assert quota.read_balance(ledger, "google:1", limit=1000).used == 100
    budget.settle(ledger, reservation=reservation, actual_micros=30, tokens=10,
                  status="settled", provider_id="generation-1")
    balance = quota.read_balance(ledger, "google:1", limit=1000)
    assert (balance.used, balance.tokens, balance.requests) == (30, 10, 1)


def test_invalid_verifier_does_not_burn_a_code_and_only_one_exchange_wins(ledger: FakeDb) -> None:
    code = "c" * 43
    verifier = auth.new_code_verifier()
    ledger.store[f"login_codes/{code}"] = {
        "expires_at": 9_999_999_999, "code_challenge": auth.s256_challenge(verifier),
    }

    def invalid(stored: dict[str, object]) -> None:
        auth.verify_code_verifier("x" * 43, challenge=str(stored["code_challenge"]))

    def valid(stored: dict[str, object]) -> None:
        auth.verify_code_verifier(verifier, challenge=str(stored["code_challenge"]))

    with pytest.raises(auth.AuthError):
        auth_store.consume(ledger, collection="login_codes", code=code, validate=invalid)
    barrier = Barrier(2)

    def exchange(index: int) -> bool:
        barrier.wait(timeout=5)
        try:
            auth_store.consume(ledger, collection="login_codes", code=code, validate=valid)
            return True
        except auth.AuthError:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(exchange, range(2))) == 1


@pytest.mark.parametrize('missing', [('personal',), ('global',), ('personal', 'global')])
def test_verified_historical_settlement_does_not_recreate_expired_ledgers(ledger, monkeypatch, missing):
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-01-01')
    reservation = reserve(ledger)
    budget.settle(ledger, reservation=reservation, actual_micros=100, tokens=2,
                  status='unknown', provider_id='gen-history')
    paths = {'personal': 'users/google:1/usage/2026-01-01', 'global': 'global_usage/2026-01-01'}
    for key in missing:
        del ledger.store[paths[key]]
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-05-01')
    with pytest.raises(RuntimeError, match='Daily ledger is missing'):
        budget.settle(ledger, reservation=reservation, actual_micros=30, tokens=5,
                      status='settled', provider_id='gen-history')
    for _ in range(2):
        budget.settle(ledger, reservation=reservation, actual_micros=30, tokens=5,
                      status='settled', provider_id='gen-history', allow_expired_ledgers=True)
    for key, path in paths.items():
        if key in missing:
            assert path not in ledger.store
        else:
            assert ledger.store[path]['micros'] == 30
            assert ledger.store[path]['tokens'] == 5
    record = ledger.store[f'users/google:1/reservations/{reservation.request_id}']
    assert record['historical_finalization'] is True
    assert record['status'] == 'settled' and 'ttl' in record


def test_historical_opt_in_does_not_excuse_young_missing_ledger(ledger):
    reservation = reserve(ledger)
    del ledger.store[f'global_usage/{reservation.day}']
    with pytest.raises(RuntimeError, match='Daily ledger is missing'):
        budget.settle(ledger, reservation=reservation, actual_micros=30, tokens=5,
                      status='settled', provider_id='gen-history', allow_expired_ledgers=True)


def test_historical_overage_still_pauses_spending_without_recreating_ledger(ledger, monkeypatch):
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-01-01')
    reservation = reserve(ledger)
    del ledger.store['global_usage/2026-01-01']
    del ledger.store['users/google:1/usage/2026-01-01']
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-05-01')
    with pytest.raises(RuntimeError, match='exceeded its reserved price ceiling'):
        budget.settle(ledger, reservation=reservation, actual_micros=101, tokens=5,
                      status='settled', provider_id='gen-history', allow_expired_ledgers=True)
    assert ledger.store['service_controls/spending']['blocked'] is True
    assert not any('/usage/' in key or key.startswith('global_usage/') for key in ledger.store)
