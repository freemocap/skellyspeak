"""Read-only account diagnostics; no global usage totals or other identities."""
from __future__ import annotations
import os
from google.cloud import firestore
import admission
import budget
import quota
import transactions
from observability import reset_at


def read(db: firestore.Client, who: quota.Principal, *, global_limit: int) -> dict[str, object]:
    day = quota.utc_day()
    user = db.collection(quota.USERS).document(who.user_id)

    @firestore.transactional
    def snapshot(transaction):
        def data(ref):
            return ref.get(transaction=transaction).to_dict() or {}
        personal = data(user.collection(quota.USAGE).document(day))
        requests = data(user.collection(admission.ADMISSION).document(day))
        shared_requests = data(db.collection(admission.ADMISSION).document(day))
        shared = data(db.collection(quota.GLOBAL_USAGE).document(day))
        controls = data(db.collection(budget.CONTROLS).document(budget.SPENDING))
        used = int(personal.get("micros", 0))
        count = int(requests.get("requests", 0))
        return {
            "revision": os.environ.get("K_REVISION", "local")[:128],
            "resets_at": reset_at(),
            "account_requests": {"used": count, "limit": admission.ACCOUNT_REQUESTS_PER_DAY,
                                 "exhausted": count >= admission.ACCOUNT_REQUESTS_PER_DAY},
            "account_allowance": {"used_micros": used, "limit_micros": who.daily_limit,
                                  "remaining_micros": max(0, who.daily_limit - used)},
            "shared_requests_exhausted": int(shared_requests.get("account_requests", 0)) >= admission.GLOBAL_REQUESTS_PER_DAY,
            "shared_allowance_exhausted": int(shared.get("micros", 0)) >= global_limit,
            "spending_paused": bool(controls.get("blocked") or shared.get("blocked")),
            "diagnostics_requests": {"used": int(requests.get("diagnostics_requests", 0)),
                                     "limit": admission.DIAGNOSTICS_PER_DAY},
            "scope": "Admission snapshot; does not test provider availability or reserve a chat request.",
        }
    return transactions.run(db, snapshot)
