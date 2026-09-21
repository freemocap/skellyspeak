"""Bounded retries inside one server-owned operation, never replay whole groups.

Native owns direct-provider and audio retries. The grouped API owns its provider
rounds because its durable attempt IDs deliberately cannot be resubmitted.
Each callable invocation retains its own reservation and settlement boundary.
"""
from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import random
import time

import anyio

from server.app.diagnostics import runtime

MAX_RETRIES = 3
WAIT_BUDGET = 30.0


def delay(error, retry, waited, jitter):
    if retry >= MAX_RETRIES or getattr(error, 'upstream_status', None) != 429:
        return None
    details = getattr(error, 'diagnostics', None) or {}
    if details.get('chars', 0) > 0:
        return None
    partial = details.get('partial')
    if partial and (partial.get('chars') != 0 or partial.get('usage')):
        return None
    reason = details.get('error', details.get('detail', {}))
    if isinstance(reason, dict) and reason.get('code', reason.get('status')) in {
        'quota_exceeded', 'insufficient_quota', 'billing_hard_limit_reached', 'credit_balance_too_low',
    }:
        return None
    wait = 2 ** retry + min(0.25, max(0, jitter))
    header = details.get('http', (partial or {}).get('http', {})).get('response_headers', {}).get('retry_after')
    if header is not None:
        try:
            seconds = int(header)
            if seconds < 0:
                return None
        except (ValueError, TypeError):
            try:
                seconds = max(0, (parsedate_to_datetime(header) - datetime.now(timezone.utc)).total_seconds()) + 1
            except (ValueError, TypeError, OverflowError):
                return None
        wait = max(wait, seconds)
    return wait if waited + wait <= WAIT_BUDGET else None


async def run(request, *, sleep=anyio.sleep, jitter=lambda: random.uniform(0, 0.25)):
    history = []
    waited = 0.0
    try:
        while True:
            try:
                result = await request()
                if history:
                    result['response']['automatic_retries'] = history
                return result
            except Exception as error:
                wait = delay(error, len(history), waited, jitter())
                if wait is None:
                    raise
                history.append({'number': len(history) + 1, 'delay_ms': round(wait * 1000),
                                'scheduled_at_unix_ms': round(time.time() * 1000),
                                'error': {'code': error.code, 'diagnostics': error.diagnostics}})
                # The provider error is already scrubbed. Keep every refusal before
                # sleeping; cancellation propagates and never starts another round.
                runtime.emit('provider_retry_scheduled', response_body={'automatic_retries': history})
                await sleep(wait)
                waited += wait
    except BaseException as error:
        if history:
            details = getattr(error, 'diagnostics', None) or {}
            error.diagnostics = {**details, 'automatic_retries': history}
        raise
