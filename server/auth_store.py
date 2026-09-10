"""Validate and consume authorization documents in one transaction."""

from __future__ import annotations

import re
import time
from collections.abc import Callable

from google.cloud import firestore

import auth
import transactions


def consume(
    db: firestore.Client, *, collection: str, code: str,
    validate: Callable[[dict[str, object]], None],
) -> dict[str, object]:
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,128}", code):
        raise auth.AuthError("Malformed sign-in code.")
    ref = db.collection(collection).document(code)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> dict[str, object]:
        stored = ref.get(transaction=transaction).to_dict()
        if stored is None:
            raise auth.AuthError("This sign-in code has expired or already been used.")
        if int(stored.get("expires_at", 0)) <= int(time.time()):
            raise auth.AuthError("Sign-in code expired. Sign in again.")
        validate(stored)
        transaction.delete(ref)
        return stored

    return transactions.run(db, apply)
