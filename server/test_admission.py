"""Request limits and signed admission proofs reject work before storage growth."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException

import admission
import auth
import budget
import quota
from test_budget import ledger
from test_quota import FakeDb


def test_shared_request_limit_is_atomic(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(admission, "GLOBAL_REQUESTS_PER_DAY", 5)

    def attempt(index: int) -> bool:
        try:
            admission.take(ledger, lane="account", subject=f"user-{index}")
            return True
        except HTTPException as error:
            assert error.status_code == 429
            return False

    with ThreadPoolExecutor(max_workers=12) as pool:
        assert sum(pool.map(attempt, range(24))) == 5
    assert ledger.store[f"admission/{quota.utc_day()}"]["account_requests"] == 5


def test_account_and_auth_limits_do_not_refund(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(admission, "ACCOUNT_REQUESTS_PER_DAY", 1)
    monkeypatch.setattr(admission, "AUTH_PER_DAY", 1)
    for lane, subject in (("account", "learner"), ("auth", "public")):
        admission.take(ledger, lane=lane, subject=subject)
        with pytest.raises(HTTPException) as failure:
            admission.take(ledger, lane=lane, subject=subject)
        assert failure.value.status_code == 429
    admission.take(ledger, lane="account", subject="another")


def test_local_ingress_expires_without_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(admission, "REQUESTS_PER_MINUTE", 1)
    monkeypatch.setattr(admission.time, "monotonic", lambda: 0)
    gate: admission.Ingress = admission.Ingress()
    gate.take()
    with pytest.raises(HTTPException):
        gate.take()
    monkeypatch.setattr(admission.time, "monotonic", lambda: 60)
    gate.take()


def test_signed_codes_cannot_cross_purposes_or_keys() -> None:
    code: str = auth.issue_code(purpose="login", signing_key="test-secret")
    auth.verify_issued_code(code, purpose="login", signing_key="test-secret")
    for candidate, purpose, key in ((code, "state", "test-secret"), (code, "login", "wrong"),
                                    (("B" if code[0] == "A" else "A") + code[1:], "login", "test-secret"), ("random", "login", "test-secret")):
        with pytest.raises(auth.AuthError):
            auth.verify_issued_code(candidate, purpose=purpose, signing_key=key)


def test_price_discrepancy_stays_blocked_after_midnight(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-01")
    held: budget.Reservation = budget.reserve(ledger, user_id="learner", micros=100, user_limit=1000, global_limit=1000)
    with pytest.raises(RuntimeError, match="exceeded"):
        budget.settle(ledger, reservation=held, actual_micros=101, tokens=1, status="settled", provider_id="test")
    monkeypatch.setattr(quota, "utc_day", lambda: "2099-01-02")
    with pytest.raises(quota.QuotaExceeded, match="paused"):
        budget.reserve(ledger, user_id="other", micros=1, user_limit=1000, global_limit=1000)
    assert "ttl" not in ledger.store["service_controls/spending"]


def test_device_registration_is_bounded_and_rejects_paths(ledger: FakeDb) -> None:
    for identifier in ("invalid", "a/b", "A" * 36):
        with pytest.raises(HTTPException) as failure:
            quota.record_device(ledger, "learner", install_id=identifier, platform="macos", app_version="test")
        assert failure.value.status_code == 400
    assert ledger.store == {}
    for index in range(quota.MAX_DEVICES):
        quota.record_device(ledger, "learner", install_id=f"00000000-0000-4000-8000-{index:012d}",
                            platform="macos", app_version="test")
    with pytest.raises(HTTPException) as failure:
        quota.record_device(ledger, "learner", install_id="00000000-0000-4000-8000-999999999999",
                            platform="macos", app_version="test")
    assert failure.value.status_code == 409
    quota.record_device(ledger, "learner", install_id="00000000-0000-4000-8000-000000000000",
                        platform="macos", app_version="next")
    assert len(ledger.store) == quota.MAX_DEVICES


def test_inference_flood_preserves_bounded_control_capacity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(admission.time, "monotonic", lambda: 0.0)
    gate: admission.AuthenticatedIngress = admission.AuthenticatedIngress()
    for index in range(4):
        for _ in range(admission.SUBJECT_LIMITS["inference"]):
            gate.take(f"learner-{index}", lane="inference")
    for _ in range(1000):
        with pytest.raises(HTTPException):
            gate.take("learner-0", lane="inference")
    for index in range(2):
        for _ in range(admission.SUBJECT_LIMITS["control"]):
            gate.take(f"learner-{index}", lane="control")
    with pytest.raises(HTTPException):
        gate.take("learner-2", lane="control")
    assert len(gate._total._hits) == sum(admission.PROCESS_LIMITS.values())
    assert len(gate._subjects) == 4


def test_control_flood_does_not_block_inference_and_windows_expire(monkeypatch: pytest.MonkeyPatch) -> None:
    now: list[float] = [0.0]
    monkeypatch.setattr(admission.time, "monotonic", lambda: now[0])
    gate: admission.AuthenticatedIngress = admission.AuthenticatedIngress()
    for index in range(2):
        for _ in range(admission.SUBJECT_LIMITS["control"]):
            gate.take(f"learner-{index}", lane="control")
    with pytest.raises(HTTPException):
        gate.take("learner-0", lane="control")
    gate.take("learner-0", lane="inference")
    now[0] = 60.0
    gate.take("learner-0", lane="control")
    gate.take("learner-0", lane="inference")
    assert len(gate._total._hits) == 2
