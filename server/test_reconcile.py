"""Provider receipt validation must never release an unverified reservation."""
from __future__ import annotations

import pytest

import reconcile
from test_budget import ledger


def test_verified_receipt_rounds_up_and_counts_tokens() -> None:
    assert reconcile.receipt({'data': {'id': 'gen-test', 'total_cost': 0.0000351,
                                      'tokens_prompt': 7, 'tokens_completion': 3}},
                             provider_id='gen-test') == (36, 10)


@pytest.mark.parametrize('field,value', [('id', 'gen-other'), ('total_cost', -1),
    ('total_cost', float('nan')), ('total_cost', True), ('tokens_prompt', -1),
    ('tokens_completion', 2.5), ('tokens_completion', None)])
def test_invalid_receipts_are_rejected(field: str, value: object) -> None:
    data = {'id': 'gen-test', 'total_cost': 0.000035, 'tokens_prompt': 7, 'tokens_completion': 3}
    data[field] = value
    with pytest.raises(ValueError):
        reconcile.receipt({'data': data}, provider_id='gen-test')


@pytest.mark.parametrize('valid', [True, False])
def test_cli_historical_finalization_requires_verified_receipt(ledger, monkeypatch, valid):
    import budget
    import httpx
    import quota
    from copy import deepcopy
    from test_budget import reserve
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-01-01')
    reservation = reserve(ledger)
    budget.settle(ledger, reservation=reservation, actual_micros=100, tokens=0,
                  status='unknown', provider_id='gen-history')
    del ledger.store['global_usage/2026-01-01']
    del ledger.store['users/google:1/usage/2026-01-01']
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-05-01')
    before = deepcopy(ledger.store)
    monkeypatch.setattr(httpx, 'get', lambda **kwargs: httpx.Response(200,
        request=httpx.Request('GET', 'https://test.invalid'), json={'data': {
            'id': 'gen-history' if valid else 'gen-wrong', 'total_cost': 0.00003,
            'tokens_prompt': 1, 'tokens_completion': 2}}))
    if not valid:
        with pytest.raises(ValueError, match='does not match'):
            reconcile.settle(ledger, user_id=reservation.user_id, request_id=reservation.request_id, api_key='fake')
        assert ledger.store == before
    else:
        reconcile.settle(ledger, user_id=reservation.user_id, request_id=reservation.request_id, api_key='fake')
        record = ledger.store[f'users/google:1/reservations/{reservation.request_id}']
        assert record['status'] == 'settled' and record['historical_finalization'] is True
        assert record['actual_micros'] == 30
        assert not any('/usage/' in key or key.startswith('global_usage/') for key in ledger.store)
