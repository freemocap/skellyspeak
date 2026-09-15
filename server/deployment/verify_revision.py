"""Allowlisted verification of the exact immutable deployment candidate."""
from __future__ import annotations


def inspect_revision(revision: dict, expected_name: str, expected_image: str) -> dict:
    status = revision.get("status", {})
    name = revision.get("metadata", {}).get("name")
    containers = revision.get("spec", {}).get("containers", [])
    image = containers[0].get("image") if len(containers) == 1 else None
    digest = status.get("imageDigest")
    ready = any(c.get("type") == "Ready" and c.get("status") == "True"
                for c in status.get("conditions", []))
    failures = []
    if name != expected_name:
        failures.append("REVISION_NAME_MISMATCH")
    if not ready:
        failures.append("REVISION_NOT_READY")
    if image != expected_image or digest != expected_image:
        failures.append("IMAGE_DIGEST_MISMATCH")
    return {"revision": name, "expected_revision": expected_name, "image": image,
            "resolved_image": digest, "expected_image": expected_image,
            "ready": ready, "failures": failures}


def inspect_traffic(service: dict, expected_name: str) -> dict:
    traffic = [{"revision": row.get("revisionName"), "percent": row.get("percent", 0)}
               for row in service.get("status", {}).get("traffic", [])]
    accepted = (all(type(row["percent"]) is int and 0 <= row["percent"] <= 100 for row in traffic)
                and sum(row["percent"] for row in traffic) == 100
                and sum(row["percent"] for row in traffic if row["revision"] == expected_name) == 100)
    return {"expected_revision": expected_name, "traffic": traffic,
            "failures": [] if accepted else ["TRAFFIC_MISMATCH"]}
