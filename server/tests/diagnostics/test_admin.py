"""Owner reporting, mutations and log metadata remain bounded and authenticated."""
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import httpx
import pytest
from google.cloud import firestore
from server.app import main
from server.app.accounting import quota
from server.app.identity import auth, admin_auth
from server.app.diagnostics import admin_reports, admin_logs
from server.development import memory_store


@pytest.fixture
def database(monkeypatch):
    db = memory_store.Database()
    monkeypatch.setattr(firestore, 'transactional', memory_store.transactional)
    monkeypatch.setattr(main, 'db', db)
    db.collection('users').document('google:owner').set({'email': admin_auth.OWNER, 'token_version': 0})
    for index in range(27):
        db.collection('users').document(f'google:test{index:02}').set({
            'email': f'user{index}@example.invalid', 'name': '<script>private</script>',
            'daily_limit_micros': 2000000 if index == 1 else None, 'private_field': 'private-secret'})
    return db


def cookie(db):
    identity = auth.GoogleIdentity('owner', admin_auth.OWNER, True, 'Owner', '')
    return admin_auth.finish(identity, main.CFG, db).headers['set-cookie'].split(';', 1)[0]


def test_reports_paginate_and_expose_exceptions_without_unknown_fields(database):
    first = admin_reports.overview(database, main.CFG, days=7)
    assert first['account_count'] == 28 and len(first['users']) == 25
    second = admin_reports.overview(database, main.CFG, days=7, after=first['next_cursor'])
    assert len(second['users']) == 3 and second['next_cursor'] is None
    assert not {u['id'] for u in first['users']} & {u['id'] for u in second['users']}
    custom = next(row for row in first['users'] if row['id'] == 'google:test01')
    assert custom['effective_limit_micros'] == 2000000
    assert 'private-secret' not in str(first)
    assert len(first['global_usage']) == 7 and not first['global_usage'][0]['present']


def test_account_overview_totals_retained_90_days_and_separates_identity(database):
    ref = database.collection('users').document('google:test01')
    today = datetime.now(timezone.utc).date()
    for age, micros in ((0, 100), (6, 200), (89, 300), (90, 9000)):
        ref.collection('usage').document((today - timedelta(days=age)).isoformat()).set({
            'micros': micros, 'micros_credit': 50})
    report = admin_reports.overview(database, main.CFG, days=7)
    user = next(row for row in report['users'] if row['id'] == 'google:test01')
    assert user['usage']['micros'] == 100
    assert user['usage_90_days_micros'] == 600
    assert all('email' not in row and 'name' not in row for row in report['users'])
    assert user['email_label'] == 'u•••1@e•••d'
    assert 'user1@example.invalid' not in str(report)
    empty = next(row for row in report['users'] if row['id'] == 'google:test02')
    assert empty['usage_90_days_micros'] == 0
    detail = admin_reports.user_detail(database, main.CFG, 'google:test01', 7)
    assert detail['user']['id'] == 'google:test01'
    assert detail['identity']['email'] == 'user1@example.invalid'
    assert 'email' not in detail['user']
    assert ref.get().to_dict()['email'] == 'user1@example.invalid'


@pytest.mark.parametrize(('address', 'expected'), [
    ('learner@example.invalid', 'l•••r@e•••d'),
    ('a@b', '•••@•••'), ('ab@xy', '•••@•••'),
    ('学習者@例示.テスト', '学•••者@例•••ト'),
    ('متعلم@مثال.اختبار', 'م•••م@م•••ر'),
    ('élève@example.invalid', 'é•••e@e•••d'),
    ('e\u0301lève@example.invalid', 'e•••e@e•••d'),
    (None, None), ('not-an-email', None), ('@example.invalid', None), ('a@', None),
])
def test_email_label_masks_components_without_changing_source(address, expected):
    assert admin_reports.email_label(address) == expected


@pytest.mark.asyncio
async def test_admin_bypasses_exhausted_learner_quota_but_requires_csrf(database):
    database.collection('admission').document(quota.utc_day()).set({'diagnostics_requests': 600})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='https://test.invalid', headers={'cookie': cookie(database)}) as client:
        response = await client.get('/admin/api/overview?days=7')
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'no-store'
        command = {'action': 'reset_diagnostics', 'target': 'google:test01', 'operation_id': str(uuid4()), 'expected_revision': 0, 'values': {}}
        assert (await client.post('/admin/api/change', json=command)).status_code == 403
        headers = {'origin': main.CFG.public_base_url, 'x-admin-action': '1'}
        changed = await client.post('/admin/api/change', json=command, headers=headers)
        assert changed.status_code == 200
        assert (await client.post('/admin/api/change', json=command, headers=headers)).json()['replayed'] is True
        audit = (await client.get('/admin/api/audit')).json()
        assert len(audit) == 1 and audit[0]['action'] == 'reset_diagnostics'
        assert (await client.get('/admin/api/users/google:test01?days=7')).status_code == 200
        assert (await client.post('/admin/api/change', content=b'x' * 9000, headers=headers)).status_code == 413
        assert (await client.get('/admin/api/overview?days=10000')).status_code == 422
        assert (await client.get('/admin/assets/secret')).status_code == 404
        panel = await client.get('/admin')
        assert "frame-ancestors 'none'" in panel.headers['content-security-policy']
        assert 'Server administration' in panel.text


