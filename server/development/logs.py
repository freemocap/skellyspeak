"""Private append-only local process logs. Unknown bodies are explicitly redacted."""
from __future__ import annotations

import errno
import io
import json
import logging
import os
from pathlib import Path
import re
import sys
import threading
import time

from server.app.diagnostics import runtime
from server.development.private_files import private_directory, private_file


class LocalLogs:
    def __init__(self, directory: Path):
        if not directory.is_absolute():
            raise RuntimeError("Local log directory must be absolute.")
        private_directory(directory)
        self.directory = directory
        self.lock = threading.RLock()
        from collections import deque
        self.recent = deque(maxlen=10000)
        self.sequence = 0
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
            # Console mirrors also pass through stdout/stderr; report each event once.
            if source == "logging":
                self.sequence += 1
                self.recent.append((self.sequence, time.time(), dict(event)))
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
    if record.name == "skellyspeak.runtime" and isinstance(record.msg, str) and not record.args:
        try:
            data = json.loads(record.msg)
        except (ValueError, TypeError):
            return event
        safe = runtime.sanitize(data) if isinstance(data, dict) else {}
        if safe:
            event.update(safe)
            event["code"] = safe["event"]
    elif record.name == "skellyspeak.requests" and isinstance(record.msg, str) and not record.args:
        try:
            data = json.loads(record.msg)
        except (ValueError, TypeError):
            return event
        if not isinstance(data, dict) or data.get("event") != "request_headers":
            return event
        event["code"] = "request_headers"
        if data.get("diagnostics") is not None:
            from server.app.diagnostics.provider_errors import sanitize
            event["diagnostics"] = sanitize(data["diagnostics"])
        for field in ("status", "duration_ms"):
            value = data.get(field)
            if type(value) is int and 0 <= value <= 2**53:
                event[field] = value
        if isinstance(data.get("route"), str) and data["route"] in ROUTES:
            event["route"] = data["route"]
        if isinstance(data.get("code"), str) and (data["code"] in CODES or re.fullmatch(r"(?:OPENROUTER|GROQ)_HTTP_[45][0-9]{2}", data["code"])):
            event["errorCode"] = data["code"]
        if isinstance(data.get("request_id"), str) and re.fullmatch(r"[0-9a-f]{32}", data["request_id"]):
            event["requestId"] = data["request_id"]
    elif record.name == "skellyspeak.operations" and isinstance(record.msg, str) and not record.args:
        try:
            data = json.loads(record.msg)
        except (ValueError, TypeError):
            return event
        if not isinstance(data, dict) or data.get("event") not in {"operation_failure", "group_finished"}:
            return event
        event["code"] = data["event"]
        if data.get("diagnostics") is not None:
            from server.app.diagnostics.provider_errors import sanitize
            event["diagnostics"] = sanitize(data["diagnostics"])
        if isinstance(data.get("request_id"), str) and re.fullmatch(r"[0-9a-f]{32}", data["request_id"]):
            event["requestId"] = data["request_id"]
        for field in ("item_index", "item_count", "delivered", "failures"):
            value = data.get(field)
            if type(value) is int and 0 <= value <= 8:
                event[field] = value
        if type(data.get("complete")) is bool:
            event["complete"] = data["complete"]
        code = data.get("code")
        if isinstance(code, str) and (code in CODES | {"UNKNOWN_OUTCOME", "OTHER"} or re.fullmatch(r"(?:OPENROUTER|GROQ)_HTTP_[45][0-9]{2}", code)):
            event["errorCode"] = code
        kind = data.get("exception_type")
        if isinstance(kind, str) and kind in {
            "HTTPException", "UpstreamHTTPError", "Rejection", "UsageUnknown", "ValueError",
            "TypeError", "KeyError", "RuntimeError", "TimeoutError", "ReadTimeout",
            "ConnectTimeout", "ConnectError", "ReadError", "RemoteProtocolError", "OtherException",
        }:
            event["exceptionType"] = kind
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
        # Uvicorn logs the OSError object itself when binding fails. Preserve
        # only an allowlisted errno classification, never its text or filename.
        if record.name == "uvicorn.error" and isinstance(record.msg, OSError):
            failures = {
                errno.EADDRINUSE: ("address_in_use", "Server address is already in use. Stop the existing local server before starting another."),
                errno.EACCES: ("permission_denied", "The operating system denied access to the server socket."),
                errno.EPERM: ("permission_denied", "The operating system denied access to the server socket."),
                errno.EADDRNOTAVAIL: ("address_unavailable", "The configured server address is unavailable on this computer."),
            }
            name, message = failures.get(record.msg.errno, ("socket_error", "Server socket operation failed."))
            event.update(eventName=name, message=message)
    return event


class FileHandler(logging.Handler):
    def __init__(self, logs: LocalLogs, terminal=None):
        super().__init__(logging.NOTSET)
        self.logs = logs
        self.terminal = terminal

    def emit(self, record: logging.LogRecord) -> None:
        # Deliberately propagate disk failures; logging.Handler's default fallback
        # would print an arbitrary record/traceback and continue without a disk log.
        event = safe_record(record)
        self.logs.append("logging", event)
        if self.terminal is not None:
            self.terminal.write(f"{time.strftime('%H:%M:%S')} {json.dumps(event, sort_keys=True)}\n")
            self.terminal.flush()


AUTHORED_MESSAGES = {
    "Local API: http://127.0.0.1:8765/v1": "local_api_ready",
    "Session token: server/.local-server/session-token.txt (reused across restarts)": "session_token_file_ready",
    "Provider calls use real keys. Data is process-local and is cleared when the server stops.": "local_spending_policy",
    "server/.env is valid. Provider credentials have not been verified.": "local_configuration_valid",
    "Create server/.env from server/development/.env.sample and add the provider keys.": "provider_key_file_missing",
    "OPENROUTER_API_KEY and GROQ_API_KEY must be set in server/.env.": "provider_key_missing",
    "Invalid ELEVENLABS_API_KEY format.": "elevenlabs_key_invalid",
    "Set ELEVENLABS_VOICE_ID to a voice ID in server/.env.": "elevenlabs_voice_id_invalid",
    "Local token directory cannot be a symlink.": "token_directory_symlink",
    "Local session credentials are invalid. Run with --reset-session-token to replace them.": "local_session_invalid",
    "Local session files cannot be symlinks.": "local_session_symlink",
    "Local session directory cannot use symlinks.": "local_session_directory_symlink",
    "Local server setup failed.": "local_setup_failed",
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
            # Both terminal and disk receive safe metadata for unknown output.
            self.original.write((authored + "\n") if authored in AUTHORED_MESSAGES else (json.dumps(event) + "\n") if text.strip() else "")
            self.original.flush()
        return len(text)

    def flush(self):
        self.original.flush()


def install(directory: Path) -> LocalLogs:
    logs = LocalLogs(directory)
    handler = FileHandler(logs, sys.stderr)
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
    handler.terminal.write(f"Server logs: {directory}\n")
    handler.terminal.flush()
    return logs
