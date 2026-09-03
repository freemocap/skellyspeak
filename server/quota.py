"""Usage accounting, in Firestore.

The unit is **money**, not tokens. OpenRouter reports `usage.cost` for every
request, so this records what was actually charged. A token budget was
misleading in both directions: the price of a token varies about a hundredfold
across models, and the model is chosen by the caller.

Money is held as **micro-dollars** (1_000_000 = $1) because Firestore counters
must be integers to increment atomically, and float dollars accumulate drift.
Token counts are still recorded, but as *reporting* — they are what make a cost
figure interpretable, not what the limit is enforced against.

Three ceilings, and all three matter:

* **Per user, per day** — what any one person can spend.
* **Globally, per day** — what everyone together can spend. Per-user limits do
  nothing about ten thousand sign-ups on launch day, and the bill for that
  lands on us, not them.
* **How many accounts may exist** — the lever that bounds the other two.

Counters are keyed by UTC date and increment transactionally, because two
concurrent requests from the same account must not both read the same balance
and both decide there is room.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from google.cloud import firestore

USERS = "users"
USAGE = "usage"
GLOBAL_USAGE = "global_usage"
LOGIN_CODES = "login_codes"
# Sign-in round trips in progress. A constant like every other collection:
# a bare string literal here is one typo away from writing to, and then
# reading from, two different collections that both look right.
AUTH_STATES = "auth_states"
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

MICROS_PER_DOLLAR = 1_000_000


def dollars_to_micros(dollars: float) -> int:
    """Round UP. A fraction of a micro-dollar that rounded down would be free,
    and "free" repeated a million times is how a budget leaks."""
    micros = dollars * MICROS_PER_DOLLAR
    whole = int(micros)
    return whole + 1 if micros > whole else whole


def micros_to_dollars(micros: int) -> float:
    return micros / MICROS_PER_DOLLAR


def ttl_after(days: int) -> datetime:
    """The instant Firestore should delete a document written now."""
    return datetime.now(timezone.utc) + timedelta(days=days)


def utc_day() -> str:
    """The bucket key. UTC so the reset moment is the same for everyone."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass(frozen=True)
class Balance:
    """What has been spent today, in micro-dollars."""

    used: int
    limit: int
    # Reporting only — these do not gate anything.
    tokens: int = 0
    requests: int = 0

    @property
    def remaining(self) -> int:
        return max(0, self.limit - self.used)

    @property
    def exhausted(self) -> bool:
        return self.used >= self.limit

    @property
    def micros_per_request(self) -> int:
        """What a request has cost this user today, on average.

        Used to turn "you have $0.31 left" into "about 40 more replies", which
        is the only form of that number anyone can act on. Derived from their
        own usage rather than a guess baked into the code, so it tracks
        whatever model and conversation length they are actually using.
        """
        return self.used // self.requests if self.requests > 0 else 0

    @property
    def tokens_per_request(self) -> int:
        return self.tokens // self.requests if self.requests > 0 else 0


class QuotaExceeded(Exception):
    """Out of allowance. The message is shown to the user verbatim."""


class SignupClosed(Exception):
    """The account ceiling is full. The message is shown to the user verbatim."""


class SessionRevoked(Exception):
    """The account behind this session is gone or its sessions were revoked."""


def _usage_ref(db: firestore.Client, user_id: str, day: str):
    return db.collection(USERS).document(user_id).collection(USAGE).document(day)


def _global_ref(db: firestore.Client, day: str):
    return db.collection(GLOBAL_USAGE).document(day)


def _read(snapshot, field: str) -> int:
    return int(snapshot.get(field) or 0) if snapshot.exists else 0


def read_balance(db: firestore.Client, user_id: str, *, limit: int) -> Balance:
    """What this user has spent today. Absent document means nothing yet."""
    snapshot = _usage_ref(db, user_id, utc_day()).get()
    return Balance(
        used=_read(snapshot, "micros"),
        limit=limit,
        tokens=_read(snapshot, "tokens"),
        requests=_read(snapshot, "requests"),
    )


def assert_session_valid(db: firestore.Client, user_id: str, *, token_version: int) -> None:
    """Refuse a session whose account is gone, or whose sessions were revoked.

    Without this a session token is valid for its full 30 days no matter what
    happens to the account behind it: deleting a user, or removing them from
    the tester list, would change nothing until the token expired on its own.
    Bumping `token_version` on the user document is the per-account revocation
    lever, and deleting the document is the blunt one.
    """
    snapshot = db.collection(USERS).document(user_id).get()
    if not snapshot.exists:
        raise SessionRevoked("This account no longer exists. Sign in again.")
    current = int(snapshot.get("token_version") or 0)
    if token_version < current:
        raise SessionRevoked("This session was signed out remotely. Sign in again.")


