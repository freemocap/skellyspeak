"""Provision timestamp-based retention without reading application documents."""
from __future__ import annotations

import json
import time

COLLECTIONS = (
    "auth_states", "login_codes", "admission", "usage",
    "global_usage", "devices", "reservations", "work_attempts",
)


class RetentionError(RuntimeError):
    pass


def ensure_retention(project: str, *, call, pause=time.sleep) -> None:
    scope = [f"--project={project}", "--database=(default)", "--quiet"]
    prefix = f"projects/{project}/databases/(default)/collectionGroups/"
    names = {prefix + group + "/fields/ttl": group for group in COLLECTIONS}

    def states() -> dict[str, str]:
        rows = json.loads(call(["firestore", "fields", "ttls", "list", *scope, "--format=json"]))
        if not isinstance(rows, list):
            raise RetentionError("TTL_INVALID_METADATA")
        result = {}
        for row in rows:
            if not isinstance(row, dict):
                raise RetentionError("TTL_INVALID_METADATA")
            name = row.get("name")
            if isinstance(name, str) and name in names:
                config = row.get("ttlConfig", {})
                if not isinstance(config, dict):
                    raise RetentionError("TTL_INVALID_METADATA")
                # Retention timestamps already encode the intended deadline.
                if config.get("expirationOffset", "0s") != "0s":
                    raise RetentionError("TTL_UNEXPECTED_EXPIRATION_OFFSET")
                result[names[name]] = config.get("state", "")
        return result

    current = states()
    for group in COLLECTIONS:
        state = current.get(group)
        if state not in {"ACTIVE", "CREATING"}:
            call(["firestore", "fields", "ttls", "update", "ttl",
                  f"--collection-group={group}", "--enable-ttl", "--async", *scope])
    for attempt in range(120):
        current = states()
        if all(current.get(group) == "ACTIVE" for group in COLLECTIONS):
            print(json.dumps({"stage": "retention_verified", "collection_groups": list(COLLECTIONS)}), flush=True)
            return
        if any(value in {"NEEDS_REPAIR"} for value in current.values()):
            raise RetentionError("TTL_POLICY_NEEDS_REPAIR")
        if attempt < 119:
            pause(5)
    raise RetentionError("TTL_ACTIVATION_PENDING")
