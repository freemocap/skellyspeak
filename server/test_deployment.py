import json
from pathlib import Path
import pytest
from retention import COLLECTIONS
from deploy_candidate import deploy, DeploymentError
from verify_revision import inspect_revision, inspect_traffic

BUILD = "285a606b-6ac1-4bb9-b732-2f514518d4cb"
NAME = "skellyspeak-api-b" + BUILD.replace("-", "")
DIGEST = "sha256:" + "a" * 64
IMAGE = "gcr.io/project/skellyspeak-api@" + DIGEST


def candidate():
    return {"metadata": {"name": NAME}, "spec": {"containers": [{"image": IMAGE, "env": [{"value": "private-secret"}]}]},
            "status": {"imageDigest": IMAGE, "conditions": [{"type": "Ready", "status": "True"}]}}


def test_exact_name_digest_and_readiness_are_required():
    value = candidate()
    assert inspect_revision(value, NAME, IMAGE)["failures"] == []
    value["status"]["conditions"][0]["status"] = "False"
    value["status"]["imageDigest"] = "other"
    report = inspect_revision(value, "wrong", IMAGE)
    assert report["failures"] == ["REVISION_NAME_MISMATCH", "REVISION_NOT_READY", "IMAGE_DIGEST_MISMATCH"]
    assert "private-secret" not in str(report)
    assert inspect_traffic({}, NAME)["failures"] == ["TRAFFIC_MISMATCH"]


@pytest.mark.parametrize("ready", [True, False])
def test_only_verified_candidate_can_receive_traffic(ready):
    calls = []
    def call(args):
        calls.append(args)
        if args[:4] == ["firestore", "fields", "ttls", "list"]:
            return json.dumps([{"name": f"projects/project/databases/(default)/collectionGroups/{group}/fields/ttl", "ttlConfig": {"state": "ACTIVE"}} for group in COLLECTIONS])
        if args[:3] == ["container", "images", "describe"]:
            return DIGEST
        if args[:3] == ["run", "revisions", "describe"]:
            value = candidate()
            value["status"]["conditions"][0]["status"] = "True" if ready else "False"
            return json.dumps(value)
        if args[:3] == ["run", "services", "describe"]:
            return json.dumps({"status": {"traffic": [{"revisionName": NAME, "percent": 100}]}})
        return ""
    arguments = ("project", "us-central1", BUILD, f"gcr.io/project/skellyspeak-api:{BUILD}", [])
    if ready:
        deploy(*arguments, call=call, pause=lambda _: None)
    else:
        with pytest.raises(DeploymentError, match="CANDIDATE_VERIFICATION_FAILED"):
            deploy(*arguments, call=call, pause=lambda _: None)
    assert any("update-traffic" in c for c in calls) == ready
    command = next(c for c in calls if c[:2] == ["run", "deploy"])
    assert "--no-traffic" in command
    assert f"--image={IMAGE}" in command
    assert f"--revision-suffix={NAME.removeprefix('skellyspeak-api-')}" in command


@pytest.mark.parametrize("failure", ["command", "digest"])
def test_failed_command_or_wrong_digest_never_promotes(failure, capsys):
    calls = []
    def call(args):
        calls.append(args)
        if args[:4] == ["firestore", "fields", "ttls", "list"]:
            return json.dumps([{"name": f"projects/project/databases/(default)/collectionGroups/{group}/fields/ttl", "ttlConfig": {"state": "ACTIVE"}} for group in COLLECTIONS])
        if args[:3] == ["container", "images", "describe"]:
            return DIGEST
        if args[:2] == ["run", "deploy"] and failure == "command":
            raise DeploymentError("GCLOUD_COMMAND_FAILED exit=1")
        if args[:3] == ["run", "revisions", "describe"]:
            value = candidate()
            if failure == "digest":
                value["status"]["imageDigest"] = "wrong"
            value["status"]["conditions"][0]["message"] = "private-runtime-secret"
            return json.dumps(value)
        return ""
    with pytest.raises(DeploymentError):
        deploy("project", "us-central1", BUILD, f"gcr.io/project/skellyspeak-api:{BUILD}", [],
               call=call, pause=lambda _: None)
    assert not any("update-traffic" in c for c in calls)
    output = capsys.readouterr().out
    assert "private-" not in output
    if failure == "command":
        assert "failed_candidate" in output


def test_traffic_requires_complete_valid_allocation():
    for rows in [[], [{"revisionName": NAME, "percent": 100}, {"revisionName": "other", "percent": 1}],
                 [{"revisionName": NAME, "percent": "100"}]]:
        assert inspect_traffic({"status": {"traffic": rows}}, NAME)["failures"] == ["TRAFFIC_MISMATCH"]


def test_runtime_python_sources_are_in_docker_context() -> None:
    root: Path = Path(__file__).parent
    included: set[str] = {line[1:] for line in (root / ".dockerignore").read_text().splitlines() if line.startswith("!")}
    for line in (root / "Dockerfile").read_text().splitlines():
        if line.startswith("COPY ") and "--from=" not in line:
            for source in line.split()[1:-1]:
                if source.endswith(".py"):
                    assert source in included
                    assert (root / source).is_file()
