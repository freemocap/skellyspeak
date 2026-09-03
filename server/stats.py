"""Who is using the hosted service, and what it is costing.

Read-only. It opens nothing, changes nothing, and touches no secrets — it reads
the same Firestore collections the service writes.

    cd server
    uv run python stats.py              # today
    uv run python stats.py --days 7     # the last week
    uv run python stats.py --emails     # show addresses instead of masking them

Authentication is your own gcloud login:

    gcloud auth application-default login

Email addresses are masked by default. They belong to your testers rather than
to you, and a usage report is rarely the place that needs them — pass
`--emails` when it is.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from google.cloud import firestore

import quota


def mask(address: str) -> str:
    """`someone@example.com` -> `s*****@example.com`."""
    if "@" not in address:
        return address or "(no address)"
    local, _, domain = address.partition("@")
    head = local[0] if local else "?"
    return f"{head}{'*' * max(len(local) - 1, 1)}@{domain}"


def money(micros: int) -> str:
    return f"${quota.micros_to_dollars(micros):.4f}"


def days_back(count: int) -> list[str]:
    today = datetime.now(timezone.utc).date()
    return [(today - timedelta(days=n)).strftime("%Y-%m-%d") for n in range(count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=1, help="how many UTC days to report")
    parser.add_argument("--emails", action="store_true", help="show full email addresses")
    args = parser.parse_args()

    db = firestore.Client()
    show = (lambda a: a or "(no address)") if args.emails else mask
    window = days_back(max(args.days, 1))

    # ── Accounts ────────────────────────────────────────────────────────────
    # The same count MAX_USERS is checked against — there is no separate
    # counter to disagree with.
    users = list(db.collection(quota.USERS).stream())

    print()
    print(f"ACCOUNTS  {len(users)}")
    print()

    # ── Per user ────────────────────────────────────────────────────────────
    total_micros = 0
    for user in sorted(users, key=lambda u: u.id):
        data = user.to_dict() or {}
        print(f"  {show(data.get('email', ''))}")
        print(f"    id            {user.id}")
        created = data.get("created_at")
        seen = data.get("last_seen")
        print(f"    created       {created}")
        print(f"    last seen     {seen}")
        if int(data.get("token_version") or 0):
            print(f"    token version {data['token_version']}  (older sessions revoked)")

        spent = 0
        seen_any = False
        for day in window:
            usage = (
                db.collection(quota.USERS)
                .document(user.id)
                .collection(quota.USAGE)
                .document(day)
                .get()
            )
            if not usage.exists:
                continue
            seen_any = True
            u = usage.to_dict() or {}
            micros = int(u.get("micros") or 0)
            tokens = int(u.get("tokens") or 0)
            requests = int(u.get("requests") or 0)
            spent += micros
            per = f"{money(micros // requests)}/req" if requests else "-"
            print(
                f"    {day}    {money(micros):>10}  {tokens:>9,} tokens  "
                f"{requests:>4} requests  {per}"
            )
        if not seen_any:
            print("    (no usage in this window)")
        total_micros += spent

        devices = list(
            db.collection(quota.USERS).document(user.id).collection(quota.DEVICES).stream()
        )
        for device in devices:
            d = device.to_dict() or {}
            print(
                f"    device        {d.get('platform', '?')} "
                f"v{d.get('app_version', '?')}  last seen {d.get('last_seen')}"
            )
        print()

    # ── Everyone together ───────────────────────────────────────────────────
    print("GLOBAL")
    global_total = 0
    for day in window:
        snapshot = db.collection(quota.GLOBAL_USAGE).document(day).get()
        if not snapshot.exists:
            print(f"  {day}    (nothing)")
            continue
        g = snapshot.to_dict() or {}
        micros = int(g.get("micros") or 0)
        global_total += micros
        print(
            f"  {day}    {money(micros):>10}  {int(g.get('tokens') or 0):>9,} tokens  "
            f"{int(g.get('requests') or 0):>4} requests"
        )
    print()
    print(f"  {len(window)}-day total   {money(global_total)}")
    if total_micros != global_total:
        # The per-user documents and the global counter are written in the same
        # call, so a mismatch means one of the writes failed.
        print(f"  ! per-user sum is {money(total_micros)}: the two counters disagree")
    print()

    # ── Sign-in flows left half-finished ────────────────────────────────────
    pending = len(list(db.collection(quota.AUTH_STATES).limit(50).stream()))
    codes = len(list(db.collection(quota.LOGIN_CODES).limit(50).stream()))
    if pending or codes:
        print(
            f"IN FLIGHT  {pending} sign-in states, {codes} unredeemed codes "
            "(both expire in 2 minutes and are swept by TTL)"
        )
        print()


if __name__ == "__main__":
    main()
