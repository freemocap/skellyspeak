"""Bounded process event feed; callbacks only wake WebSocket readers."""
import asyncio
from collections import deque
from datetime import datetime, timezone
import json
import logging
from threading import RLock
from server.app.diagnostics.admin_logs import entry

_lock = RLock()
_subscribers = set()
_records = deque(maxlen=500)


def notify():
    with _lock:
        for loop, event in tuple(_subscribers):
            if not loop.is_closed():
                try:
                    loop.call_soon_threadsafe(event.set)
                except RuntimeError:  # Disconnect raced loop shutdown.
                    _subscribers.discard((loop, event))


def subscribe():
    event = asyncio.Event()
    pair = (asyncio.get_running_loop(), event)
    with _lock:
        _subscribers.add(pair)
    return event, lambda: unsubscribe(pair)


def unsubscribe(pair):
    with _lock:
        _subscribers.discard(pair)


def records(hours, errors, request_id):
    with _lock:
        rows = list(reversed(_records))
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    return [row for stamp, row in rows if stamp >= cutoff
            and (not request_id or row.get('request_id') == request_id)
            and (not errors or row.get('status', 0) >= 400
                 or str(row.get('event', '')).endswith('failed')
                 or row.get('event') == 'provider_error_response')]


class Feed(logging.Handler):
    def emit(self, record):
        if not isinstance(record.msg, str) or record.args:
            return
        try:
            payload = json.loads(record.msg)
        except ValueError:
            return
        if not isinstance(payload, dict) or 'event' not in payload:
            return
        row = entry({'jsonPayload': payload, 'timestamp': datetime.fromtimestamp(record.created, timezone.utc).isoformat()})
        with _lock:
            _records.append((record.created, row))
        notify()


_feed = Feed()


def install():
    for name in ('skellyspeak.runtime', 'skellyspeak.requests'):
        logger = logging.getLogger(name)
        if _feed not in logger.handlers:
            logger.addHandler(_feed)
