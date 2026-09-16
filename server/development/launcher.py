"""Run the API on loopback with disposable local storage and keys from .env."""
from __future__ import annotations

import argparse
import importlib
import os
from pathlib import Path
import secrets
import time

from dotenv import load_dotenv

import server.development.logs as local_logging
import server.development.memory_store as memory_store

ROOT = Path(__file__).resolve().parents[1]
KEYS = ("OPENROUTER_API_KEY", "GROQ_API_KEY")


def load_keys(path: Path) -> dict[str, str]:
    if not path.is_file() or path.is_symlink():
        raise RuntimeError("Create server/.env from server/development/.env.sample and add the provider keys.")
    load_dotenv(path, override=False)
    values = {key: os.environ.get(key, "").strip() for key in KEYS}
    if any(len(value) < 16 or not value.isascii() or any(c.isspace() or ord(c) < 33 or ord(c) == 127 for c in value)
           for value in values.values()):
        raise RuntimeError("OPENROUTER_API_KEY and GROQ_API_KEY must be set in server/.env.")
    return values


def configure(keys: dict[str, str], signing_key: str) -> None:
    # Explicitly scope storage and destinations, regardless of the calling shell.
    os.environ.update(keys | {
        "GOOGLE_CLOUD_PROJECT": "skellyspeak-local-test",
        "GOOGLE_CLIENT_ID": "local-sign-in-disabled",
        "GOOGLE_CLIENT_SECRET": "local-sign-in-disabled",
        "JWT_SIGNING_KEY": signing_key,
        "PUBLIC_BASE_URL": "http://127.0.0.1:8765",
        "OPENROUTER_BASE_URL": "https://openrouter.ai/api/v1",
        "GROQ_BASE_URL": "https://api.groq.com/openai/v1",
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
    keys = load_keys(ROOT / ".env")
    signing_key = secrets.token_urlsafe(48)
    configure(keys, signing_key)
    if args.check:
        print("server/.env is valid. Provider credentials have not been verified.")
        return
    # Install disposable local storage before importing modules that declare
    # Firestore transactions. The hosted application continues to use Firestore.
    database = memory_store.install()
    auth = importlib.import_module("server.app.identity.auth")
    api = importlib.import_module("server.app.main")
    quota = importlib.import_module("server.app.accounting.quota")
    uvicorn = importlib.import_module("uvicorn")
    api.db = database

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
    print("Provider calls use real keys. Data is process-local and is cleared when the server stops.")
    uvicorn.run(api.app, host="127.0.0.1", port=8765, access_log=False, log_level="info", log_config=None)


def run() -> None:
    try:
        main()
    except (RuntimeError, OSError) as error:
        if isinstance(error, RuntimeError):
            raise SystemExit(str(error)) from None
        raise SystemExit("Local server setup failed.") from None


if __name__ == "__main__":
    run()