@pytest.mark.asyncio
async def test_google_callback_completes_owner_flow_without_learner_quota(database, monkeypatch):
    from urllib.parse import parse_qs, urlparse
    async def provider(*args, **kwargs):
        return {'id_token': 'fake-google-token'}
    monkeypatch.setattr(main, 'provider_json', provider)
    monkeypatch.setattr(auth, 'parse_google_id_token', lambda *a, **k: auth.GoogleIdentity('owner', admin_auth.OWNER, True, '', ''))
    database.collection('admission').document(quota.utc_day()).set({'auth_requests': 500, 'diagnostics_requests': 600})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url='https://test.invalid') as client:
        start = await client.get('/admin/login')
        state = parse_qs(urlparse(start.headers['location']).query)['state'][0]
        callback = await client.get('/auth/callback/google', params={'code': 'test-code', 'state': state})
        assert callback.status_code == 200 and 'location' not in callback.headers
        assert 'http-equiv="refresh" content="0;url=/admin"' in callback.text
        assert 'SameSite=strict' in callback.headers['set-cookie']
        assert 'Sign in with Google' not in (await client.get('/admin')).text
        assert (await client.get('/admin/api/overview?days=1')).status_code == 200
        replay = await client.get('/auth/callback/google', params={'code': 'test-code', 'state': state})
        assert replay.status_code == 400


def test_log_metadata_survives_and_content_credentials_are_redacted():
    row = admin_logs.entry({'timestamp': '2026-09-20T00:00:00Z', 'jsonPayload': {
        'event': 'request_headers', 'request_id': 'a' * 32, 'route': '/v1/me', 'status': 429,
        'code': 'PERSONAL_DIAGNOSTICS_DAILY_LIMIT', 'duration_ms': 123,
        'diagnostics': {'stage': 'validation', 'path': 'usage.cost', 'expected': 'number', 'api_key': 'private-key',
                        'content': 'private-content', 'request_id': 'provider-request-123', 'usage': {'tokens': 9}},
        'unknown': 'private-unknown', 'billing': {'amount': 20}, 'authorization': 'private-auth'}})
    assert row['status'] == 429 and row['duration_ms'] == 123
    assert row['diagnostics']['request_id'] == 'provider-request-123'
    assert row['diagnostics']['usage']['tokens'] == 9
    assert row['additional_metadata']['billing']['amount'] == 20
    assert 'private-' not in str(row)
    assert '[secret redacted]' in str(row) and '[user content redacted]' in str(row)


@pytest.mark.asyncio
async def test_log_query_scoped_and_pagination_keeps_window(monkeypatch):
    import json
    monkeypatch.setenv('K_SERVICE', 'skellyspeak-api')
    monkeypatch.setattr(admin_logs, 'credentials', lambda: ('private-token', 'test-project'))
    calls = []
    def respond(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={'entries': [{'timestamp': '2026-09-20T00:00:00Z', 'jsonPayload': {
            'event': 'request_started', 'request_id': 'b' * 32, 'route': '/v1/me'}}], 'nextPageToken': 'cursor'})
    original = httpx.AsyncClient
    monkeypatch.setattr(admin_logs.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))
    first = await admin_logs.read(hours=24)
    await admin_logs.read(hours=24, page_token=first['next_page_token'], since=first['since'])
    assert calls[0]['filter'] == calls[1]['filter']
    assert 'resource.labels.service_name="skellyspeak-api"' in calls[0]['filter']
    assert calls[0]['pageSize'] == 500 and calls[1]['pageToken'] == 'cursor'
    assert 'private-token' not in str(first)


@pytest.mark.asyncio
async def test_cloud_permission_failure_is_explicit(monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setenv('K_SERVICE', 'skellyspeak-api')
    monkeypatch.setattr(admin_logs, 'credentials', lambda: ('private-token', 'test-project'))
    original = httpx.AsyncClient
    monkeypatch.setattr(admin_logs.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(lambda request: httpx.Response(403, json={'error': {'code': 403, 'status': 'PERMISSION_DENIED', 'message': 'permission denied', 'token': 'private-token'}})), **kwargs))
    with pytest.raises(HTTPException) as failure:
        await admin_logs.read(hours=1)
    assert failure.value.diagnostics['upstream_status'] == 403
    assert failure.value.diagnostics['response']['error']['status'] == 'PERMISSION_DENIED'
    assert 'private' not in str(failure.value)


