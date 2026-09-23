"""Decoder startup blocks readiness, tolerates cold starts and reports failures."""
import asyncio
import errno
import json
import logging
import subprocess

import pytest

from server.app import main
from server.app.inference import audio_input
from server.app.diagnostics.exceptions import DiagnosticRuntimeError


@pytest.mark.asyncio
async def test_startup_waits_for_decoder_and_records_completion(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger="skellyspeak.runtime")
    entered = asyncio.Event()
    release = asyncio.Event()

    async def pending_check(function):
        assert function is audio_input.verify_decoder
        entered.set()
        await release.wait()

    monkeypatch.setattr(main.asyncio, "to_thread", pending_check)
    ready = False

    async def start():
        nonlocal ready
        async with main.lifespan(main.app):
            ready = True

    task = asyncio.create_task(start())
    await entered.wait()
    assert not ready
    release.set()
    await task
    events = [json.loads(row.message) for row in caplog.records]
    assert [row["event"] for row in events] == [
        "runtime_started", "decoder_check_started", "decoder_check_finished", "runtime_stopped"]
    assert events[2]["duration_ms"] >= 0


def test_cold_start_longer_than_old_budget_is_allowed(monkeypatch):
    def run(command, *, capture_output, timeout, check):
        assert command == ["ffmpeg", "-version"]
        assert capture_output and check
        assert timeout == 60
        # Model a cold start that exceeded the old 10-second cutoff.
        if timeout < 15:
            raise subprocess.TimeoutExpired(command, timeout)
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(audio_input.subprocess, "run", run)
    audio_input.verify_decoder()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure,reason,exit_code,os_errno", [
    (subprocess.TimeoutExpired(["private-command"], 60, output=b"private-output"), "timeout", None, None),
    (subprocess.CalledProcessError(7, ["private-command"], stderr=b"private-output"), "nonzero_exit", 7, None),
    (FileNotFoundError(errno.ENOENT, "No such file", "/private-path"), "execution_failed", None, errno.ENOENT),
])
async def test_decoder_failure_refuses_startup_with_safe_diagnostics(
    monkeypatch, caplog, failure, reason, exit_code, os_errno,
):
    caplog.set_level(logging.INFO, logger="skellyspeak.runtime")
    calls = []

    def fail(*args, **kwargs):
        calls.append(kwargs)
        raise failure

    monkeypatch.setattr(audio_input.subprocess, "run", fail)
    with pytest.raises(DiagnosticRuntimeError):
        async with main.lifespan(main.app):
            pytest.fail("An unavailable decoder must not become ready")
    assert len(calls) == 1
    events = [json.loads(row.message) for row in caplog.records]
    assert [row["event"] for row in events] == [
        "runtime_started", "decoder_check_started", "decoder_check_failed"]
    failed = events[-1]
    assert failed["duration_ms"] >= 0
    assert caplog.records[-1].levelno == logging.ERROR
    diagnostics = failed["diagnostics"]["causes"][0]["diagnostics"]
    assert diagnostics == {
        "stage": "decoder_startup", "timeout_seconds": 60, "reason": reason,
        "exit_code": exit_code, "errno": os_errno, "output_omitted": True,
    }
    assert failed["diagnostics"]["causes"][1]["exception_type"] == type(failure).__name__
    assert "private-command" not in caplog.text
    assert "private-output" not in caplog.text
    assert "private-path" not in caplog.text
