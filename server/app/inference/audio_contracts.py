"""Internal audio contracts. No HTTP, credentials, routing or spending policy.

Voice identifiers belong to a selected provider profile, not language content.
Dollar cost is optional: character counts and audio duration are not invoices.
These types are internal; the wire response retains the bounded provider object.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SynthesisRequest:
    model: str
    voice_id: str
    text: str = field(repr=False)
    language_code: str | None = None


@dataclass(frozen=True)
class TranscriptionRequest:
    # Validated native WAV; forwarded without decoding or resampling.
    wav: bytes = field(repr=False)
    language_tag: str
    fields: dict[str, str] = field(default_factory=dict, repr=False)


@dataclass(frozen=True)
class AudioReceipt:
    provider: str
    requested_model: str
    # A provider request ID is correlation evidence, not proof of billing.
    request_id: str | None = None
    cost_micros: int | None = None
    diagnostics: dict | None = None


@dataclass(frozen=True)
class AudioResult:
    response: dict | None = field(repr=False)
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
