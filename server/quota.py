"""Usage accounting, in Firestore.

Two ceilings, and both matter:

* **Per user, per day** — what any one person can spend.
* **Globally, per day** — what everyone together can spend. Per-user limits do
  nothing about ten thousand sign-ups on launch day, and the bill for that
  lands on us, not them.

Counters are keyed by UTC date and increment transactionally, because two
concurrent requests from the same account must not both read the same balance
and both decide there is room.

There is a third ceiling that is not about tokens at all: **how many accounts
may exist**. While the real cost of a conversation is still unmeasured, that is
the lever that actually bounds the bill.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from google.cloud import firestore

USERS = "users"
USAGE = "usage"
GLOBAL_USAGE = "global_usage"
LOGIN_CODES = "login_codes"
# Holds the running account total. A counter document, rather than counting
# the users collection: a count query is neither atomic nor free, and the
# number it returns is stale the moment two people sign in at once.
META = "meta"
SIGNUPS = "signups"
DEVICES = "devices"

# How long usage records live. Firestore deletes them itself, driven by a TTL
# policy on the `ttl` field — see the deploy notes in docs/hosted-api.md. Long
# enough to compare one month against another, short enough that we are not
# the custodian of an indefinite record of when somebody practises a language.
USAGE_RETENTION_DAYS = 90


def ttl_after(days: int) -> datetime:
    """The instant Firestore should delete a document written now."""
    return datetime.now(timezone.utc) + timedelta(days=days)


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


class SignupClosed(Exception):
    """The account ceiling is full. The message is shown to the user verbatim."""


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
    """Add spent tokens, and one request, to both counters.

    `Increment` is applied server-side by Firestore, so concurrent requests
    from the same account cannot lose an update by reading and writing back a
    stale total.

    The request tally is what makes the token figure interpretable: 40,000
    tokens across three turns and across thirty are very different things, and
    only the ratio says which happened.
    """
    if tokens < 0:
        raise ValueError(f"token usage cannot be negative, got {tokens}")
    day = utc_day()
    entry = {
        "tokens": firestore.Increment(tokens),
        "requests": firestore.Increment(1),
        "day": day,
        "ttl": ttl_after(USAGE_RETENTION_DAYS),
    }
    _usage_ref(db, user_id, day).set(entry, merge=True)
    _global_ref(db, day).set(entry, merge=True)


def record_device(
    db: firestore.Client,
    user_id: str,
    *,
    install_id: str,
    platform: str,
    app_version: str,
) -> None:
    """Note that this account was used from this installation.

    The id is a random UUID the app generates on first run — not a hardware or
    advertising id, and a reinstall produces a new one. With the platform and
    app version it answers how many machines someone uses, which systems to
    keep supporting, and which versions are still in the wild. Nothing here
    locates or identifies a person, and no IP address is recorded.
    """
    if not install_id:
        return
    ref = db.collection(USERS).document(user_id).collection(DEVICES).document(install_id)
    entry = {
        "platform": platform,
        "app_version": app_version,
        "last_seen": firestore.SERVER_TIMESTAMP,
        "ttl": ttl_after(USAGE_RETENTION_DAYS),
    }
    # Only on the first sighting: merging SERVER_TIMESTAMP every time would
    # move `first_seen` forward with it and the two would always be equal.
    if not ref.get().exists:
        entry["first_seen"] = firestore.SERVER_TIMESTAMP
    ref.set(entry, merge=True)


def upsert_user(
    db: firestore.Client, *, user_id: str, email: str, name: str, max_users: int
) -> None:
    """Record who signed in, refusing new accounts past the ceiling.

    Transactional, because the check and the increment must be one step: two
    people signing in at the same instant must not both read "5 accounts" and
    both become the sixth.

    Someone who already has an account is never affected by the ceiling and
    never counted twice — lowering `max_users` below the current total locks
    out new sign-ups without evicting anybody.
    """
    user_ref = db.collection(USERS).document(user_id)
    counter_ref = db.collection(META).document(SIGNUPS)

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> None:
        # Every read must precede every write inside a transaction.
        existing = user_ref.get(transaction=transaction)
        counter = counter_ref.get(transaction=transaction)

        profile = {
            "email": email,
            "name": name,
            "last_seen": firestore.SERVER_TIMESTAMP,
        }
        if existing.exists:
            transaction.set(user_ref, profile, merge=True)
            return

        count = int((counter.to_dict() or {}).get("count") or 0)
        if count >= max_users:
            raise SignupClosed(
                "SkellySpeak's free hosted service is in closed testing and is "
                "currently full. You can still use the app with your own API "
                "key, or your own AI server — both are in Settings."
            )
        transaction.set(
            user_ref, {**profile, "created_at": firestore.SERVER_TIMESTAMP}, merge=True
        )
        transaction.set(counter_ref, {"count": count + 1}, merge=True)

    apply(db.transaction())
