"""Verify only deployment metadata; never print a full service configuration."""
from __future__ import annotations
import json
import sys


def inspect(service: dict, expected_image: str) -> dict:
    status = service.get("status", {})
    created = status.get("latestCreatedRevisionName")
    ready = status.get("latestReadyRevisionName")
    containers = service.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    image = containers[0].get("image") if containers else None
    traffic = [{"revision": t.get("revisionName"), "percent": t.get("percent", 0)}
               for t in status.get("traffic", [])]
    failures = []
    if not created or ready != created:
        failures.append("REVISION_NOT_READY")
    if image != expected_image:
        failures.append("IMAGE_MISMATCH")
    if not created or sum(t["percent"] for t in traffic if t["revision"] == created) != 100:
        failures.append("TRAFFIC_MISMATCH")
    return {"expected_image": expected_image, "actual_image": image,
            "created_revision": created, "ready_revision": ready,
            "traffic": traffic, "failures": failures}


if __name__ == "__main__":
    with open(sys.argv[1]) as source:
        report = inspect(json.load(source), sys.argv[2])
    print(json.dumps(report, sort_keys=True))
    sys.exit(1 if report["failures"] else 0)
