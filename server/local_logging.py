"""Private append-only local process logs. Unknown bodies are explicitly redacted."""
from __future__ import annotations

import io
import json
import logging
import os
from pathlib import Path
import re
import sys
import threading
import time


def private_file(path: Path):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    return os.fdopen(descriptor, "a", encoding="utf-8")


class LocalLogs:
    def __init__(self, directory: Path):
        if not directory.is_absolute():
            raise RuntimeError("Local log directory must be absolute.")
        if any(p.is_symlink() for p in (directory, *directory.parents)):
            raise RuntimeError("Local log directory cannot use symlinks.")
        missing = []
        current = directory
        while not current.exists():
            missing.append(current)
            current = current.parent
        for parent in reversed(missing):
            parent.mkdir(mode=0o700)
        if not directory.is_dir():
            raise RuntimeError("Local log destination must be a directory.")
        directory.chmod(0o700)
        self.directory = directory
        self.lock = threading.RLock()
        self.files = {name: private_file(directory / f"server-{name}.jsonl")
                      for name in ("stdout", "stderr", "logging")}
        with private_file(directory / f"server-{os.getpid()}.manifest.json") as file:
            json.dump({"version": 1, "pid": os.getpid(), "startedAtMs": time.time_ns() // 1_000_000,
                       "source": "local_server", "streams": [f"server-{s}.jsonl" for s in self.files],
                       "retention": "no_automatic_deletion", "content": "safe_metadata_unknown_bodies_redacted"}, file)
            file.write("\n")
            file.flush()

    def append(self, source: str, event: dict) -> None:
        with self.lock:
            json.dump({"recordedAtMs": time.time_ns() // 1_000_000, "run": self.directory.name,
                       "pid": os.getpid(), "source": f"server.{source}", "event": event}, self.files[source])
            self.files[source].write("\n")
            self.files[source].flush()

    def close(self) -> None:
        for file in self.files.values():
            file.close()


# Preserve the existing authored request diagnostic without copying any unknown
# fields (provider payloads, URLs, headers, exception text and transcripts).
ROUTES = {"/v1/me", "/v1/diagnostics", "/v1/chat/completions", "/v1/audio/transcriptions",
          "/v1/operations", "/v1/protocol", "/health", "unmatched"}
CODES = {"INVALID_REQUEST", "AUTHENTICATION_REQUIRED", "ACCESS_DENIED", "NOT_FOUND",
         "RATE_LIMITED", "UPSTREAM_FAILURE", "REQUEST_REJECTED", "INTERNAL_ERROR",
         "SPENDING_PAUSED", "PERSONAL_ALLOWANCE_EXHAUSTED", "SHARED_ALLOWANCE_EXHAUSTED",
         "ACCOUNT_INFLIGHT_LIMIT", "INGRESS_RATE_LIMIT", "SHARED_AUTH_DAILY_LIMIT",
         "SHARED_ACCOUNT_DAILY_LIMIT", "PERSONAL_ACCOUNT_DAILY_LIMIT",
         "SHARED_DIAGNOSTICS_DAILY_LIMIT", "PERSONAL_DIAGNOSTICS_DAILY_LIMIT"}


