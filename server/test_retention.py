import json
import pytest
from retention import COLLECTIONS, RetentionError, ensure_retention


def test_missing_policies_are_enabled_and_verified_without_document_access():
    calls = []
    reads = 0
    def call(args):
        nonlocal reads
        calls.append(args)
        if args[3] == "list":
            reads += 1
            return json.dumps([] if reads == 1 else [
                {"name": f"projects/p/databases/(default)/collectionGroups/{group}/fields/ttl",
                 "ttlConfig": {"state": "ACTIVE"}} for group in COLLECTIONS])
        return ""
    ensure_retention("p", call=call, pause=lambda _: None)
    updates = [c for c in calls if c[3] == "update"]
    assert len(updates) == len(COLLECTIONS)
    assert all("--enable-ttl" in c and "--async" in c for c in updates)
    assert all(c[:3] == ["firestore", "fields", "ttls"] for c in calls)


def test_pending_retention_fails_deployment():
    with pytest.raises(RetentionError, match="TTL_ACTIVATION_PENDING"):
        ensure_retention("p", call=lambda args: "[]", pause=lambda _: None)


def test_cloud_upload_is_an_explicit_allowlist():
    from pathlib import Path
    lines = (Path(__file__).parent.parent / ".gcloudignore").read_text().splitlines()
    assert lines[0] == "*"
    assert not any("*" in line for line in lines[1:])
    assert "!server/retention.py" in lines
    assert "!server/work_admission.py" in lines
    assert not any("local" in line or "test_" in line for line in lines)


def test_retention_failure_prevents_any_revision_change():
    from deploy_candidate import deploy, DeploymentError
    calls = []
    def call(args):
        calls.append(args)
        raise DeploymentError("GCLOUD_COMMAND_FAILED exit=1")
    build = "285a606b-6ac1-4bb9-b732-2f514518d4cb"
    with pytest.raises(DeploymentError):
        deploy("p", "us-central1", build, f"gcr.io/p/skellyspeak-api:{build}", [], call=call)
    assert len(calls) == 1
    assert calls[0][:4] == ["firestore", "fields", "ttls", "list"]


def test_nonzero_retention_offset_is_not_silently_accepted():
    row = {"name": "projects/p/databases/(default)/collectionGroups/work_attempts/fields/ttl",
           "ttlConfig": {"state": "ACTIVE", "expirationOffset": "86400s"}}
    with pytest.raises(RetentionError, match="TTL_UNEXPECTED_EXPIRATION_OFFSET"):
        ensure_retention("p", call=lambda _: json.dumps([row]))
