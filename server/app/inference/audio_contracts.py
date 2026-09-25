"""Internal audio contracts. No HTTP, credentials, routing or spending policy.

Voice identifiers belong to a selected provider profile, not language content.
Dollar cost is optional: character counts and audio duration are not invoices.
These types are not yet the public hosted wire contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class SynthesisRequest:
    model: str
    voice_id: str
    text: str = field(repr=False)
    language_code: str | None = None
    language_variety: str | None = None


@dataclass(frozen=True)
class TranscriptionRequest:
    # Already decoded by the admission layer: mono signed 16-bit PCM, 16 kHz.
    pcm: bytes = field(repr=False)
    language_tag: str
    context: str = field(default="", repr=False)


@dataclass(frozen=True)
class AudioReceipt:
    provider: str
    requested_model: str
    # A provider request ID is correlation evidence, not proof of billing.
    request_id: str | None = None
    cost_micros: int | None = None
    diagnostics: dict | None = None


@dataclass(frozen=True)
class SynthesisResult:
    wav: bytes = field(repr=False)
    duration_seconds: float
    receipt: AudioReceipt
    alignment: dict | None = field(default=None, repr=False)


@dataclass(frozen=True)
class WordTiming:
    text: str = field(repr=False)
    start: float
    end: float


@dataclass(frozen=True)
class TranscriptionResult:
    text: str = field(repr=False)
    duration_seconds: float
    words: tuple[WordTiming, ...] | None
    receipt: AudioReceipt


class AudioFailure(Exception):
    """Fixed code, redacted provider detail and partial receipt; never raw bodies.

unknown_outcome means submission may have incurred a charge. Even a known HTTP
refusal is not a billing receipt; callers must not invent a zero dollar charge.
"""

    def __init__(self, code: str, *, receipt: AudioReceipt,
                 unknown_outcome: bool, status: int | None = None,
                 provider_error: dict[str, str] | None = None, diagnostics: dict | None = None):
        super().__init__(code)
        self.code = code
        self.receipt = receipt
        self.unknown_outcome = unknown_outcome
        self.status = status
        self.provider_error = provider_error
        self.diagnostics = diagnostics


class AudioProvider(Protocol):
    async def synthesize(self, request: SynthesisRequest) -> SynthesisResult: ...

    async def transcribe(self, request: TranscriptionRequest) -> TranscriptionResult: ...
