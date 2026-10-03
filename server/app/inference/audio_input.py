"""Validate bounded native PCM WAV for admission; forward original bytes."""

from __future__ import annotations

import math
import re
import io
import wave
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser

from fastapi import HTTPException

MAX_SECONDS = 120
SAMPLE_RATE = 16_000
MICROS_PER_HOUR = 111_000
MAX_COST_MICROS: int = math.ceil(MAX_SECONDS * MICROS_PER_HOUR / 3600)
@dataclass(frozen=True)
class AudioInput:
    wav: bytes
    duration: float
    fields: dict[str, str | list[str]]
    cost_micros: int


def decode_upload(body: bytes, *, content_type: str, language_code_width: int = 2) -> AudioInput:
    if "\r" in content_type or "\n" in content_type:
        raise HTTPException(status_code=400, detail="Malformed Content-Type.")
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
    )
    if not message.is_multipart() or message.defects:
        raise HTTPException(status_code=400, detail="Malformed multipart audio upload.")
    values: dict[str, bytes] = {}
    granularities: list[str] = []
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if name not in {"file", "model", "language", "prompt", "response_format", "timestamp_granularities[]", "timestamps_granularity", "tag_audio_events", "diarize", "no_verbatim"} or name in values:
            raise HTTPException(status_code=400, detail="Unknown or duplicate audio field.")
        value = part.get_payload(decode=True)
        if not isinstance(value, bytes) or part.defects or part.is_multipart():
            raise HTTPException(status_code=400, detail="Malformed audio field.")
        if name != "file" and len(value) > (80_000 if name == "prompt" else 4096):
            raise HTTPException(status_code=400, detail="Audio metadata is too long.")
        if name == "timestamp_granularities[]":
            if value not in {b"word", b"segment"} or value.decode() in granularities:
                raise HTTPException(status_code=400, detail="Timestamp granularities must be unique word or segment values.")
            granularities.append(value.decode())
            continue
        values[str(name)] = value
    audio = values.pop("file", b"")
    try:
        fields = {key: value.decode("utf-8", errors="strict") for key, value in values.items()}
    except UnicodeError as exc:
        raise HTTPException(status_code=400, detail="Audio metadata must be UTF-8.") from exc
    model = fields.get("model", "")
    if not model or len(model) > 256 or any(c.isspace() or ord(c) < 32 for c in model):
        raise HTTPException(status_code=400, detail="model must be a nonempty identifier of at most 256 characters.")
    if "response_format" in fields and fields["response_format"] not in {"json", "verbose_json"}:
        raise HTTPException(status_code=400, detail="Transcription requires json or verbose_json output.")
    # [@groq_transcription_api] Repeated multipart fields carry both granularities.
    if granularities and fields.get("response_format") != "verbose_json":
        raise HTTPException(status_code=400, detail="Timestamp granularities require verbose_json.")
    if "language" in fields and not re.fullmatch(r"[a-z]{2," + str(language_code_width) + "}(?:-[A-Za-z0-9]{1,8})*", fields["language"]):
        raise HTTPException(status_code=400, detail="Audio language code is invalid for the selected provider.")
    # Clients supply native PCM WAV. Validate the declared bytes and duration for
    # admission; do not run a media decoder or alter samples on the server.
    try:
        with wave.open(io.BytesIO(audio), 'rb') as reader:
            if (reader.getnchannels() != 1 or reader.getsampwidth() != 2
                    or reader.getcomptype() != 'NONE' or not 8000 <= reader.getframerate() <= 192000):
                raise ValueError()
            count = reader.getnframes()
            duration = count / reader.getframerate()
            if not 0 < duration <= MAX_SECONDS or len(reader.readframes(count)) != count * 2:
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise HTTPException(400, "Recording requires bounded mono 16-bit PCM WAV.") from None
    return AudioInput(wav=audio, duration=duration,
        fields={**fields, **({"timestamp_granularities[]": granularities} if granularities else {})},
        cost_micros=math.ceil(max(10, math.ceil(duration)) * MICROS_PER_HOUR / 3600))
