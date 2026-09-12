"""Bound cheap ingress locally and admitted database work across all instances."""

from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Literal

from fastapi import HTTPException
from google.cloud import firestore

import quota
import transactions

REQUESTS_PER_MINUTE = 240
AUTH_PER_DAY = 500
ACCOUNT_REQUESTS_PER_DAY = 2_000
GLOBAL_REQUESTS_PER_DAY = 10_000
ADMISSION = "admission"


class Ingress:
    def __init__(self) -> None:
        self._hits: deque[float] = deque()
        self._lock: Lock = Lock()

    def take(self) -> None:
        now: float = time.monotonic()
        with self._lock:
            while self._hits and now - self._hits[0] >= 60:
                self._hits.popleft()
            if len(self._hits) >= REQUESTS_PER_MINUTE:
                raise HTTPException(status_code=429, detail="Request rate limit reached. Try again in a minute.",
                                    headers={"Retry-After": "60"})
            self._hits.append(now)


def take(db: firestore.Client, *, lane: Literal["auth", "account"], subject: str) -> None:
    """Count attempts, including later failures; never refund infrastructure work."""
    if lane not in {"auth", "account"} or not subject or "/" in subject:
        raise ValueError("Invalid admission identity.")
    day: str = quota.utc_day()
    shared: firestore.DocumentReference = db.collection(ADMISSION).document(day)
    personal: firestore.DocumentReference = db.collection(quota.USERS).document(subject).collection(ADMISSION).document(day)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> None:
        global_data: dict[str, object] = shared.get(transaction=transaction).to_dict() or {}
        user_data: dict[str, object] = (personal.get(transaction=transaction).to_dict() or {}) if lane == "account" else {}
        field: str = f"{lane}_requests"
        total: int = int(global_data.get(field, 0))
        limit: int = AUTH_PER_DAY if lane == "auth" else GLOBAL_REQUESTS_PER_DAY
        if total >= limit or (lane == "account" and int(user_data.get("requests", 0)) >= ACCOUNT_REQUESTS_PER_DAY):
            raise HTTPException(status_code=429, detail="Daily request limit reached. Resets at 00:00 UTC.")
        transaction.set(shared, {field: firestore.Increment(1), "ttl": quota.ttl_after(2)}, merge=True)
        if lane == "account":
            transaction.set(personal, {"requests": firestore.Increment(1), "ttl": quota.ttl_after(2)}, merge=True)

    transactions.run(db, apply)
