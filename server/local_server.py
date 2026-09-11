"""Run the normal API on loopback with emulator storage and local provider keys."""
from __future__ import annotations

import argparse
import importlib
import os
from pathlib import Path
import secrets
import socket
import stat
import time

import local_logging

ROOT = Path(__file__).resolve().parent
KEYS = {"OPENROUTER_API_KEY", "GROQ_API_KEY"}


def read_keys(path: Path) -> dict[str, str]:
    if not path.is_file() or path.is_symlink():
        raise RuntimeError("Create server/local.env with the two provider API keys.")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RuntimeError("server/local.env must be owner-only: chmod 600 server/local.env")
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if not separator or key not in KEYS or key in values:
            raise RuntimeError("local.env must contain each supported provider key exactly once.")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if len(value) < 16 or not value.isascii() or any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in value):
            raise RuntimeError("A provider key is missing or malformed in local.env.")
        values[key] = value
    if set(values) != KEYS:
        raise RuntimeError("Both OPENROUTER_API_KEY and GROQ_API_KEY are required in local.env.")
    return values


def configure(keys: dict[str, str], signing_key: str) -> None:
    # Explicitly scope storage and destinations, regardless of the calling shell.
    os.environ.update(keys | {
        "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8787",
        "GOOGLE_CLOUD_PROJECT": "skellyspeak-local-test",
        "GOOGLE_CLIENT_ID": "local-sign-in-disabled",
        "GOOGLE_CLIENT_SECRET": "local-sign-in-disabled",
        "JWT_SIGNING_KEY": signing_key,
        "PUBLIC_BASE_URL": "http://127.0.0.1:8765",
        "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1",
        "GROQ_BASE_URL": "https://api.groq.com/openai/v1",
        "ALLOWED_MODELS": "google/gemini-2.5-flash,openai/gpt-audio-mini",
        "MAX_COMPLETION_TOKENS": "2048",
        "FREE_DAILY_MICROS": "500000", "GLOBAL_DAILY_MICROS": "500000",
        "MAX_USERS": "1",
    })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate local configuration without starting the server or making provider calls")
    args = parser.parse_args()
    configured_logs = os.environ.get("SKELLYSPEAK_LOG_RUN_DIR")
    directory = Path(configured_logs) if configured_logs else ROOT.parent / ".local" / "logs" / f"server-{time.time_ns()}-{os.getpid()}"
    logs = local_logging.install(directory)
    logs.append("logging", {"code": "configuration_check" if args.check else "server_starting"})
    keys = read_keys(ROOT / "local.env")
    signing_key = secrets.token_urlsafe(48)
    configure(keys, signing_key)
    with socket.create_connection(("127.0.0.1", 8787), timeout=2):
        pass
    if args.check:
        print("Local keys have valid shape; loopback emulator is reachable. Provider credentials have not been verified.")
        return
    # Import only after emulator configuration, so no cloud client can initialize
    # against an inherited production project.
    auth = importlib.import_module("auth")
    api = importlib.import_module("main")
    quota = importlib.import_module("quota")
    uvicorn = importlib.import_module("uvicorn")

    version = quota.upsert_user(api.db, user_id="local-learner", email="local@example.invalid",
                      name="Local test", max_users=1)
    token = auth.issue_session_token(user_id="local-learner", signing_key=signing_key, token_version=version)
    private = ROOT / ".local-server"
    if private.is_symlink():
        raise RuntimeError("Local token directory cannot be a symlink.")
    private.mkdir(mode=0o700, exist_ok=True)
    private.chmod(0o700)
    target = private / "session-token.txt"
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as file:
        os.fchmod(file.fileno(), 0o600)
        file.write(token + "\n")
    print("Local API: http://127.0.0.1:8765/v1")
    print("Session token: server/.local-server/session-token.txt (refreshed on each launch)")
    print("Provider calls use real keys. Local daily spending reservation limit: $0.50. No cloud storage is used.")
    uvicorn.run(api.app, host="127.0.0.1", port=8765, access_log=False, log_level="info", log_config=None)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError) as error:
        # OS error details can include environment paths. Only authored failures
        # are shown; credentials and file contents are never printed.
        if isinstance(error, RuntimeError):
            raise SystemExit(str(error)) from None
        raise SystemExit("Local server setup failed. Check local.env permissions and the loopback emulator.") from None
