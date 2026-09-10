"""Bound cheap ingress locally and admitted database work across all instances."""

from __future__ import annotations

import time
from collections import deque, OrderedDict
from threading import Lock
from typing import Literal

from fastapi import HTTPException
from google.cloud import firestore

import quota
import transactions
from observability import Rejection

REQUESTS_PER_MINUTE = 240
AUTH_PER_DAY = 500
ACCOUNT_REQUESTS_PER_DAY = 2_000
GLOBAL_REQUESTS_PER_DAY = 10_000
DIAGNOSTICS_PER_DAY = 120
GLOBAL_DIAGNOSTICS_PER_DAY = 600
ADMISSION = "admission"


class Ingress:
    def __init__(self, limit: int | None = None) -> None:
        self.limit = limit
        self._hits: deque[float] = deque()
        self._lock: Lock = Lock()

    def take(self) -> None:
        now: float = time.monotonic()
        with self._lock:
            while self._hits and now - self._hits[0] >= 60:
                self._hits.popleft()
            if len(self._hits) >= (self.limit if self.limit is not None else REQUESTS_PER_MINUTE):
                raise Rejection("INGRESS_RATE_LIMIT", "Request rate limit reached. Try again in a minute.", retry=60)
            self._hits.append(now)


class AuthenticatedIngress:
    """Bounded per-subject windows, plus a process ceiling; identities stay in memory."""
    def __init__(self):
        self._subjects = OrderedDict()
        self._lock = Lock()
        self._total = Ingress(240)

    def take(self, subject: str):
        now = time.monotonic()
        with self._lock:
            # Evict only expired windows: rotating subjects cannot erase active limits.
            for key, (_, touched) in list(self._subjects.items()):
                if now - touched >= 60:
                    del self._subjects[key]
            if subject not in self._subjects:
                if len(self._subjects) >= 128:
                    raise Rejection("INGRESS_RATE_LIMIT", "Authenticated ingress capacity reached. Try again in a minute.", retry=60)
                self._subjects[subject] = (Ingress(60), now)
            gate, _ = self._subjects[subject]
            self._subjects[subject] = (gate, now)
            gate.take()
            self._total.take()


def take(db: firestore.Client, *, lane: Literal["auth", "account", "diagnostics"], subject: str) -> None:
    """Count attempts, including later failures; never refund infrastructure work."""
    if lane not in {"auth", "account", "diagnostics"} or not subject or "/" in subject:
        raise ValueError("Invalid admission identity.")
    day: str = quota.utc_day()
    shared: firestore.DocumentReference = db.collection(ADMISSION).document(day)
    personal: firestore.DocumentReference = db.collection(quota.USERS).document(subject).collection(ADMISSION).document(day)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> None:
        global_data: dict[str, object] = shared.get(transaction=transaction).to_dict() or {}
        user_data: dict[str, object] = (personal.get(transaction=transaction).to_dict() or {}) if lane != "auth" else {}
        field: str = f"{lane}_requests"
        total: int = int(global_data.get(field, 0))
        limit: int = {"auth": AUTH_PER_DAY, "account": GLOBAL_REQUESTS_PER_DAY,
                      "diagnostics": GLOBAL_DIAGNOSTICS_PER_DAY}[lane]
        personal_limit = DIAGNOSTICS_PER_DAY if lane == "diagnostics" else ACCOUNT_REQUESTS_PER_DAY
        personal_field = "diagnostics_requests" if lane == "diagnostics" else "requests"
        if total >= limit:
            raise Rejection(f"SHARED_{lane.upper()}_DAILY_LIMIT",
                            "Daily request limit reached. Resets at 00:00 UTC.", daily=True)
        if lane != "auth" and int(user_data.get(personal_field, 0)) >= personal_limit:
            raise Rejection(f"PERSONAL_{lane.upper()}_DAILY_LIMIT",
                            "Daily request limit reached. Resets at 00:00 UTC.", daily=True)
        transaction.set(shared, {field: firestore.Increment(1), "ttl": quota.ttl_after(2)}, merge=True)
        if lane != "auth":
            transaction.set(personal, {personal_field: firestore.Increment(1), "ttl": quota.ttl_after(2)}, merge=True)

    transactions.run(db, apply)
