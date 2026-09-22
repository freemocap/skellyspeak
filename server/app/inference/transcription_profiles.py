"""Transcription composition boundary: model binding is independent of access."""
from dataclasses import dataclass
from functools import partial
from collections.abc import Awaitable, Callable
import httpx
from server.app.inference.audio_contracts import TranscriptionRequest, TranscriptionResult
from server.app.inference import elevenlabs, groq_transcription

@dataclass(frozen=True)
class TranscriptionBinding:
    provider: str
    label: str
    micros_per_hour: int
    configured: bool
    language_code: Callable[[str | None], str | None]
    create: Callable[[httpx.AsyncClient], Callable[[TranscriptionRequest], Awaitable[TranscriptionResult]]]


def bind(model, cfg):
    if model == "scribe_v2":
        def create(client):
            adapter = elevenlabs.ElevenLabs(client, api_key=cfg.elevenlabs_key)
            return partial(adapter.transcribe, model=model)
        return TranscriptionBinding("elevenlabs", "ElevenLabs", 220_000, bool(cfg.elevenlabs_key),
                                    elevenlabs.transcription_language, create)
    # Preserve the existing custom-model forwarding contract. Groq validates its model IDs.
    def create(client):
        return groq_transcription.GroqTranscription(client, api_key=cfg.groq_key,
            base_url=cfg.groq_base_url, model=model).transcribe
    rate = 40_000 if model == "whisper-large-v3-turbo" else 111_000
    return TranscriptionBinding("groq", "Groq", rate, bool(cfg.groq_key),
                                groq_transcription.transcription_language, create)

MAX_MICROS_PER_HOUR = 220_000
