"""Run the API on loopback with disposable local storage and keys from .env."""
from __future__ import annotations

import argparse
import importlib
import os
from pathlib import Path
import time

from dotenv import load_dotenv

import server.development.logs as local_logging
import server.development.memory_store as memory_store
import server.development.session as local_session

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
    extra = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if extra:
        if len(extra) < 16 or not extra.isascii() or any(ord(c) < 33 or ord(c) == 127 for c in extra):
            raise RuntimeError("Invalid ELEVENLABS_API_KEY format.")
        values["ELEVENLABS_API_KEY"] = extra
        voice = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
        if not voice or not voice.isascii() or not voice.isalnum():
            raise RuntimeError("Set ELEVENLABS_VOICE_ID to a voice ID in server/.env.")
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
        "MAX_COMPLETION_TOKENS": "32768",
        "FREE_DAILY_MICROS": "500000", "GLOBAL_DAILY_MICROS": "500000",
        "MAX_USERS": "1",
    })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate local configuration without starting the server or making provider calls")
    parser.add_argument("--reset-session-token", action="store_true", help="Replace local credentials and invalidate the previously saved app token")
    parser.add_argument("--enforce-usage-limits", action="store_true", help="Enable daily spending and request limits for local quota testing")
    args = parser.parse_args()
    if args.check and args.reset_session_token:
        parser.error("--check cannot be combined with --reset-session-token")
    configured_logs = os.environ.get("SKELLYSPEAK_LOG_RUN_DIR")
    directory = Path(configured_logs) if configured_logs else ROOT.parent / ".local" / "logs" / f"server-{time.time_ns()}-{os.getpid()}"
    logs = local_logging.install(directory)
    logs.append("logging", {"code": "configuration_check" if args.check else "server_starting"})
    keys = load_keys(ROOT / ".env")
    if args.check:
        print("server/.env is valid. Provider credentials have not been verified.")
        return
    signing_key, token = local_session.load(ROOT / ".local-server", reset=args.reset_session_token)
    configure(keys, signing_key)
    # Install disposable local storage before importing modules that declare
    # Firestore transactions. The hosted application continues to use Firestore.
    database = memory_store.install(enforce_usage_limits=args.enforce_usage_limits)
    api = importlib.import_module("server.app.main")
    quota = importlib.import_module("server.app.accounting.quota")
    uvicorn = importlib.import_module("uvicorn")
    api.db = database
    from server.development.admin import LocalAdmin
    LocalAdmin(ROOT / ".local-server", logs).install(api.app)

    quota.upsert_user(api.db, user_id="local-learner", email="local@example.invalid",
                      name="Local test", max_users=1)
    print("Daily usage limits: " + ("enabled" if args.enforce_usage_limits else "disabled (usage is still recorded)"))
    print("Local API: http://127.0.0.1:8765/v1")
    print("Session token: server/.local-server/session-token.txt (reused across restarts)")
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
