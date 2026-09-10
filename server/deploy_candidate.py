"""Deploy, verify and promote an exact revision. No raw service configuration logs."""
from __future__ import annotations
import json
import re
import subprocess
import sys
import time
import uuid
from retention import ensure_retention, RetentionError
from verify_revision import inspect_revision, inspect_traffic


class DeploymentError(RuntimeError):
    pass


def gcloud(arguments: list[str]) -> str:
    try:
        result = subprocess.run(["gcloud", *arguments], capture_output=True, text=True,
                                timeout=600, check=False)
    except (subprocess.TimeoutExpired, OSError) as error:
        raise DeploymentError("GCLOUD_EXECUTION_FAILED") from error
    if result.returncode:
        # Do not echo stderr or a full service spec into public Actions logs.
        raise DeploymentError(f"GCLOUD_COMMAND_FAILED exit={result.returncode}")
    return result.stdout


def deploy(project: str, region: str, build: str, image: str, flags: list[str], *, call=gcloud, pause=time.sleep):
    suffix = "b" + uuid.UUID(build).hex
    name = "skellyspeak-api-" + suffix
    if image != f"gcr.io/{project}/skellyspeak-api:{build}":
        raise DeploymentError("UNEXPECTED_IMAGE_TAG")
    ensure_retention(project, call=call, pause=pause)
    scope = [f"--project={project}", f"--region={region}", "--quiet"]
    print(json.dumps({"stage": "resolve_image", "revision": name}), flush=True)
    digest = call(["container", "images", "describe", image, f"--project={project}",
                   "--format=value(image_summary.digest)"]).strip()
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise DeploymentError("INVALID_IMAGE_DIGEST")
    immutable = image.rsplit(":", 1)[0] + "@" + digest
    print(json.dumps({"stage": "deploy_candidate", "revision": name, "image": immutable}), flush=True)
    try:
        call(["run", "deploy", "skellyspeak-api", *scope, f"--image={immutable}",
              f"--revision-suffix={suffix}", "--no-traffic", *flags])
    except DeploymentError:
        # Startup failures can leave a revision to inspect. Report only the same
        # allowlisted fields; never promote after a failed deploy command.
        try:
            value = json.loads(call(["run", "revisions", "describe", name, *scope, "--format=json"]))
            print(json.dumps({"stage": "failed_candidate", **inspect_revision(value, name, immutable)}), flush=True)
        except (DeploymentError, ValueError):
            print(json.dumps({"stage": "failed_candidate", "revision": name,
                              "failures": ["REVISION_METADATA_UNAVAILABLE"]}), flush=True)
        raise
    for attempt in range(12):
        value = json.loads(call(["run", "revisions", "describe", name, *scope, "--format=json"]))
        report = inspect_revision(value, name, immutable)
        print(json.dumps({"stage": "verify_candidate", **report}), flush=True)
        if not report["failures"]:
            break
        if attempt == 11:
            raise DeploymentError("CANDIDATE_VERIFICATION_FAILED")
        pause(5)
    print(json.dumps({"stage": "promote_candidate", "revision": name}), flush=True)
    call(["run", "services", "update-traffic", "skellyspeak-api", *scope, f"--to-revisions={name}=100"])
    service = json.loads(call(["run", "services", "describe", "skellyspeak-api", *scope, "--format=json"]))
    report = inspect_traffic(service, name)
    print(json.dumps({"stage": "verify_traffic", **report}), flush=True)
    if report["failures"]:
        raise DeploymentError("TRAFFIC_VERIFICATION_FAILED")


if __name__ == "__main__":
    try:
        deploy(*sys.argv[1:5], sys.argv[5:])
    except (DeploymentError, RetentionError, ValueError) as error:
        print(str(error) if isinstance(error, (DeploymentError, RetentionError)) else "INVALID_DEPLOYMENT_METADATA", file=sys.stderr)
        sys.exit(1)
