"""The relay has no media decoder process or decoder readiness gate."""
import logging
import json
import pytest
from server.app import main

@pytest.mark.asyncio
async def test_startup_requires_no_decoder(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger='skellyspeak.runtime')
    async def forbidden(*args, **kwargs):
        pytest.fail('Runtime started a decoder subprocess')
    monkeypatch.setattr(main.asyncio, 'create_subprocess_exec', forbidden)
    async with main.lifespan(main.app):
        pass
    events = [json.loads(row.message)['event'] for row in caplog.records]
    assert events == ['runtime_started', 'runtime_stopped']
