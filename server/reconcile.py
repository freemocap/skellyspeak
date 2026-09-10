"""Inspect unresolved reservations or settle one against an OpenRouter receipt.

Run with application-default credentials and GOOGLE_CLOUD_PROJECT set.
The settle command also requires OPENROUTER_API_KEY in the environment.
Unknown requests without a provider generation ID remain reserved for investigation.
"""

from __future__ import annotations

import argparse
import math
import os

import httpx
from google.cloud import firestore

import budget
import quota


def receipt(payload: dict[str, object], *, provider_id: str) -> tuple[int, int]:
    data = payload.get("data")
    if not isinstance(data, dict) or data.get("id") != provider_id:
        raise ValueError("Provider receipt does not match this reservation's generation ID.")
    cost = data.get("total_cost")
    counts = (data.get("tokens_prompt"), data.get("tokens_completion"))
    if type(cost) not in (int, float) or not math.isfinite(cost) or cost < 0:
        raise ValueError("Receipt cost must be finite and nonnegative.")
    if any(type(count) is not int or count < 0 for count in counts):
        raise ValueError("Receipt token counts must be nonnegative integers.")
    return quota.dollars_to_micros(cost), sum(counts)


def settle(db: firestore.Client, *, user_id: str, request_id: str, api_key: str) -> None:
    stored = db.collection(quota.USERS).document(user_id).collection(budget.RESERVATIONS).document(request_id).get().to_dict()
    if stored is None:
        raise ValueError("Reservation does not exist.")
    if stored["status"] == "settled":
        raise ValueError("Reservation is already settled.")
    provider_id = stored.get("provider_id")
    if not isinstance(provider_id, str) or not provider_id.startswith("gen-"):
        raise ValueError("No OpenRouter generation ID is available. Keep the reservation until billing can be verified.")
    if not api_key.strip():
        raise ValueError("OPENROUTER_API_KEY is required to verify the receipt.")
    response = httpx.get(url="https://openrouter.ai/api/v1/generation", params={"id": provider_id},
                         headers={"Authorization": f"Bearer {api_key}"}, timeout=30)
    response.raise_for_status()
    actual, tokens = receipt(response.json(), provider_id=provider_id)
    budget.settle(db, reservation=budget.Reservation(user_id=user_id, request_id=request_id,
                  day=stored["day"], micros=stored["reserved_micros"]), actual_micros=actual,
                  tokens=tokens, status="settled", provider_id=provider_id)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list")
    reconcile = commands.add_parser("settle")
    reconcile.add_argument("--user", required=True)
    reconcile.add_argument("--request", required=True)
    args = parser.parse_args()
    db = firestore.Client()
    if args.command == "settle":
        settle(db, user_id=args.user, request_id=args.request, api_key=os.environ.get("OPENROUTER_API_KEY", ""))
        print("Reservation reconciled against the provider receipt.")
        return
    for user in db.collection(quota.USERS).stream():
        for record in user.reference.collection(budget.RESERVATIONS).stream():
            data = record.to_dict()
            if data["status"] != "settled":
                print(f"{user.id} {record.id} {data['day']} {data['status']} "
                      f"reserved={data['reserved_micros']} provider={data.get('provider_id', '(unknown)')}")


if __name__ == "__main__":
    main()
