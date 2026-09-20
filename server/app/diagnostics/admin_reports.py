"""Bounded owner reports from existing account and usage records."""
from datetime import datetime, timedelta, timezone
import os
from google.cloud import firestore
from fastapi import HTTPException
from server.app.accounting import quota, admin_controls


def window(days):
    today = datetime.now(timezone.utc).date()
    return [(today - timedelta(days=i)).isoformat() for i in reversed(range(days))]


def usage(ref, days):
    rows = []
    for day in window(days):
        data = ref.document(day).get().to_dict() or {}
        rows.append({'day': day, 'present': bool(data), **{key: int(data.get(key, 0))
            for key in ('micros', 'tokens', 'requests', 'micros_credit')}})
    return rows


def profile(doc, policy):
    data = doc.to_dict() or {}
    override = data.get(quota.LIMIT_FIELD)
    return {'id': doc.id, **{k: data.get(k) for k in ('email', 'name', 'created_at', 'last_seen')},
            'daily_limit_micros': override, 'effective_limit_micros': policy['free_daily_micros'] if override is None else override,
            'admin_revision': int(data.get('admin_revision', 0)), 'token_version': int(data.get('token_version', 0))}


def overview(db, cfg, *, days=30, after=''):
    policy = admin_controls.effective(db, cfg)
    collection = db.collection(quota.USERS)
    query = collection.order_by('__name__').limit(26)
    if after:
        query = query.start_after({'__name__': collection.document(after)})
    docs = list(query.stream())
    users = []
    for doc in docs[:25]:
        row = profile(doc, policy)
        ref = collection.document(doc.id)
        row['usage'] = usage(ref.collection(quota.USAGE), 1)[0]
        admission = ref.collection('admission').document(quota.utc_day()).get().to_dict() or {}
        row['admission'] = {k: int(admission.get(k, 0)) for k in
                            ('requests', 'requests_credit', 'diagnostics_requests', 'diagnostics_requests_credit')}
        users.append(row)
    spending = db.collection('service_controls').document('spending').get().to_dict() or {}
    shared = db.collection(quota.GLOBAL_USAGE).document(quota.utc_day()).get().to_dict() or {}
    requests = db.collection('admission').document(quota.utc_day()).get().to_dict() or {}
    return {'generated_at': datetime.now(timezone.utc), 'revision': os.environ.get('K_REVISION', 'local'),
            'policy': policy, 'environment_defaults': admin_controls.defaults(cfg),
            'spending_paused': bool(spending.get('blocked') or shared.get('blocked')),
            'global_admission': {key: int(requests.get(key, 0)) for key in ('auth_requests', 'account_requests', 'diagnostics_requests')},
            'account_count': sum(1 for _ in collection.select([]).limit(10001).stream()),
            'users': users, 'next_cursor': docs[24].id if len(docs) > 25 else None,
            'global_usage': usage(db.collection(quota.GLOBAL_USAGE), days),
            'scope': 'Sequential live reads, not one atomic snapshot. Allowance usage includes holds and estimated charges; it is not a provider invoice.'}


def user_detail(db, cfg, user_id, days):
    ref = db.collection(quota.USERS).document(user_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, 'Account not found.')
    devices = [{k: (item.to_dict() or {}).get(k) for k in ('platform', 'app_version', 'first_seen', 'last_seen')}
               for item in ref.collection(quota.DEVICES).limit(101).stream()]
    reservations = list(ref.collection('reservations').order_by('created_at', direction=firestore.Query.DESCENDING).limit(101).stream())
    fields = ('day', 'status', 'reserved_micros', 'actual_micros', 'tokens', 'cost_basis', 'created_at', 'updated_at', 'provider_id')
    return {'user': profile(doc, admin_controls.effective(db, cfg)), 'usage': usage(ref.collection(quota.USAGE), days),
            'devices': devices[:100], 'devices_truncated': len(devices) > 100,
            'reservations': [{'id': item.id, **{k: (item.to_dict() or {}).get(k) for k in fields}} for item in reservations[:100]],
            'reservations_truncated': len(reservations) > 100}


def audit(db):
    rows = db.collection(admin_controls.AUDIT).order_by('created_at', direction=firestore.Query.DESCENDING).limit(100).stream()
    fields = ('actor', 'action', 'target', 'before', 'after', 'day', 'created_at', 'revision')
    return [{'id': row.id, **{key: (row.to_dict() or {}).get(key) for key in fields}} for row in rows]
