"""Local quota bypass preserves metering and explicit spending controls."""
import pytest
from google.cloud import firestore

from server.app.accounting import budget, quota, usage_limits
from server.app.admission import admission
from server.app.diagnostics import diagnostics
from server.app.diagnostics.observability import Rejection
from server.development.memory_store import Database, transactional


@pytest.fixture
def local(monkeypatch):
    monkeypatch.setattr(firestore, 'transactional', transactional)
    return Database(enforce_usage_limits=False)


def test_unlimited_local_reservations_still_settle_and_report(local):
    reservation = budget.reserve(local, user_id='learner', micros=600000,
                                 user_limit=500000, global_limit=500000)
    assert quota.read_balance(local, 'learner', limit=500000).used == 600000
    snapshot = diagnostics.read(local, quota.Principal('learner', 500000, False), global_limit=500000)
    assert snapshot['usage_limits_enforced'] is False
    assert snapshot['shared_allowance_exhausted'] is False
    assert snapshot['account_allowance']['used_micros'] == 600000
    budget.settle(local, reservation=reservation, actual_micros=550000, tokens=17,
                  status='settled', provider_id='test-provider')
    assert quota.read_balance(local, 'learner', limit=500000).used == 550000


@pytest.mark.parametrize('lane', ['auth', 'account', 'diagnostics'])
def test_daily_request_limits_disabled_but_counted(local, lane):
    day = quota.utc_day()
    shared = local.collection(admission.ADMISSION).document(day)
    shared.set({f'{lane}_requests': 10000001})
    personal = local.collection(quota.USERS).document('learner').collection(admission.ADMISSION).document(day)
    field = 'diagnostics_requests' if lane == 'diagnostics' else 'requests'
    personal.set({field: 10000001})
    admission.take(local, lane=lane, subject='learner')
    assert shared.get().to_dict()[f'{lane}_requests'] == 10000002
    if lane != 'auth':
        assert personal.get().to_dict()[field] == 10000002
    local.enforce_usage_limits = True
    with pytest.raises(Rejection) as error:
        admission.take(local, lane=lane, subject='learner')
    assert error.value.status_code == 429


def test_explicit_spending_pause_still_applies(local):
    local.collection(budget.CONTROLS).document(budget.SPENDING).set({'blocked': True})
    with pytest.raises(quota.QuotaExceeded) as error:
        budget.reserve(local, user_id='learner', micros=600000, user_limit=1, global_limit=1)
    assert error.value.code == 'SPENDING_PAUSED'


def test_limits_remain_default_for_other_database_clients(local):
    assert usage_limits.enforced(object())
    assert usage_limits.enforced(Database())
    local.enforce_usage_limits = True
    with pytest.raises(quota.QuotaExceeded):
        budget.reserve(local, user_id='learner', micros=600000, user_limit=500000, global_limit=500000)
