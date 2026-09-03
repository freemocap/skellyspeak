"""Who is using the hosted service, and what it is costing.

Read-only. It opens nothing, changes nothing, and touches no secrets — it reads
the same Firestore collections the service writes.

    cd server
    uv run python stats.py              # today
    uv run python stats.py --days 7     # the last week
    uv run python stats.py --emails     # show addresses instead of masking them

Two writes, both explicit and both needing --user:

    uv run python stats.py --user me@x.com --set-limit-usd 5
    uv run python stats.py --user me@x.com --reset-usage

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


def find_user(db: firestore.Client, needle: str) -> str:
    """Resolve an email or a raw id to a user id, refusing anything ambiguous."""
    if needle.startswith("google:"):
        if not db.collection(quota.USERS).document(needle).get().exists:
            raise SystemExit(f"No account with id {needle}")
        return needle
    matches = [
        doc.id
        for doc in db.collection(quota.USERS).stream()
        if (doc.to_dict() or {}).get("email", "").lower() == needle.lower()
    ]
    if not matches:
        raise SystemExit(f"No account with email {needle}")
    if len(matches) > 1:
        raise SystemExit(f"{needle} matches {len(matches)} accounts; use the id instead")
    return matches[0]


def apply_limit(db: firestore.Client, user_id: str, dollars: float) -> None:
    """Give one account its own daily ceiling, or take it away with 0.

    Deliberately a number rather than an "unlimited" switch. The global daily
    cap is what makes the worst case arithmetic instead of trust, and an
    account exempt from all limits would walk straight through the reasoning
    behind it — it would still be stopped by the global ceiling, but only after
    spending everyone else's allowance to get there.
    """
    ref = db.collection(quota.USERS).document(user_id)
    if dollars <= 0:
        ref.update({quota.LIMIT_FIELD: firestore.DELETE_FIELD})
        print(f"\n{user_id}: custom limit removed; back to the service default\n")
        return
    micros = quota.dollars_to_micros(dollars)
    ref.set({quota.LIMIT_FIELD: micros}, merge=True)
    print(f"\n{user_id}: daily limit set to ${dollars:.2f}\n")
    print("  The GLOBAL_DAILY_MICROS ceiling still applies on top of this, so")
    print("  raise it too if this limit is meant to be reachable:")
    print("    gcloud run services update skellyspeak-api --region=us-central1 \\")
    print("      --update-env-vars=GLOBAL_DAILY_MICROS=<micros>")
    print("  and mirror it into server/cloudbuild.yaml or the next deploy reverts it.\n")


def clear_today(db: firestore.Client, user_id: str) -> None:
    """Zero this account's spend for the current UTC day.

    The per-user document only. The global counter is left alone on purpose:
    the money was really spent, and quietly un-spending it in the shared total
    would hide real cost from the one number that bounds the bill.
    """
    day = quota.utc_day()
    db.collection(quota.USERS).document(user_id).collection(quota.USAGE).document(day).set(
        {"micros": 0, "tokens": 0, "requests": 0, "day": day,
         "ttl": quota.ttl_after(quota.USAGE_RETENTION_DAYS)},
    )
    print(f"\n{user_id}: usage for {day} reset to zero")
    print("  (the global daily total is unchanged - that spend really happened)\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=1, help="how many UTC days to report")
    parser.add_argument("--emails", action="store_true", help="show full email addresses")
    parser.add_argument("--user", help="email or id, for the two write actions below")
    parser.add_argument(
        "--set-limit-usd",
        type=float,
        help="give this account its own daily limit in dollars (0 removes it)",
    )
    parser.add_argument(
        "--reset-usage",
        action="store_true",
        help="zero today's spend for this account",
    )
    args = parser.parse_args()

    db = firestore.Client()
    show = (lambda a: a or "(no address)") if args.emails else mask
    window = days_back(max(args.days, 1))

    if (args.set_limit_usd is not None or args.reset_usage) and not args.user:
        raise SystemExit("--set-limit-usd and --reset-usage need --user")
    if args.user:
        target = find_user(db, args.user)
        if args.set_limit_usd is not None:
            apply_limit(db, target, args.set_limit_usd)
        if args.reset_usage:
            clear_today(db, target)

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
