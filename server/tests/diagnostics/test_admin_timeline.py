from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from google.cloud import firestore
from server.development.memory_store import Database, transactional
from server.app.accounting import budget
from server.app.diagnostics.admin_reports import timeline


def test_hold_and_idempotent_settlement_share_original_time_buckets(monkeypatch):
    monkeypatch.setattr(firestore, 'transactional', transactional)
    db = Database()
    reservation = budget.reserve(db, user_id='test', micros=100, user_limit=1000, global_limit=1000)
    report = timeline(db, span='1h', interval='1m')
    assert sum(p['micros'] for p in report['points']) == 100
    for _ in range(2):
        budget.settle(db, reservation=reservation, actual_micros=35, tokens=10, status='settled', provider_id='test')
    for interval in ('1m', '5m', '10m', '1h', '12h', '1d', '1w', '1mo'):
        report = timeline(db, span='1d', interval=interval)
        assert sum(p['micros'] for p in report['points']) == 35
        assert sum(p['requests'] for p in report['points']) == 1
        assert sum(p['tokens'] for p in report['points']) == 10


def test_calendar_months_and_missing_history_are_explicit():
    db = Database()
    db.collection('global_usage').document('2026-02-28').set({'micros': 12})
    db.collection('global_usage').document('2026-03-01').set({'micros': 34})
    now = datetime(2026, 3, 2, tzinfo=timezone.utc)
    points = timeline(db, span='1mo', interval='1mo', now=now)['points']
    assert [(p['time'][:10], p['micros']) for p in points] == [('2026-01-01', 0), ('2026-02-01', 12), ('2026-03-01', 34)]
    assert not any(p['present'] for p in timeline(db, span='1h', interval='1m', now=now)['points'])
    with pytest.raises(HTTPException) as error:
        timeline(db, span='3mo', interval='1m', now=now)
    assert error.value.status_code == 422


def test_expired_chart_buckets_are_not_recreated_as_negative_usage(monkeypatch):
    monkeypatch.setattr(firestore, 'transactional', transactional)
    db = Database()
    reservation = budget.reserve(db, user_id='test', micros=100, user_limit=1000, global_limit=1000)
    for path in list(db._records):
        if path.startswith('usage_timeline/'):
            del db._records[path]
    budget.settle(db, reservation=reservation, actual_micros=35, tokens=10, status='settled', provider_id='test')
    assert not any(path.startswith('usage_timeline/') for path in db._records)
