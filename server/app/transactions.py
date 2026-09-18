"""Bounded retries for explicitly aborted Firestore transactions."""

from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TypeVar
from threading import Lock

from google.api_core.exceptions import Aborted
from google.cloud import firestore

T = TypeVar("T")
_local_transactions = Lock()


def run(db: firestore.Client, operation: Callable[[firestore.Transaction], T]) -> T:
    # Serialize local ledger work; Firestore transactions arbitrate other instances.
    with _local_transactions:
        return _retry(db, operation)


def _retry(db: firestore.Client, operation: Callable[[firestore.Transaction], T]) -> T:
    for attempt in range(6):
        try:
            # Let the SDK retry aborted commits with their original transaction
            # ID, preserving their priority against competing instances. Starting
            # fresh after every commit abort can starve a busy account's work.
            return operation(db.transaction(max_attempts=6))
        except Aborted:
            # The SDK does not retry aborts raised while reading the transaction
            # body. It rolls back first; retry those separately with backoff.
            # Its ValueError after exhausted commit retries must propagate.
            if attempt == 5:
                raise
            time.sleep(random.uniform(0.02, min(0.8, 0.05 * 2**attempt)))
    raise AssertionError("Transaction retry loop did not return or raise")
