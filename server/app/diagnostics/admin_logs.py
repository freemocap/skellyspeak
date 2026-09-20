"""Bounded read-only Cloud Logging queries with explicit omissions and coverage."""
from __future__ import annotations
import asyncio
from datetime import datetime, timedelta, timezone
import os
from functools import partial
import re
import google.auth
from google.auth.transport.requests import Request as GoogleRequest
import httpx
from fastapi import HTTPException
from server.app.diagnostics import runtime, provider_errors


SAFE_TEXT = re.compile(r'^[A-Za-z0-9_./:-]{1,160}$')


def entry(row):
    payload = row.get('jsonPayload', {})
    if not isinstance(payload, dict):
        payload = {}
    result = runtime.sanitize(payload)
    for key in ('code', 'exception_type', 'revision'):
        value = payload.get(key)
        if isinstance(value, str) and SAFE_TEXT.fullmatch(value):
            result[key] = value
    if payload.get('event') == 'request_headers':
        result.update(event='request_headers')
        for key in ('status', 'duration_ms'):
            if type(payload.get(key)) is int and 0 <= payload[key] <= 2**53:
                result[key] = payload[key]
        if payload.get('route') in runtime.ROUTES:
            result['route'] = payload['route']
        if isinstance(payload.get('request_id'), str) and re.fullmatch('[0-9a-f]{32}', payload['request_id']):
            result['request_id'] = payload['request_id']
    if 'diagnostics' in payload:
        result['diagnostics'] = provider_errors.sanitize(payload['diagnostics'])
    extras = {key: value for key, value in payload.items() if key not in result}
    result['additional_metadata'] = provider_errors.sanitize(extras)
    stamp = row.get('timestamp')
    result['timestamp'] = stamp if isinstance(stamp, str) and re.fullmatch(r'[0-9TZ:.+\-]{1,40}', stamp) else None
    result['metadata_handling'] = 'Known fields retained; additional fields bounded and sanitized; content and credentials redacted.'
    return result


def credentials():
    creds, project = google.auth.default(scopes=['https://www.googleapis.com/auth/logging.read'])
    creds.refresh(partial(GoogleRequest(), timeout=10))
    return creds.token, project


async def read(*, hours, errors=False, request_id='', page_token='', since=''):
    service = os.environ.get('K_SERVICE', '')
    if not service:
        raise HTTPException(503, 'Cloud logs are available on Cloud Run; local logs remain in the local launcher output.')
    try:
        token, project = await asyncio.wait_for(asyncio.to_thread(credentials), timeout=15)
    except Exception as error:
        failure = HTTPException(503, 'Cloud Logging credentials are unavailable.')
        failure.diagnostics = {'stage': 'logging_auth', 'exception_type': type(error).__name__}
        raise failure from None
    if not project or not re.fullmatch('[a-zA-Z0-9_-]+', project) or not re.fullmatch('[a-zA-Z0-9_-]+', service):
        raise HTTPException(503, 'Cloud Logging project or service is not configured.')
    now = datetime.now(timezone.utc)
    if since:
        try:
            start = datetime.fromisoformat(since)
            if start.tzinfo is None or not now - timedelta(hours=169) <= start <= now:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(422, 'Invalid log window start.') from None
        since = start.isoformat()
    else:
        since = (now - timedelta(hours=hours)).isoformat()
    query = (f'resource.type="cloud_run_revision" AND resource.labels.service_name="{service}" '
             f'AND timestamp>="{since}" AND jsonPayload.event:*')
    if errors:
        query += ' AND (jsonPayload.status>=400 OR jsonPayload.event=~"failed$" OR jsonPayload.event="provider_error_response")'
    if request_id:
        query += f' AND jsonPayload.request_id="{request_id}"'
    body = {'resourceNames': [f'projects/{project}'], 'filter': query, 'orderBy': 'timestamp desc',
            'pageSize': 500, 'pageToken': page_token}
    response_status = None
    headers = {}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            async with client.stream('POST', 'https://logging.googleapis.com/v2/entries:list',
                    headers={'Authorization': f'Bearer {token}'}, json=body, follow_redirects=False) as response:
                response_status = response.status_code
                headers = provider_errors.response_headers(response)
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 4 * 1024 * 1024:
                        raise HTTPException(502, 'Cloud Logging response exceeds the 4 MiB limit. Narrow the time window.')
                import json
                data = json.loads(raw)
                if response_status != 200:
                    failure = HTTPException(502, 'Cloud Logging read failed. Check the runtime identity’s Logs Viewer permission.')
                    failure.diagnostics = {'stage': 'logging_read', 'upstream_status': response_status,
                                           'http': headers, 'response': provider_errors.sanitize(data)}
                    raise failure
    except (httpx.HTTPError, ValueError) as error:
        failure = HTTPException(502, 'Cloud Logging response could not be read.')
        failure.diagnostics = {'stage': 'logging_response', 'exception_type': type(error).__name__, 'upstream_status': response_status, 'http': headers, 'body_unreadable': True}
        raise failure from None
    if not isinstance(data, dict) or not isinstance(data.get('entries', []), list):
        raise HTTPException(502, 'Unexpected Cloud Logging response shape.')
    rows = [entry(row) for row in data.get('entries', []) if isinstance(row, dict)]
    return {'entries': rows, 'next_page_token': data.get('nextPageToken'), 'since': since,
            'scope': 'Up to 500 application events per page, newest first. Heat map counts request_started events in loaded pages only. HTTP 200 headers do not establish successful inference.',
            'geography': 'Not collected. No raw IP addresses or inferred locations are exposed.'}
