"""Atomic admission and exactly-once settlement of provider requests."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Literal

from google.cloud import firestore

import quota
import transactions

RESERVATIONS = "reservations"
CONTROLS = "service_controls"
SPENDING = "spending"


@dataclass(frozen=True)
class Reservation:
    user_id: str
    request_id: str
    day: str
    micros: int


def reserve(
    db: firestore.Client, *, user_id: str, micros: int, user_limit: int, global_limit: int
) -> Reservation:
    if micros <= 0 or user_limit < 0 or global_limit < 0:
        raise ValueError("Reservation must be positive and limits nonnegative.")
    reservation = Reservation(user_id, secrets.token_urlsafe(24), quota.utc_day(), micros)
    user = db.collection(quota.USERS).document(user_id)
    usage = user.collection(quota.USAGE).document(reservation.day)
    shared = db.collection(quota.GLOBAL_USAGE).document(reservation.day)
    record = user.collection(RESERVATIONS).document(reservation.request_id)
    control = db.collection(CONTROLS).document(SPENDING)

    @firestore.transactional
    def admit(transaction: firestore.Transaction) -> None:
        personal = usage.get(transaction=transaction).to_dict() or {}
        global_usage = shared.get(transaction=transaction).to_dict() or {}
        controls = control.get(transaction=transaction).to_dict() or {}
        if controls.get("blocked") or global_usage.get("blocked"):
            raise quota.QuotaExceeded("Hosted spending is paused while a provider billing discrepancy is investigated.", code="SPENDING_PAUSED")
        for data, limit, label in (
            (personal, user_limit, "Your"), (global_usage, global_limit, "The shared")
        ):
            if int(data.get("micros", 0)) + micros > limit:
                raise quota.QuotaExceeded(
                    f"{label} remaining daily allowance cannot cover this request. "
                    "Wait for pending requests to finish or for the 00:00 UTC reset.",
                    code="PERSONAL_ALLOWANCE_EXHAUSTED" if label == "Your" else "SHARED_ALLOWANCE_EXHAUSTED"
                )
        entry = {
            "micros": firestore.Increment(micros),
            "requests": firestore.Increment(1),
            "day": reservation.day,
            "ttl": quota.ttl_after(quota.USAGE_RETENTION_DAYS),
        }
        transaction.set(usage, entry, merge=True)
        transaction.set(shared, entry, merge=True)
        # Unresolved charges do not expire: they require reconciliation.
        transaction.set(record, {
            "day": reservation.day, "reserved_micros": micros,
            "status": "pending", "created_at": firestore.SERVER_TIMESTAMP,
        })

    transactions.run(db, admit)
    return reservation


def settle(
    db: firestore.Client, *, reservation: Reservation, actual_micros: int,
    tokens: int, status: Literal["settled", "unknown"], provider_id: str,
) -> None:
    if actual_micros < 0 or tokens < 0:
        raise ValueError("Usage cannot be negative.")
    if status == "unknown" and actual_micros != reservation.micros:
        raise ValueError("Unknown usage must retain the complete reservation.")
    user = db.collection(quota.USERS).document(reservation.user_id)
    record = user.collection(RESERVATIONS).document(reservation.request_id)
    usage = user.collection(quota.USAGE).document(reservation.day)
    shared = db.collection(quota.GLOBAL_USAGE).document(reservation.day)
    control = db.collection(CONTROLS).document(SPENDING)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> None:
        stored = record.get(transaction=transaction).to_dict()
        personal = usage.get(transaction=transaction).to_dict()
        global_usage = shared.get(transaction=transaction).to_dict()
        if stored is None:
            raise RuntimeError("Reservation is missing; refusing an untracked charge.")
        if stored["day"] != reservation.day or stored["reserved_micros"] != reservation.micros:
            raise RuntimeError("Reservation identity does not match its ledger record.")
        if stored["status"] == "settled":
            if (stored["actual_micros"], stored["tokens"], stored["provider_id"]) != (
                actual_micros, tokens, provider_id
            ):
                raise RuntimeError("Conflicting settlement for a completed request.")
            return
        if stored["status"] == "unknown" and status == "unknown":
            return
        if personal is None or global_usage is None:
            raise RuntimeError("Daily ledger is missing; refusing to create a negative settlement balance.")
        previous_tokens = int(stored.get("tokens", 0))
        correction = {
            "micros": firestore.Increment(actual_micros - reservation.micros),
            "tokens": firestore.Increment(tokens - previous_tokens),
        }
        if min(int(personal["micros"]), int(global_usage["micros"])) + actual_micros - reservation.micros < 0:
            raise RuntimeError("Settlement would make a daily balance negative.")
        transaction.set(usage, correction, merge=True)
        transaction.set(shared, correction, merge=True)
        if actual_micros > reservation.micros:
            transaction.set(shared, {"blocked": True, "block_reason": "Provider price ceiling exceeded"}, merge=True)
            transaction.set(control, {"blocked": True, "reason": "Provider price ceiling exceeded",
                                      "request_id": reservation.request_id, "updated_at": firestore.SERVER_TIMESTAMP}, merge=True)
        result: dict[str, object] = {
            "status": status, "actual_micros": actual_micros, "tokens": tokens,
            "provider_id": provider_id, "updated_at": firestore.SERVER_TIMESTAMP,
        }
        if status == "settled":
            result["ttl"] = quota.ttl_after(quota.USAGE_RETENTION_DAYS)
        transaction.set(record, result, merge=True)

    transactions.run(db, apply)
    if actual_micros > reservation.micros:
        raise RuntimeError("Provider exceeded its reserved price ceiling; charge recorded for investigation.")
