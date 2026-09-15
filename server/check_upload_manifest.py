"""Verify the Cloud Build upload boundary with gcloud and harmless sentinel files.

Run from any directory: python server/check_upload_manifest.py.
No credentials, provider calls, build submissions or real private files are used.
"""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def required_files(root: Path) -> set[str]:
    required = {"server/Dockerfile", "server/.dockerignore", "server/cloudbuild.yaml",
                "server/deploy_candidate.py", "server/verify_revision.py", "server/retention.py"}
    for line in (root / "server/Dockerfile").read_text().splitlines():
        if line.startswith("COPY ") and "--from=" not in line:
            required.update("server/" + name for name in line.split()[1:-1])
    return required


def verify(root: Path, *, executable: str | None = None) -> None:
    executable = executable or shutil.which("gcloud")
    if executable is None:
        raise RuntimeError("gcloud is required to verify the Cloud Build upload manifest.")
    required = required_files(root)
    if any(not (root / path).is_file() for path in required):
        raise RuntimeError("A required Cloud Build source is missing.")
    forbidden = {"server/local.env", "server/.env", "server/.local-server/session-token.txt",
                 "server/.venv/sentinel.txt", "server/__pycache__/sentinel.pyc",
                 "server/test_sentinel.py", "server/nested/private.txt", "outside.txt"}
    with tempfile.TemporaryDirectory(prefix="skellyspeak-upload-check-") as temporary:
        directory = Path(temporary)
        fixture = directory / "source"
        fixture.mkdir()
        (fixture / ".gcloudignore").write_text((root / ".gcloudignore").read_text())
        for path in required | forbidden:
            destination = fixture / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("Upload audit sentinel; contains no secrets.\n")
        environment = {**os.environ, "CLOUDSDK_CONFIG": str(directory / "gcloud-config"),
                       "CLOUDSDK_CORE_DISABLE_USAGE_REPORTING": "true"}
        result = subprocess.run([executable, "meta", "list-files-for-upload", str(fixture)],
                                capture_output=True, text=True, timeout=60, env=environment)
        if result.returncode:
            raise RuntimeError("gcloud upload manifest inspection failed; no upload was attempted.")
        included = set(result.stdout.splitlines())
        if included != required:
            # Only synthetic paths exist here; never inspect or echo private files.
            raise RuntimeError(f"Upload filter mismatch: {len(included - required)} unexpected, "
                               f"{len(required - included)} missing files.")


if __name__ == "__main__":
    verify(Path(__file__).resolve().parent.parent)
    print("Cloud upload manifest verified: runtime/build files included; private sentinels excluded.")
