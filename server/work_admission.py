"""Transactional, account-scoped attempt claims for grouped inference work.

Call only after authenticated infrastructure admission. No provider work belongs
inside these transactions. This module does not reserve or settle money.
"""
from __future__ import annotations

import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from google.cloud import firestore

import quota
import transactions
from observability import Rejection

MAX_INFLIGHT = 8
WORK_SECONDS = 180
LEASE_SECONDS = 300
SUBMISSION_SECONDS = 600
FUTURE_SKEW_SECONDS = 30
RETENTION_SECONDS = 86_400
State = Literal["running", "succeeded", "failed", "unknown"]


@dataclass(frozen=True)
class Claim:
    user_id: str
    attempt_id: str
    acquired: bool
    state: State
    owner: str | None
    expires_at: float


def identity(user_id: str, attempt_id: str, digest: str) -> int:
    if not user_id or len(user_id) > 128 or "/" in user_id:
        raise ValueError("Invalid admission subject.")
    if not re.fullmatch(r"[0-9]{10}-[0-9a-f]{32}", attempt_id):
        raise HTTPException(400, "Invalid attempt identity.")
    if not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise HTTPException(400, "Invalid request fingerprint.")
    return int(attempt_id[:10])


def claim(db: firestore.Client, *, user_id: str, attempt_id: str, digest: str) -> Claim:
    issued: int = identity(user_id, attempt_id, digest)
    owner: str = secrets.token_hex(32)
    account: firestore.DocumentReference = db.collection(quota.USERS).document(user_id)
    slots: firestore.DocumentReference = account.collection("work_control").document("slots")
    receipt: firestore.DocumentReference = account.collection("work_attempts").document(attempt_id)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> Claim:
        now: float = time.time()
        # Timestamp is part of the immutable identity. Removing expired receipts
        # cannot make that same identity eligible to execute again.
        if issued < now - SUBMISSION_SECONDS or issued > now + FUTURE_SKEW_SECONDS:
            raise HTTPException(409, "Attempt submission window expired or clock is incorrect. Do not replay automatically.")
        previous: dict = receipt.get(transaction=transaction).to_dict() or {}
        if previous:
            if previous["digest"] != digest:
                raise HTTPException(409, "Attempt identity was reused for different work.")
            state: State = previous["state"]
            if state not in {"running", "succeeded", "failed", "unknown"}:
                raise RuntimeError("Invalid stored attempt state.")
            expires: float = float(previous["expires_at"])
            if state == "running" and expires <= now:
                state = "unknown"
            return Claim(user_id, attempt_id, False, state, None, expires)
        stored: dict = slots.get(transaction=transaction).to_dict() or {}
        active: dict[str, float] = {
            key: float(expiry) for key, expiry in stored.get("active", {}).items()
            if float(expiry) > now
        }
        if len(active) >= MAX_INFLIGHT:
            raise Rejection("ACCOUNT_INFLIGHT_LIMIT", "Account inference capacity is occupied.", retry=5)
        expires = now + LEASE_SECONDS
        active[attempt_id] = expires
        transaction.set(slots, {"active": active})
        transaction.set(receipt, {
            "digest": digest, "owner": owner, "state": "running", "expires_at": expires,
            "ttl": datetime.fromtimestamp(issued + RETENTION_SECONDS, tz=timezone.utc),
        })
        return Claim(user_id, attempt_id, True, "running", owner, expires)

    return transactions.run(db, apply)


def finish(db: firestore.Client, *, claim: Claim, state: Literal["succeeded", "failed", "unknown"]) -> None:
    if not claim.acquired or claim.owner is None or state not in {"succeeded", "failed", "unknown"}:
        raise ValueError("Only the admitted owner can finish work.")
    account: firestore.DocumentReference = db.collection(quota.USERS).document(claim.user_id)
    slots: firestore.DocumentReference = account.collection("work_control").document("slots")
    receipt: firestore.DocumentReference = account.collection("work_attempts").document(claim.attempt_id)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> None:
        previous: dict = receipt.get(transaction=transaction).to_dict() or {}
        if previous.get("owner") != claim.owner:
            raise RuntimeError("Attempt ownership is unavailable.")
        if previous["state"] != "running":
            if previous["state"] != state:
                raise RuntimeError("Attempt already finished with a different outcome.")
            return
        stored: dict = slots.get(transaction=transaction).to_dict() or {}
        active: dict[str, float] = stored.get("active", {})
        # Timeout/disconnect cannot establish that upstream stopped. Keep its
        # slot until expiry rather than immediately granting replacement work.
        if state != "unknown":
            active.pop(claim.attempt_id, None)
        transaction.set(slots, {"active": active})
        transaction.set(receipt, {"state": state}, merge=True)

    transactions.run(db, apply)
