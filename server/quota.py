"""Usage accounting, in Firestore.

Two ceilings, and both matter:

* **Per user, per day** — what any one person can spend.
* **Globally, per day** — what everyone together can spend. Per-user limits do
  nothing about ten thousand sign-ups on launch day, and the bill for that
  lands on us, not them.

Counters are keyed by UTC date and increment transactionally, because two
concurrent requests from the same account must not both read the same balance
and both decide there is room.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from google.cloud import firestore

USERS = "users"
USAGE = "usage"
GLOBAL_USAGE = "global_usage"
LOGIN_CODES = "login_codes"


def utc_day() -> str:
    """The bucket key. UTC so the reset moment is the same for everyone."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass(frozen=True)
class Balance:
    used: int
    limit: int

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)

    @property
    def exhausted(self) -> bool:
        return self.used >= self.limit


class QuotaExceeded(Exception):
    """Out of allowance. The message is shown to the user verbatim."""


def _usage_ref(db: firestore.Client, user_id: str, day: str):
    return db.collection(USERS).document(user_id).collection(USAGE).document(day)


def _global_ref(db: firestore.Client, day: str):
    return db.collection(GLOBAL_USAGE).document(day)


def read_balance(db: firestore.Client, user_id: str, *, limit: int) -> Balance:
    """What this user has spent today. Absent document means nothing yet."""
    snapshot = _usage_ref(db, user_id, utc_day()).get()
    used = int(snapshot.get("tokens") or 0) if snapshot.exists else 0
    return Balance(used=used, limit=limit)


def check_allowed(
    db: firestore.Client, user_id: str, *, user_limit: int, global_limit: int
) -> Balance:
    """Raise if this request should not proceed; otherwise report the balance.

    Checked before the upstream call rather than after, so an exhausted
    account costs nothing.
    """
    day = utc_day()

    global_snapshot = _global_ref(db, day).get()
    global_used = int(global_snapshot.get("tokens") or 0) if global_snapshot.exists else 0
    if global_used >= global_limit:
        raise QuotaExceeded(
            "SkellySpeak has reached its shared daily limit. It resets at "
            "00:00 UTC. You can use your own API key in Settings in the "
            "meantime."
        )

    balance = read_balance(db, user_id, limit=user_limit)
    if balance.exhausted:
        raise QuotaExceeded(
            f"You have used your {user_limit:,} tokens for today. This resets "
            "at 00:00 UTC. You can add your own API key in Settings to keep "
            "going now."
        )
    return balance


def record_usage(db: firestore.Client, user_id: str, *, tokens: int) -> None:
    """Add spent tokens to both counters.

    `Increment` is applied server-side by Firestore, so concurrent requests
    from the same account cannot lose an update by reading and writing back a
    stale total.
    """
    if tokens <= 0:
        return
    day = utc_day()
    bump = firestore.Increment(tokens)
    _usage_ref(db, user_id, day).set(
        {"tokens": bump, "day": day}, merge=True
    )
    _global_ref(db, day).set({"tokens": bump, "day": day}, merge=True)


def upsert_user(db: firestore.Client, *, user_id: str, email: str, name: str) -> None:
    """Record who signed in. Overwrites profile fields, never usage."""
    db.collection(USERS).document(user_id).set(
        {
            "email": email,
            "name": name,
            "last_seen": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