def test_sign_in_and_inference_are_distinct_and_settlement_is_not_activity(database):
    ref = database.collection('users').document('google:test01')
    signed_in = datetime(2026, 10, 1, 22, 38, 14, tzinfo=timezone.utc)
    requested = datetime(2026, 10, 5, 10, tzinfo=timezone.utc)
    ref.set({'last_seen': signed_in}, merge=True)
    ref.collection('reservations').document('new').set({
        'created_at': requested, 'status': 'pending'})
    ref.collection('reservations').document('old').set({
        'created_at': signed_in, 'updated_at': requested + timedelta(hours=1),
        'status': 'settled'})
    report = admin_reports.overview(database, main.CFG)
    row = next(row for row in report['users'] if row['id'] == 'google:test01')
    assert row['last_seen'] == signed_in
    assert row['last_inference_at'] == requested
    empty = next(row for row in report['users'] if row['id'] == 'google:test02')
    assert empty['last_inference_at'] is None
    assert ref.get().to_dict()['last_seen'] == signed_in


def test_overview_pins_all_daily_reads_to_report_start_at_midnight(database, monkeypatch):
    start = datetime(2026, 10, 5, 23, 59, 59, tzinfo=timezone.utc)
    class MidnightClock:
        calls = 0

        @classmethod
        def now(cls, tz):
            cls.calls += 1
            return start if cls.calls == 1 else start + timedelta(seconds=2)

    monkeypatch.setattr(admin_reports, 'datetime', MidnightClock)
    # A separately sampled quota clock must never pick the next day.
    monkeypatch.setattr(quota, 'utc_day', lambda: '2026-10-06')
    ref = database.collection('users').document('google:test01')
    for day, micros in [('2026-10-05', 407191), ('2026-10-06', 900000)]:
        ref.collection('usage').document(day).set({'micros': micros, 'micros_credit': 123})
        ref.collection('admission').document(day).set({'requests': micros})
        database.collection('global_usage').document(day).set({'micros': micros})
        database.collection('admission').document(day).set({'account_requests': micros})
    report = admin_reports.overview(database, main.CFG, days=1)
    row = next(row for row in report['users'] if row['id'] == 'google:test01')
    assert report['generated_at'] == start
    assert row['usage']['day'] == '2026-10-05'
    assert row['usage']['micros'] == row['usage_90_days_micros'] == 407191
    assert row['usage']['micros_credit'] == 123
    assert row['admission']['requests'] == 407191
    assert report['global_admission']['account_requests'] == 407191
    assert report['global_usage'][0]['day'] == '2026-10-05'
    assert report['global_usage'][0]['micros'] == 407191


def test_rolling_usage_crosses_midnight_and_uses_request_time(database):
    now = datetime(2026, 10, 7, 0, 1, tzinfo=timezone.utc)
    ref = database.collection('users').document('google:test01')
    rows = [
        (timedelta(minutes=2), 'settled', 100, 40),
        (timedelta(hours=24), 'pending', 200, None),
        (timedelta(hours=24, microseconds=1), 'unknown', 300, 300),
        (timedelta(days=7), 'settled', 500, 80),
        (timedelta(days=7, microseconds=1), 'settled', 900, 900),
        (timedelta(seconds=-1), 'pending', 9000, None),
        (timedelta(), 'settled', 100, 0),
    ]
    for index, (age, status, reserved, actual) in enumerate(rows):
        ref.collection('reservations').document(str(index)).set({
            'created_at': now - age, 'updated_at': now, 'status': status,
            'reserved_micros': reserved, 'actual_micros': actual})
    assert admin_reports.rolling_usage(ref, now) == {
        'usage_24_hours_micros': 240, 'usage_7_days_micros': 620}
    assert admin_reports.rolling_usage(ref, now + timedelta(minutes=1)) == {
        'usage_24_hours_micros': 9040, 'usage_7_days_micros': 9540}


def test_rolling_usage_does_not_present_incomplete_totals(database, monkeypatch):
    now = datetime(2026, 10, 7, tzinfo=timezone.utc)
    ref = database.collection('users').document('google:test01')
    monkeypatch.setattr(admin_reports, 'ROLLING_RESERVATION_LIMIT', 2)
    assert admin_reports.rolling_usage(ref, now) == {
        'usage_24_hours_micros': 0, 'usage_7_days_micros': 0}
    for index, hours in enumerate([1, 25, 26]):
        ref.collection('reservations').document(str(index)).set({
            'created_at': now - timedelta(hours=hours), 'status': 'pending', 'reserved_micros': 100})
    assert admin_reports.rolling_usage(ref, now) == {
        'usage_24_hours_micros': 100, 'usage_7_days_micros': None}
    ref.collection('reservations').document('0').set({'reserved_micros': None}, merge=True)
    assert admin_reports.rolling_usage(ref, now) == {
        'usage_24_hours_micros': None, 'usage_7_days_micros': None}
