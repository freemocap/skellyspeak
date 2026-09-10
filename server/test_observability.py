from __future__ import annotations
import json
import logging
import httpx
import pytest
from fastapi.security import HTTPAuthorizationCredentials
import main
import admission
import budget
import quota
import observability
import diagnostics
from test_budget import ledger

@pytest.mark.asyncio
async def test_diagnostics_requires_authentication_without_database_access(monkeypatch):
    class Forbidden:
        def collection(self, *args):
            raise AssertionError("Unauthenticated database read")
    monkeypatch.setattr(main, "db", Forbidden())
    monkeypatch.setattr(main, "ingress", admission.Ingress())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        for headers in ({}, {"Authorization": "Bearer invalid-secret"}):
            r = await client.get("/v1/diagnostics", headers=headers)
            assert r.status_code == 401
            assert r.headers["cache-control"] == "no-store"
            assert len(r.json()["request_id"]) == 32


def test_diagnostic_lane_is_bounded_and_independent(ledger, monkeypatch):
    monkeypatch.setattr(admission, "ACCOUNT_REQUESTS_PER_DAY", 1)
    monkeypatch.setattr(admission, "DIAGNOSTICS_PER_DAY", 1)
    admission.take(ledger, lane="account", subject="learner")
    with pytest.raises(observability.Rejection) as rejected:
        admission.take(ledger, lane="account", subject="learner")
    assert rejected.value.code == "PERSONAL_ACCOUNT_DAILY_LIMIT"
    admission.take(ledger, lane="diagnostics", subject="learner")
    with pytest.raises(observability.Rejection) as rejected:
        admission.take(ledger, lane="diagnostics", subject="learner")
    assert rejected.value.code == "PERSONAL_DIAGNOSTICS_DAILY_LIMIT"


def test_report_is_account_scoped_read_only_and_exposes_no_shared_totals(ledger):
    day = quota.utc_day()
    ledger.store[f"users/learner/usage/{day}"] = {"micros": 100}
    ledger.store[f"users/other/usage/{day}"] = {"micros": 999, "secret": "private-other"}
    ledger.store[f"global_usage/{day}"] = {"micros": 999, "blocked": True}
    before = repr(ledger.store)
    report = diagnostics.read(ledger, quota.Principal("learner", 500, False), global_limit=900)
    assert report["account_allowance"]["used_micros"] == 100
    assert report["spending_paused"] is True
    assert report["shared_allowance_exhausted"] is True
    assert "999" not in json.dumps(report) and "private-other" not in json.dumps(report)
    assert repr(ledger.store) == before

@pytest.mark.asyncio
async def test_request_logs_and_errors_do_not_echo_inputs(monkeypatch, caplog):
    class Block:
        def take(self):
            raise observability.Rejection("INGRESS_RATE_LIMIT", "Rate limited", retry=60)
    monkeypatch.setattr(main, "ingress", Block())
    caplog.set_level(logging.INFO, logger="skellyspeak.requests")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        r = await client.post("/private-path?key=private-query", content="private-body",
            headers={"Authorization": "Bearer private-token", "X-Request-ID": "private-id"})
    assert r.status_code == 429
    assert r.headers["retry-after"] == "60"
    assert r.headers["x-request-id"] == r.json()["request_id"]
    rows = [record.message for record in caplog.records if record.name == "skellyspeak.requests"]
    assert len(rows) == 1
    assert "private-" not in rows[0] + r.text
    assert json.loads(rows[0])["code"] == "INGRESS_RATE_LIMIT"


def test_revoked_session_cannot_read_diagnostics(ledger, monkeypatch):
    monkeypatch.setattr(main, "db", ledger)
    monkeypatch.setattr(main.auth, "read_session_token", lambda *a, **kw: ("missing", 0))
    with pytest.raises(main.HTTPException) as e:
        main.diagnostic_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake"))
    assert e.value.status_code == 401


