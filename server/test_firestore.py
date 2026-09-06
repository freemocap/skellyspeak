"""Integration checks against a real, local Firestore emulator."""

from __future__ import annotations

import os
import secrets
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from threading import Barrier

import pytest
from google.cloud import firestore

import auth
import auth_store
import budget
import quota

pytestmark = pytest.mark.skipif(os.environ.get("SKELLYSPEAK_FIRESTORE_TEST") != "1",
                                reason="Requires an explicitly enabled local Firestore emulator")


def database() -> firestore.Client:
    if os.environ.get("FIRESTORE_EMULATOR_HOST") != "127.0.0.1:8787":
        raise RuntimeError("Integration tests may only access the loopback emulator on port 8787.")
    return firestore.Client(project=f"audit-{secrets.token_hex(6)}")


def test_real_transactions_bound_simultaneous_admissions() -> None:
    db = database()
    barrier = Barrier(12)

    def admit(index: int) -> bool:
        barrier.wait(timeout=10)
        try:
            budget.reserve(db, user_id=f"user-{index}", micros=100, user_limit=1000, global_limit=600)
            return True
        except quota.QuotaExceeded:
            return False

    with ThreadPoolExecutor(max_workers=12) as pool:
        assert sum(pool.map(admit, range(12))) == 6
    assert db.collection(quota.GLOBAL_USAGE).document(quota.utc_day()).get().to_dict()["micros"] == 600


def test_real_settlement_is_idempotent_across_midnight(monkeypatch: pytest.MonkeyPatch) -> None:
    db = database()
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-01")
    reservation = budget.reserve(db, user_id="learner", micros=100, user_limit=1000, global_limit=1000)
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-02")
    for _ in range(2):
        budget.settle(db, reservation=reservation, actual_micros=35, tokens=10,
                      status="settled", provider_id="generation-1")
    assert db.collection(quota.GLOBAL_USAGE).document("2099-01-01").get().to_dict()["micros"] == 35
    assert quota.read_balance(db, "learner", limit=1000).used == 0


def test_real_code_exchange_has_one_winner() -> None:
    db = database()
    code = secrets.token_urlsafe(24)
    db.collection(quota.LOGIN_CODES).document(code).set({"expires_at": 9_999_999_999})
    barrier = Barrier(2)

    def validate(stored: dict[str, object]) -> None:
        assert stored["expires_at"] == 9_999_999_999

    def exchange(index: int) -> bool:
        barrier.wait(timeout=10)
        try:
            auth_store.consume(db, collection=quota.LOGIN_CODES, code=code, validate=validate)
            return True
        except auth.AuthError:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(exchange, range(2))) == 1


def process_admission(project: str, index: int) -> bool:
    if os.environ.get('FIRESTORE_EMULATOR_HOST') != '127.0.0.1:8787':
        raise RuntimeError('Only the local emulator is permitted')
    db = firestore.Client(project=project)
    try:
        budget.reserve(db, user_id=f'process-{index}', micros=100, user_limit=1000, global_limit=600)
        return True
    except quota.QuotaExceeded:
        return False
    finally:
        db.close()


def test_independent_server_processes_share_one_ceiling() -> None:
    db = database()
    with ProcessPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(process_admission, [db.project] * 12, range(12)))
    assert sum(results) == 6
    assert db.collection(quota.GLOBAL_USAGE).document(quota.utc_day()).get().to_dict()['micros'] == 600
