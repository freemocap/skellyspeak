"""Durable local logs preserve safe diagnostics, privacy and explicit failures."""
import errno
import io
import json
import logging
from pathlib import Path
import stat

import pytest

from server.development.logs import FileHandler, LocalLogs, Stream, safe_record


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
    assert "private" not in terminal.getvalue()
    assert "contentRedacted" in terminal.getvalue()
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


@pytest.mark.parametrize(("setting", "value", "code", "message"), [
    ("ELEVENLABS_API_KEY", "private short", "elevenlabs_key_invalid",
     "Invalid ELEVENLABS_API_KEY format."),
    ("ELEVENLABS_VOICE_ID", "private invalid voice", "elevenlabs_voice_id_invalid",
     "Set ELEVENLABS_VOICE_ID to a voice ID in server/.env."),
])
def test_launcher_configuration_errors_reach_terminal_and_disk(tmp_path, setting, value, code, message):
    import os
    import subprocess
    import sys

    # Exercise SystemExit through the installed stream, using synthetic settings.
    env_file = tmp_path / ".env"
    env_file.write_text("")
    directory = tmp_path.resolve() / "run"
    environment = os.environ | {
        "OPENROUTER_API_KEY": "private-test-openrouter-key",
        "GROQ_API_KEY": "private-test-groq-key",
        "ELEVENLABS_API_KEY": "private-test-elevenlabs-key",
        "ELEVENLABS_VOICE_ID": "testVoiceId",
        "SKELLYSPEAK_LOG_RUN_DIR": str(directory),
        setting: value,
    }
    script = '''
import sys
from pathlib import Path
from server.development import launcher
launcher.ROOT = Path(sys.argv[1])
sys.argv = ['launcher', '--check']
launcher.run()
'''
    result = subprocess.run([sys.executable, "-c", script, str(tmp_path)],
                            cwd=Path(__file__).resolve().parents[3], env=environment,
                            capture_output=True, text=True, timeout=10)
    assert result.returncode == 1
    assert message in result.stderr
    entries = [json.loads(line)["event"] for line in
               (directory / "server-stderr.jsonl").read_text().splitlines()]
    assert any(event.get("code") == code and event.get("message") == message
               and event.get("contentRedacted") is False for event in entries)
    assert "private-test" not in result.stdout + result.stderr
    assert value not in result.stdout + result.stderr
    for path in directory.glob("*.jsonl"):
        assert "private-test" not in path.read_text()
        assert value not in path.read_text()


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


def test_provider_status_code_is_preserved_without_remote_content():
    import json
    import logging
    from server.development.logs import safe_record
    record = logging.LogRecord('skellyspeak.requests', logging.INFO, '', 1, json.dumps({
        'event': 'request_headers', 'code': 'OPENROUTER_HTTP_404', 'status': 502,
        'detail': 'PRIVATE_ERROR'}), (), None)
    result = safe_record(record)
    assert result['errorCode'] == 'OPENROUTER_HTTP_404'
    assert 'PRIVATE_ERROR' not in str(result)


def test_operation_correlation_survives_private_log_filter():
    payload = {'event': 'operation_failure', 'request_id': 'b' * 32, 'item_index': 2,
               'code': 'GROQ_HTTP_422', 'exception_type': 'UpstreamHTTPError',
               'status': 502, 'detail': 'PRIVATE_PROVIDER_BODY'}
    safe = safe_record(record('skellyspeak.operations', json.dumps(payload)))
    assert safe['requestId'] == 'b' * 32 and safe['item_index'] == 2
    assert safe['errorCode'] == 'GROQ_HTTP_422' and safe['exceptionType'] == 'UpstreamHTTPError'
    assert 'PRIVATE_' not in json.dumps(safe)
    payload.update(request_id='PRIVATE_ID', item_index=999, exception_type='PRIVATE_CLASS')
    invalid = safe_record(record('skellyspeak.operations', json.dumps(payload)))
    assert 'requestId' not in invalid and 'item_index' not in invalid and 'exceptionType' not in invalid
    summary = safe_record(record('skellyspeak.operations', json.dumps({
        'event': 'group_finished', 'request_id': 'b' * 32, 'item_count': 2,
        'delivered': 1, 'failures': 1, 'complete': False})))
    assert summary['code'] == 'group_finished' and summary['complete'] is False
    assert summary['delivered'] == 1 and summary['requestId'] == 'b' * 32


def test_terminal_and_disk_share_safe_runtime_events(tmp_path):
    logs = LocalLogs(tmp_path.resolve() / "run")
    terminal = io.StringIO()
    handler = FileHandler(logs, terminal)
    handler.emit(record("skellyspeak.runtime", json.dumps({
        "event": "provider_finished", "provider": "OPENROUTER", "duration_ms": 123,
        "request_id": "a" * 32, "body": "private body", "model": "private-model",
        "tokens": True, "route": "/private-path", "user_id": "private identity"})))
    handler.emit(record("httpx", "POST private-url Authorization private-key"))
    rows = [json.loads(line)["event"] for line in (logs.directory / "server-logging.jsonl").read_text().splitlines()]
    assert rows[0]["duration_ms"] == 123
    assert rows[0]["request_id"] == "a" * 32
    assert "tokens" not in rows[0] and "route" not in rows[0]
    for row in rows:
        assert json.dumps(row, sort_keys=True) in terminal.getvalue()
    assert "private" not in terminal.getvalue()
    logs.close()


def test_install_mirrors_uvicorn_without_recursing(tmp_path):
    import subprocess
    import sys
    script = '''
import logging
from pathlib import Path
from server.development.logs import install
install(Path(__import__('sys').argv[1]))
logging.getLogger('uvicorn.error').info('Application startup complete.')
logging.getLogger('httpx').warning('private secret')
print('private transcript')
'''
    result = subprocess.run([sys.executable, "-c", script, str(tmp_path.resolve() / "run")],
                            cwd=Path(__file__).resolve().parents[3],
                            capture_output=True, text=True, check=True, timeout=10)
    assert "startup_complete" in result.stderr
    assert "Server logs:" in result.stderr
    assert "private secret" not in result.stdout + result.stderr
    assert "private transcript" not in result.stdout + result.stderr
    assert len((tmp_path / "run" / "server-logging.jsonl").read_text().splitlines()) == 3


@pytest.mark.parametrize(("number", "event_name"), [
    (errno.EADDRINUSE, "address_in_use"),
    (errno.EACCES, "permission_denied"),
    (errno.EPERM, "permission_denied"),
    (errno.EADDRNOTAVAIL, "address_unavailable"),
    (9999, "socket_error"),
])
def test_uvicorn_socket_errors_keep_actionable_reason_without_private_text(number, event_name):
    event = safe_record(record("uvicorn.error", OSError(number, "private credential", "private filename")))
    assert event["eventName"] == event_name
    assert event["message"]
    assert event["contentRedacted"] is True
    assert "private" not in json.dumps(event)


def test_uvicorn_unknown_errors_still_redact_arbitrary_text():
    event = safe_record(record("uvicorn.error", "private address already in use"))
    assert event["eventName"] == "other"
    assert "private" not in json.dumps(event)
