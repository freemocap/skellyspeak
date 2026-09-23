"""Administrative adjustments must preserve ledger and admission invariants."""
from uuid import uuid4
import pytest
from fastapi import HTTPException
from server.app.accounting import admin_controls as controls, quota, budget
from server.app.admission import admission
from server.tests.accounting.test_budget import ledger


def user(db):
    db.store['users/google:learner'] = {'email': 'learner@example.invalid', 'token_version': 0}


def change(db, action, values=None, **kwargs):
    return controls.change(db, actor='google:owner', operation_id=str(uuid4()),
                          expected_revision=kwargs.pop('revision', 0), action=action,
                          target='service' if action == 'policy' else 'google:learner',
                          values=values or {}, **kwargs)


def test_reset_preserves_reservations_history_and_shared_ceiling(ledger):
    user(ledger)
    hold = budget.reserve(ledger, user_id='google:learner', micros=100, user_limit=100, global_limit=150)
    change(ledger, 'reset_allowance')
    balance = quota.read_balance(ledger, 'google:learner', limit=100)
    assert (balance.used, balance.remaining) == (100, 100)
    assert ledger.store[f'global_usage/{hold.day}']['micros'] == 100
    with pytest.raises(quota.QuotaExceeded) as error:
        budget.reserve(ledger, user_id='google:learner', micros=51, user_limit=100, global_limit=150)
    assert error.value.code == 'SHARED_ALLOWANCE_EXHAUSTED'
    budget.settle(ledger, reservation=hold, actual_micros=40, tokens=10, status='settled', provider_id='receipt')
    assert quota.read_balance(ledger, 'google:learner', limit=100).used == 40
    assert ledger.store[f'global_usage/{hold.day}']['micros'] == 40
    assert len([key for key in ledger.store if key.startswith('admin_audit/')]) == 1


def test_request_resets_are_personal_and_keep_raw_counts(ledger, monkeypatch):
    user(ledger)
    monkeypatch.setattr(admission, 'DIAGNOSTICS_PER_DAY', 1)
    monkeypatch.setattr(admission, 'GLOBAL_DIAGNOSTICS_PER_DAY', 2)
    admission.take(ledger, lane='diagnostics', subject='google:learner')
    change(ledger, 'reset_diagnostics')
    admission.take(ledger, lane='diagnostics', subject='google:learner')
    data = ledger.store[f'users/google:learner/admission/{quota.utc_day()}']
    assert data['diagnostics_requests'] == 2 and data['diagnostics_requests_credit'] == 1
    change(ledger, 'reset_diagnostics', revision=1)
    with pytest.raises(HTTPException) as error:
        admission.take(ledger, lane='diagnostics', subject='google:learner')
    assert error.value.code == 'SHARED_DIAGNOSTICS_DAILY_LIMIT'


def test_duplicate_delivery_and_stale_revision(ledger):
    user(ledger)
    args = dict(actor='google:owner', operation_id=str(uuid4()), expected_revision=0,
                action='revoke_sessions', target='google:learner', values={})
    controls.change(ledger, **args)
    assert controls.change(ledger, **args)['replayed']
    assert ledger.store['users/google:learner']['token_version'] == 1
    with pytest.raises(HTTPException) as error:
        change(ledger, 'revoke_sessions')
    assert error.value.status_code == 409
    with pytest.raises(HTTPException):
        controls.change(ledger, **{**args, 'action': 'reset_allowance'})


@pytest.mark.parametrize('values', [{'max_users': -1}, {'free_daily_micros': True}, {'global_daily_micros': 10**20}, {'new_secret': 1}, {'max_users': 1.5}])
def test_invalid_policy_never_writes(ledger, values):
    with pytest.raises(HTTPException):
        change(ledger, 'policy', values)
    assert not ledger.store


def test_effective_limits_reach_existing_admission_paths(ledger):
    user(ledger)
    change(ledger, 'policy', {'free_daily_micros': 300, 'global_daily_micros': 200,
                              'diagnostics_requests': 0, 'max_users': 0})
    principal = quota.load_principal(ledger, 'google:learner', token_version=0, default_limit=10)
    assert principal.daily_limit == 300
    with pytest.raises(quota.QuotaExceeded):
        budget.reserve(ledger, user_id=principal.user_id, micros=201, user_limit=300, global_limit=10000)
    with pytest.raises(HTTPException):
        admission.take(ledger, lane='diagnostics', subject=principal.user_id)
    with pytest.raises(quota.SignupClosed):
        quota.upsert_user(ledger, user_id='new', email='new@example.invalid', name='', max_users=100)
    change(ledger, 'user_limit', {'daily_limit_micros': 500})
    assert quota.load_principal(ledger, principal.user_id, token_version=0, default_limit=10).daily_limit == 500
    change(ledger, 'user_limit', {'daily_limit_micros': None}, revision=1)
    assert quota.load_principal(ledger, principal.user_id, token_version=0, default_limit=10).daily_limit == 300


def test_raising_account_ceiling_from_six_to_twelve(ledger):
    def sign_in(number):
        quota.upsert_user(ledger, user_id=f'google:{number}',
                          email=f'user{number}@example.invalid', name='', max_users=6)

    for number in range(6):
        sign_in(number)
    with pytest.raises(quota.SignupClosed):
        sign_in(6)

    change(ledger, 'policy', {'max_users': 12})
    for number in range(6, 12):
        sign_in(number)
    with pytest.raises(quota.SignupClosed):
        sign_in(12)
    # Existing accounts can still sign in at capacity without consuming a slot.
    sign_in(0)
    accounts = [key for key in ledger.store if key.startswith('users/') and key.count('/') == 1]
    assert len(accounts) == 12
    assert 'users/google:12' not in ledger.store


def test_failed_audit_rolls_back_reset(ledger, monkeypatch):
    from server.tests.accounting.test_quota import FakeTransaction
    user(ledger)
    setter = FakeTransaction.set
    def fail(self, ref, data, merge=False):
        if ref.path.startswith('admin_audit/'):
            raise RuntimeError('audit write failure')
        setter(self, ref, data, merge)
    monkeypatch.setattr(FakeTransaction, 'set', fail)
    with pytest.raises(RuntimeError):
        change(ledger, 'reset_allowance')
    assert set(ledger.store) == {'users/google:learner'}
