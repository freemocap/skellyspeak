"""Provider receipt validation must never release an unverified reservation."""
from __future__ import annotations

import pytest

import reconcile


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