def safe_record(record: logging.LogRecord) -> dict:
    event = {"level": {10: "DEBUG", 20: "INFO", 30: "WARNING", 40: "ERROR", 50: "CRITICAL"}.get(record.levelno, "OTHER"), "code": "python_log",
             "contentRedacted": True, "line": record.lineno}
    if record.name == "skellyspeak.requests" and isinstance(record.msg, str) and not record.args:
        try:
            data = json.loads(record.msg)
        except (ValueError, TypeError):
            return event
        if not isinstance(data, dict) or data.get("event") != "request_headers":
            return event
        event["code"] = "request_headers"
        for field in ("status", "duration_ms"):
            value = data.get(field)
            if type(value) is int and 0 <= value <= 2**53:
                event[field] = value
        if isinstance(data.get("route"), str) and data["route"] in ROUTES:
            event["route"] = data["route"]
        if isinstance(data.get("code"), str) and data["code"] in CODES:
            event["errorCode"] = data["code"]
        if isinstance(data.get("request_id"), str) and re.fullmatch(r"[0-9a-f]{32}", data["request_id"]):
            event["requestId"] = data["request_id"]
    elif record.name == "skellyspeak.operations" and isinstance(record.msg, str) and not record.args:
        try:
            data = json.loads(record.msg)
        except (ValueError, TypeError):
            return event
        if not isinstance(data, dict) or data.get("event") != "operation_failure":
            return event
        event["code"] = "operation_failure"
        for field in ("status", "upstream_status"):
            value = data.get(field)
            if type(value) is int and 100 <= value <= 599:
                event[field] = value
        if isinstance(data.get("category"), str) and data["category"] in {"http", "internal"}:
            event["category"] = data["category"]
    elif record.name == "skellyspeak-api" and record.msg == "Chat stream failed for reservation %s (%s)":
        event["code"] = "chat_stream_failed"
    elif record.name.startswith("uvicorn"):
        event["code"] = "uvicorn_log"
        # Keep authored template identity, never interpolate request arguments.
        templates = {
            "Started server process [%d]": "server_started",
            "Waiting for application startup.": "startup_waiting",
            "Application startup complete.": "startup_complete",
            "Shutting down": "shutdown_started",
            "Waiting for application shutdown.": "shutdown_waiting",
            "Application shutdown complete.": "shutdown_complete",
            "Finished server process [%d]": "server_finished",
            "Exception in ASGI application\n": "asgi_exception",
        }
        event["eventName"] = templates.get(record.msg, "other") if isinstance(record.msg, str) else "other"
    return event


class FileHandler(logging.Handler):
    def __init__(self, logs: LocalLogs):
        super().__init__(logging.NOTSET)
        self.logs = logs

    def emit(self, record: logging.LogRecord) -> None:
        # Deliberately propagate disk failures; logging.Handler's default fallback
        # would print an arbitrary record/traceback and continue without a disk log.
        self.logs.append("logging", safe_record(record))


AUTHORED_MESSAGES = {
    "Local API: http://127.0.0.1:8765/v1": "local_api_ready",
    "Session token: server/.local-server/session-token.txt (refreshed on each launch)": "session_token_file_ready",
    "Provider calls use real keys. Local daily spending reservation limit: $0.50. No cloud storage is used.": "local_spending_policy",
    "Local keys have valid shape; loopback emulator is reachable. Provider credentials have not been verified.": "local_configuration_valid",
    "Create server/local.env with the two provider API keys.": "provider_key_file_missing",
    "server/local.env must be owner-only: chmod 600 server/local.env": "provider_key_file_permissions",
    "local.env must contain each supported provider key exactly once.": "provider_key_file_shape",
    "A provider key is missing or malformed in local.env.": "provider_key_malformed",
    "Both OPENROUTER_API_KEY and GROQ_API_KEY are required in local.env.": "provider_key_missing",
    "Local token directory cannot be a symlink.": "token_directory_symlink",
    "Local server setup failed. Check local.env permissions and the loopback emulator.": "local_setup_failed",
}


class Stream(io.TextIOBase):
    def __init__(self, logs: LocalLogs, source: str, original):
        self.logs, self.source, self.original = logs, source, original

    def writable(self):
        return True

    def write(self, text: str) -> int:
        if not isinstance(text, str):
            raise TypeError("Log stream expects text.")
        if text:
            authored = text.rstrip("\n")
            event = {"code": "stream_write", "contentRedacted": True, "characters": len(text)}
            if authored in AUTHORED_MESSAGES:
                event.update(code=AUTHORED_MESSAGES[authored], message=authored, contentRedacted=False)
            self.logs.append(self.source, event)
            # Keep terminal visibility, but never mirror arbitrary bodies to disk.
            self.original.write(text)
            self.original.flush()
        return len(text)

    def flush(self):
        self.original.flush()


def install(directory: Path) -> LocalLogs:
    logs = LocalLogs(directory)
    handler = FileHandler(logs)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True
    sys.stdout = Stream(logs, "stdout", sys.stdout)
    sys.stderr = Stream(logs, "stderr", sys.stderr)
    logs.append("logging", {"code": "logging_initialized"})
    return logs
