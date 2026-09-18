"""Local launcher reads only provider secrets from the conventional .env file."""
from __future__ import annotations

import os
from pathlib import Path

import pytest

import server.development.launcher as local_server


def test_dotenv_is_required_and_values_are_not_in_errors(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / ".env"
    path.write_text("OPENROUTER_API_KEY=private-secret-for-testing\nGROQ_API_KEY=another-private-secret\n")
    for key in local_server.KEYS:
        monkeypatch.delenv(key, raising=False)
    assert set(local_server.load_keys(path)) == set(local_server.KEYS)
    path.write_text("OPENROUTER_API_KEY=\nGROQ_API_KEY=\n")
    for key in local_server.KEYS:
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(RuntimeError, match="must be set") as error:
        local_server.load_keys(path)
    assert "private-secret" not in str(error.value)


def test_local_configuration_replaces_inherited_destinations(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(local_server.os, "environ", {"FIRESTORE_EMULATOR_HOST": "external.invalid:443", "GOOGLE_CLOUD_PROJECT": "production"})
    local_server.configure({key: "test-only-provider-key" for key in local_server.KEYS}, "test-only-signing-key")
    assert os.environ["GOOGLE_CLOUD_PROJECT"] == "skellyspeak-local-test"
    assert os.environ["OPENROUTER_BASE_URL"] == "https://openrouter.ai/api/v1"
    assert os.environ["GLOBAL_DAILY_MICROS"] == "500000"


def test_elevenlabs_local_configuration_requires_voice_and_explicit_selection(tmp_path, monkeypatch):
    for key in (*local_server.KEYS, "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "STT_PROVIDER"):
        monkeypatch.delenv(key, raising=False)
    path = tmp_path / '.env'
    path.write_text('OPENROUTER_API_KEY=test-chat-key-long\nGROQ_API_KEY=test-groq-key-long\n'
                    'ELEVENLABS_API_KEY=test-elevenlabs-key\nSTT_PROVIDER=elevenlabs\n')
    with pytest.raises(RuntimeError, match='ELEVENLABS_VOICE_ID'):
        local_server.load_keys(path)
    monkeypatch.setenv('ELEVENLABS_VOICE_ID', 'validVoiceId')
    values = local_server.load_keys(path)
    assert values['ELEVENLABS_API_KEY'] == 'test-elevenlabs-key'