def test_spending_failure_codes_are_distinct(ledger):
    for personal, shared, code in [(1, 1000, "PERSONAL_ALLOWANCE_EXHAUSTED"), (1000, 1, "SHARED_ALLOWANCE_EXHAUSTED")]:
        with pytest.raises(quota.QuotaExceeded) as e:
            budget.reserve(ledger, user_id="learner", micros=10, user_limit=personal, global_limit=shared)
        assert e.value.code == code
    ledger.store["service_controls/spending"] = {"blocked": True}
    with pytest.raises(quota.QuotaExceeded) as e:
        budget.reserve(ledger, user_id="learner", micros=10, user_limit=1000, global_limit=1000)
    assert e.value.code == "SPENDING_PAUSED"

@pytest.mark.asyncio
async def test_authenticated_diagnostics_survives_exhausted_chat_lane(ledger, monkeypatch):
    monkeypatch.setattr(main, "db", ledger)
    monkeypatch.setattr(main, "ingress", admission.Ingress())
    monkeypatch.setattr(main.auth, "read_session_token", lambda *a, **kw: ("learner", 0))
    monkeypatch.setattr(quota, "load_principal", lambda *a, **kw: quota.Principal("learner", 500, False))
    ledger.store[f"users/learner/admission/{quota.utc_day()}"] = {"requests": 2000}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        headers = {"Authorization": "Bearer fake-session"}
        denied = await client.post("/v1/chat/completions", headers=headers, json={})
        assert denied.status_code == 429
        assert denied.json()["code"] == "PERSONAL_ACCOUNT_DAILY_LIMIT"
        r = await client.get("/v1/diagnostics?user_id=other", headers=headers)
        assert r.status_code == 200
        assert r.json()["account_requests"]["used"] == 2000
        assert r.json()["diagnostics_requests"]["used"] == 1
        account = await client.get("/v1/me", headers=headers)
        assert account.status_code == 200
        assert ledger.store[f"users/learner/admission/{quota.utc_day()}"]["diagnostics_requests"] == 2

@pytest.mark.asyncio
async def test_unexpected_failure_is_correlated_without_exception_secrets(monkeypatch, caplog):
    class Broken:
        def take(self):
            raise RuntimeError("private-database-credential")
    monkeypatch.setattr(main, "ingress", Broken())
    caplog.set_level(logging.INFO, logger="skellyspeak.requests")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        r = await client.get("/unmatched")
    assert r.status_code == 500
    assert r.json()["code"] == "INTERNAL_ERROR"
    assert "private-database-credential" not in r.text + caplog.text
    assert "RuntimeError" in caplog.text

@pytest.mark.asyncio
async def test_anonymous_flood_cannot_consume_liveness_or_signed_lane(monkeypatch):
    class Exhausted:
        def take(self):
            raise observability.Rejection("INGRESS_RATE_LIMIT", "Anonymous exhausted", retry=60)
    monkeypatch.setattr(main, "ingress", Exhausted())
    monkeypatch.setattr(main, "liveness_ingress", admission.Ingress(1))
    monkeypatch.setattr(main, "authenticated_ingress", admission.AuthenticatedIngress())
    from starlette.requests import Request
    def request(path, token=""):
        return Request({"type": "http", "method": "GET", "path": path,
                        "headers": [(b"authorization", token.encode())], "query_string": b""})
    main.admit_http(request("/health"))
    with pytest.raises(observability.Rejection):
        main.admit_http(request("/health"))
    with pytest.raises(observability.Rejection):
        main.admit_http(request("/v1/diagnostics", "Bearer invalid"))
    token = main.auth.issue_session_token(user_id="learner", signing_key=main.CFG.jwt_signing_key)
    main.admit_http(request("/v1/diagnostics", "Bearer " + token))


def test_authenticated_subject_limit_does_not_consume_another_subject():
    gate = admission.AuthenticatedIngress()
    for _ in range(60):
        gate.take("first", lane="inference")
    with pytest.raises(observability.Rejection):
        gate.take("first", lane="inference")
    gate.take("second", lane="inference")


def test_authenticated_identity_storage_is_bounded_without_resetting_active_windows(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(admission.time, "monotonic", lambda: now[0])
    gate = admission.AuthenticatedIngress()
    for subject in range(128):
        gate.take(str(subject), lane="inference")
    with pytest.raises(observability.Rejection):
        gate.take("overflow", lane="inference")
    assert len(gate._subjects) == 128
    now[0] = 60.0
    gate.take("new-window", lane="inference")
    assert len(gate._subjects) == 1
