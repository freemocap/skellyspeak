"""Durable local logs preserve safe diagnostics, privacy and explicit failures."""
import io
import json
import logging
from pathlib import Path
import stat

import pytest

from local_logging import FileHandler, LocalLogs, Stream, safe_record


def record(name, message, args=()):
    return logging.LogRecord(name, logging.ERROR, __file__, 12, message, args, None)


def test_append_preserves_all_records_and_existing_runs(tmp_path: Path):
    directory = tmp_path.resolve() / "private" / "logs" / "run"
    logs = LocalLogs(directory)
    for index in range(600):
        logs.append("logging", {"code": "test_event", "sequence": index})
    path = directory / "server-logging.jsonl"
    contents = path.read_text()
    events = [json.loads(line) for line in contents.splitlines()]
    assert [r["event"]["sequence"] for r in events] == list(range(600))
    assert all(r["pid"] > 0 and r["recordedAtMs"] > 0 and r["run"] == "run" for r in events)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert all(stat.S_IMODE(p.stat().st_mode) == 0o700 for p in (directory, directory.parent, directory.parent.parent))
    with pytest.raises(FileExistsError):
        LocalLogs(directory)
    assert path.read_text() == contents
    logs.close()


def test_structured_request_keeps_actionable_metadata_without_bodies(tmp_path: Path):
    payload = {"event": "request_headers", "route": "/v1/operations", "status": 502,
               "duration_ms": 123, "code": "UPSTREAM_FAILURE", "request_id": "a" * 32,
               "transcript": "private transcript", "apiKey": "private key",
               "exception_type": "private exception", "revision": "private revision"}
    safe = safe_record(record("skellyspeak.requests", json.dumps(payload)))
    assert safe["status"] == 502 and safe["route"] == "/v1/operations"
    assert safe["requestId"] == "a" * 32 and safe["errorCode"] == "UPSTREAM_FAILURE"
    assert "private" not in json.dumps(safe)
    logs = LocalLogs(tmp_path.resolve() / "run")
    handler = FileHandler(logs)
    handler.emit(record("third-party", "private transcript %s", ("secret",)))
    terminal = io.StringIO()
    stream = Stream(logs, "stderr", terminal)
    stream.write("Bearer private-secret\nprivate transcript")
    assert terminal.getvalue().startswith("Bearer")
    stream.write("Local API: http://127.0.0.1:8765/v1")
    for file in logs.directory.glob("*.jsonl"):
        assert "private-secret" not in file.read_text()
        assert "private transcript" not in file.read_text()
    entries = [json.loads(line)["event"] for line in (logs.directory / "server-stderr.jsonl").read_text().splitlines()]
    assert entries[0]["contentRedacted"]
    assert entries[1]["code"] == "local_api_ready" and entries[1]["message"].startswith("Local API:")
    logs.close()


def test_symlink_and_write_failures_are_explicit(tmp_path: Path):
    directory = tmp_path.resolve()
    link = directory / "linked"
    link.symlink_to(directory, target_is_directory=True)
    with pytest.raises(RuntimeError, match="symlink"):
        LocalLogs(link / "run")
    logs = LocalLogs(directory / "run")
    logs.files["logging"].close()
    with pytest.raises(ValueError):
        FileHandler(logs).emit(record("third-party", "private"))
    logs.close()


def test_actual_refusal_and_grouped_failure_reasons_survive_redaction():
    for code in ("SHARED_AUTH_DAILY_LIMIT", "SHARED_ACCOUNT_DAILY_LIMIT",
                 "PERSONAL_ACCOUNT_DAILY_LIMIT", "SHARED_DIAGNOSTICS_DAILY_LIMIT",
                 "PERSONAL_DIAGNOSTICS_DAILY_LIMIT"):
        safe = safe_record(record("skellyspeak.requests", json.dumps({
            "event": "request_headers", "status": 429, "code": code})))
        assert safe["errorCode"] == code
    safe = safe_record(record("skellyspeak.operations", json.dumps({
        "event": "operation_failure", "status": 502, "upstream_status": 401,
        "category": "http", "body": "private provider body", "apiKey": "private secret"})))
    assert safe["code"] == "operation_failure"
    assert safe["status"] == 502 and safe["upstream_status"] == 401 and safe["category"] == "http"
    assert "private" not in json.dumps(safe)
    invalid = safe_record(record("skellyspeak.operations", json.dumps({
        "event": "operation_failure", "status": True, "upstream_status": 999,
        "category": "private provider text"})))
    assert "status" not in invalid and "upstream_status" not in invalid and "category" not in invalid
