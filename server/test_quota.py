"""The account ceiling — the lever that bounds the bill while the real cost of
a conversation is still unmeasured.

Firestore's own atomicity is not ours to test, so `@firestore.transactional` is
replaced with a pass-through here. What IS ours is the logic inside it: that
the ceiling is checked before the account is created, that an existing user is
never blocked or counted twice, and that lowering the ceiling below the current
total locks out newcomers without evicting anybody.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from google.cloud import firestore

import quota


class FakeSnapshot:
    def __init__(self, data: dict | None):
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict | None:
        return dict(self._data) if self._data is not None else None


class FakeDocRef:
    def __init__(self, store: dict, path: str):
        self._store = store
        self.path = path

    def get(self, transaction=None) -> FakeSnapshot:
        return FakeSnapshot(self._store.get(self.path))

    def collection(self, name: str) -> "FakeCollection":
        return FakeCollection(self._store, f"{self.path}/{name}")

    def set(self, data: dict, merge: bool = False) -> None:
        current = self._store.setdefault(self.path, {}) if merge else {}
        for field, value in data.items():
            # Firestore applies Increment server-side, adding to whatever is
            # there. A fake that simply stored the sentinel would let a
            # counter bug pass, so it is emulated rather than ignored.
            if isinstance(value, firestore.Increment):
                current[field] = (current.get(field) or 0) + value.value
            else:
                current[field] = value
        self._store[self.path] = current


class FakeCollection:
    def __init__(self, store: dict, path: str):
        self._store = store
        self.path = path

    def document(self, doc_id: str) -> FakeDocRef:
        return FakeDocRef(self._store, f"{self.path}/{doc_id}")


class FakeTransaction:
    """Writes apply immediately; ordering is what the tests care about."""

    def set(self, ref: FakeDocRef, data: dict, merge: bool = False) -> None:
        ref.set(data, merge=merge)


class FakeDb:
    def __init__(self):
        self.store: dict[str, dict] = {}

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self.store, name)

    def transaction(self) -> FakeTransaction:
        return FakeTransaction()


@pytest.fixture
def db(monkeypatch):
    # Pass-through: run the transaction body directly against the fake.
    monkeypatch.setattr(firestore, "transactional", lambda fn: fn)
    return FakeDb()


def signup(db, n: int, *, max_users: int) -> None:
    quota.upsert_user(
        db,
        user_id=f"google:{n}",
        email=f"user{n}@example.com",
        name=f"User {n}",
        max_users=max_users,
    )


def counted(db) -> int:
    return db.store.get(f"{quota.META}/{quota.SIGNUPS}", {}).get("count", 0)


class TestAccountCeiling:
    def test_accounts_up_to_the_ceiling_are_created(self, db):
        for n in range(6):
            signup(db, n, max_users=6)
        assert counted(db) == 6
        assert db.store["users/google:0"]["email"] == "user0@example.com"

    def test_the_next_account_is_refused_with_a_readable_message(self, db):
        for n in range(6):
            signup(db, n, max_users=6)
        with pytest.raises(quota.SignupClosed) as caught:
            signup(db, 6, max_users=6)
        # The message reaches the user's screen verbatim, so it must point
        # somewhere useful rather than just saying no.
        assert "closed testing" in str(caught.value)
        assert "Settings" in str(caught.value)
        # And nothing was written for the refused account.
        assert counted(db) == 6
        assert "users/google:6" not in db.store

    def test_an_existing_user_is_never_blocked_or_double_counted(self, db):
        for n in range(6):
            signup(db, n, max_users=6)
        # Full — but someone who already has an account signs in as usual.
        signup(db, 3, max_users=6)
        signup(db, 3, max_users=6)
        assert counted(db) == 6

    def test_signing_in_again_refreshes_the_profile(self, db):
        signup(db, 1, max_users=6)
        quota.upsert_user(
            db, user_id="google:1", email="new@example.com", name="Renamed", max_users=6
        )
        assert db.store["users/google:1"]["email"] == "new@example.com"
        assert db.store["users/google:1"]["name"] == "Renamed"
        assert counted(db) == 1

    def test_lowering_the_ceiling_locks_out_newcomers_without_evicting_anyone(self, db):
        for n in range(6):
            signup(db, n, max_users=6)
        # Ceiling dropped below the current total: existing users carry on...
        signup(db, 2, max_users=2)
        assert "users/google:2" in db.store
        # ...and no one new gets in.
        with pytest.raises(quota.SignupClosed):
            signup(db, 99, max_users=2)

    def test_a_ceiling_of_zero_admits_nobody(self, db):
        with pytest.raises(quota.SignupClosed):
            signup(db, 0, max_users=0)
        assert counted(db) == 0


class TestDeviceRecords:
    """What we keep about a person, and — more importantly — what we do not."""

    def record(self, db, install="install-a", platform="windows", version="0.2.0"):
        quota.record_device(
            db,
            "google:1",
            install_id=install,
            platform=platform,
            app_version=version,
        )

    def device(self, db, install="install-a") -> dict:
        return db.store[f"users/google:1/{quota.DEVICES}/{install}"]

    def test_it_keeps_only_the_installation_platform_and_version(self, db):
        self.record(db)
        stored = set(self.device(db))
        # The whole record, enumerated. If this assertion ever needs relaxing,
        # that is a privacy decision and a Play Store Data Safety change —
        # not a detail to adjust in passing.
        assert stored == {"platform", "app_version", "last_seen", "first_seen", "ttl"}
        # Named explicitly because these are the things it must never grow.
        for forbidden in ("ip", "ip_address", "location", "country", "device_name"):
            assert forbidden not in stored

    def test_a_missing_install_id_records_nothing(self, db):
        # An older client, or a request without the header, must not create a
        # device row keyed on the empty string.
        self.record(db, install="")
        assert not any(quota.DEVICES in path for path in db.store)

    def test_several_machines_are_tracked_separately(self, db):
        self.record(db, install="laptop", platform="macos")
        self.record(db, install="phone", platform="android")
        assert self.device(db, "laptop")["platform"] == "macos"
        assert self.device(db, "phone")["platform"] == "android"

    def test_first_seen_stays_put_while_last_seen_moves(self, db):
        self.record(db)
        first = self.device(db)["first_seen"]
        self.record(db, version="0.3.0")
        again = self.device(db)
        # Merging a server timestamp into first_seen every time would drag it
        # along with last_seen and the two would always be equal.
        assert again["first_seen"] is first
        assert "last_seen" in again
        # An upgrade is visible on the machine that upgraded.
        assert again["app_version"] == "0.3.0"


class TestUsageAccounting:
    def test_requests_are_counted_alongside_tokens(self, db):
        quota.record_usage(db, "google:1", tokens=1200)
        quota.record_usage(db, "google:1", tokens=800)
        day = quota.utc_day()
        entry = db.store[f"users/google:1/{quota.USAGE}/{day}"]
        # 40,000 tokens over three turns and over thirty are different things,
        # and only the ratio tells you which happened.
        assert entry["requests"] == 2
        assert entry["tokens"] == 2000
        assert db.store[f"{quota.GLOBAL_USAGE}/{day}"]["requests"] == 2

    def test_a_zero_token_response_still_counts_as_a_request(self, db):
        # A provider that reports no usage still cost a call; dropping it would
        # quietly understate how much the service is being used.
        quota.record_usage(db, "google:1", tokens=0)
        day = quota.utc_day()
        assert db.store[f"users/google:1/{quota.USAGE}/{day}"]["requests"] == 1

    def test_negative_usage_is_a_bug_not_a_credit(self, db):
        with pytest.raises(ValueError):
            quota.record_usage(db, "google:1", tokens=-5)

    def test_usage_carries_an_expiry_firestore_can_act_on(self, db):
        quota.record_usage(db, "google:1", tokens=10)
        ttl = db.store[f"users/google:1/{quota.USAGE}/{quota.utc_day()}"]["ttl"]
        # A Firestore TTL policy acts on a timestamp field, not the unix ints
        # used elsewhere for expiry logic.
        assert isinstance(ttl, datetime)
        ahead = (ttl - datetime.now(timezone.utc)).days
        assert ahead == pytest.approx(quota.USAGE_RETENTION_DAYS, abs=1)
