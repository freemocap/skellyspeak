"""Local launcher parses secrets without evaluating shell syntax or printing them."""
from __future__ import annotations

import os
from pathlib import Path

import pytest

import local_server


def test_private_env_is_required_and_values_are_not_in_errors(tmp_path: Path) -> None:
    path = tmp_path / "local.env"
    path.write_text("OPENROUTER_API_KEY=private-secret-for-testing\nGROQ_API_KEY=another-private-secret\n")
    path.chmod(0o644)
    with pytest.raises(RuntimeError, match="owner-only"):
        local_server.read_keys(path)
    path.chmod(0o600)
    assert set(local_server.read_keys(path)) == local_server.KEYS
    path.write_text("UNSUPPORTED=private-secret-for-testing\n")
    with pytest.raises(RuntimeError) as error:
        local_server.read_keys(path)
    assert "private-secret" not in str(error.value)
    path.write_text("OPENROUTER_API_KEY=\nGROQ_API_KEY=\n")
    with pytest.raises(RuntimeError, match="missing or malformed"):
        local_server.read_keys(path)


def test_local_configuration_replaces_inherited_destinations(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(local_server.os, "environ", {"FIRESTORE_EMULATOR_HOST": "external.invalid:443", "GOOGLE_CLOUD_PROJECT": "production"})
    local_server.configure({key: "test-only-provider-key" for key in local_server.KEYS}, "test-only-signing-key")
    assert os.environ["FIRESTORE_EMULATOR_HOST"] == "127.0.0.1:8787"
    assert os.environ["GOOGLE_CLOUD_PROJECT"] == "skellyspeak-local-test"
    assert os.environ["OPENROUTER_BASE_URL"] == "https://openrouter.ai/api/v1"
    assert os.environ["GLOBAL_DAILY_MICROS"] == "500000"