def check_allowed(
    db: firestore.Client, user_id: str, *, user_limit: int, global_limit: int
) -> Balance:
    """Raise if this request should not proceed; otherwise report the balance.

    Checked before the upstream call rather than after, so an exhausted
    account costs nothing.
    """
    day = utc_day()

    global_used = _read(_global_ref(db, day).get(), "micros")
    if global_used >= global_limit:
        raise QuotaExceeded(
            "SkellySpeak has reached its shared daily limit. It resets at "
            "00:00 UTC. You can use your own API key in Settings in the "
            "meantime."
        )

    balance = read_balance(db, user_id, limit=user_limit)
    if balance.exhausted:
        raise QuotaExceeded(
            f"You have used your ${micros_to_dollars(user_limit):.2f} of free "
            "usage for today. It resets at 00:00 UTC. You can add your own API "
            "key in Settings to keep going now."
        )
    return balance


def _apply(db: firestore.Client, user_id: str, *, micros: int, tokens: int, requests: int) -> None:
    entry = {
        "micros": firestore.Increment(micros),
        "tokens": firestore.Increment(tokens),
        "requests": firestore.Increment(requests),
        "day": utc_day(),
        "ttl": ttl_after(USAGE_RETENTION_DAYS),
    }
    day = utc_day()
    _usage_ref(db, user_id, day).set(entry, merge=True)
    _global_ref(db, day).set(entry, merge=True)


def reserve(db: firestore.Client, user_id: str, *, micros: int) -> None:
    """Charge an estimate BEFORE the upstream call.

    `check_allowed` reads, and `record_usage` writes only once the answer comes
    back. Between those two points nothing is holding the money, so twenty
    concurrent requests all read the same balance, all decide there is room,
    and all proceed. The account then blows through its limit by however many
    requests it managed to start at once.

    Reserving closes that window: the estimate lands immediately, so the next
    check sees it. `settle` corrects it to the real figure afterwards.
    """
    if micros < 0:
        raise ValueError(f"a reservation cannot be negative, got {micros}")
    _apply(db, user_id, micros=micros, tokens=0, requests=1)


def settle(
    db: firestore.Client,
    user_id: str,
    *,
    reserved_micros: int,
    actual_micros: int,
    tokens: int,
) -> None:
    """Replace a reservation with what the request actually cost.

    The correction is signed: an over-estimate refunds, an under-estimate
    charges the difference. The request itself was already counted by
    `reserve`, so nothing is added to the tally here.
    """
    if actual_micros < 0:
        raise ValueError(f"usage cannot be negative, got {actual_micros}")
    if tokens < 0:
        raise ValueError(f"token usage cannot be negative, got {tokens}")
    _apply(
        db,
        user_id,
        micros=actual_micros - reserved_micros,
        tokens=tokens,
        requests=0,
    )


def record_usage(
    db: firestore.Client, user_id: str, *, micros: int, tokens: int = 0
) -> None:
    """Charge a request that was never reserved, counting it as one request."""
    if micros < 0:
        raise ValueError(f"usage cannot be negative, got {micros}")
    if tokens < 0:
        raise ValueError(f"token usage cannot be negative, got {tokens}")
    _apply(db, user_id, micros=micros, tokens=tokens, requests=1)


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
) -> int:
    """Record who signed in, refusing new accounts past the ceiling.

    Returns the account's current `token_version`, which is stamped into the
    session token so revocation can invalidate it later.

    Transactional, because the check and the increment must be one step: two
    people signing in at the same instant must not both read "5 accounts" and
    both become the sixth.

    Someone who already has an account is never affected by the ceiling and
    never counted twice — lowering `max_users` below the current total locks
    out new sign-ups without evicting anybody.
    """
    user_ref = db.collection(USERS).document(user_id)
    counter_ref = db.collection(META).document(SIGNUPS)
    version = 0

    @firestore.transactional
    def apply(transaction: firestore.Transaction) -> int:
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
            return int(existing.get("token_version") or 0)

        count = int((counter.to_dict() or {}).get("count") or 0)
        if count >= max_users:
            raise SignupClosed(
                "SkellySpeak's free hosted service is in closed testing and is "
                "currently full. You can still use the app with your own API "
                "key, or your own AI server — both are in Settings."
            )
        transaction.set(
            user_ref,
            {**profile, "created_at": firestore.SERVER_TIMESTAMP, "token_version": 0},
            merge=True,
        )
        transaction.set(counter_ref, {"count": count + 1}, merge=True)
        return 0

    version = apply(db.transaction())
    return int(version or 0)
