"""Validate an upload and decode at most 121 seconds of one audio track."""

from __future__ import annotations

import math
import re
import subprocess
from dataclasses import dataclass
from email import policy
from email.parser import BytesParser

from fastapi import HTTPException

MAX_SECONDS = 120
SAMPLE_RATE = 16_000
MICROS_PER_HOUR = 111_000


def verify_decoder() -> None:
    subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=10, check=True)


@dataclass(frozen=True)
class AudioInput:
    pcm: bytes
    fields: dict[str, str]
    cost_micros: int


def decode_upload(body: bytes, *, content_type: str) -> AudioInput:
    if "\r" in content_type or "\n" in content_type:
        raise HTTPException(status_code=400, detail="Malformed Content-Type.")
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
    )
    if not message.is_multipart() or message.defects:
        raise HTTPException(status_code=400, detail="Malformed multipart audio upload.")
    values: dict[str, bytes] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if name not in {"file", "model", "language", "prompt", "response_format"} or name in values:
            raise HTTPException(status_code=400, detail="Unknown or duplicate audio field.")
        value = part.get_payload(decode=True)
        if not isinstance(value, bytes) or part.defects or part.is_multipart():
            raise HTTPException(status_code=400, detail="Malformed audio field.")
        if name != "file" and len(value) > 4096:
            raise HTTPException(status_code=400, detail="Audio metadata is too long.")
        values[str(name)] = value
    audio = values.pop("file", b"")
    try:
        fields = {key: value.decode("utf-8", errors="strict") for key, value in values.items()}
    except UnicodeError as exc:
        raise HTTPException(status_code=400, detail="Audio metadata must be UTF-8.") from exc
    if fields.get("model") != "whisper-large-v3" or fields.get("response_format") != "json":
        raise HTTPException(status_code=400, detail="Only whisper-large-v3 JSON transcription is supported.")
    if not re.fullmatch(r"[a-z]{2}", fields.get("language", "")):
        raise HTTPException(status_code=400, detail="A two-letter audio language is required.")
    if audio.startswith(b"RIFF") and audio[8:12] == b"WAVE":
        container = "wav"
    elif audio.startswith(bytes.fromhex("1a45dfa3")):
        container = "matroska"
    elif audio[4:8] == b"ftyp":
        container = "mov"
    elif audio.startswith(b"OggS"):
        container = "ogg"
    else:
        raise HTTPException(status_code=400, detail="Unsupported audio container.")
    try:
        decoded = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-threads", "1",
             "-max_alloc", "67108864", "-probesize", "1048576", "-analyzeduration", "5000000",
             "-protocol_whitelist", "pipe", "-f", container, "-i", "pipe:0",
             "-map", "0:a:0", "-t", str(MAX_SECONDS + 1), "-ac", "1", "-ar", str(SAMPLE_RATE),
             "-f", "s16le", "pipe:1"],
            input=audio, capture_output=True, timeout=20, check=True,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=400, detail="Audio decoding exceeded its time limit.") from exc
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=400, detail="The recording cannot be decoded.") from exc
    pcm = decoded.stdout
    duration = len(pcm) / (2 * SAMPLE_RATE)
    if duration <= 0 or duration > MAX_SECONDS:
        raise HTTPException(status_code=400, detail=f"Recording must contain 0–{MAX_SECONDS} seconds of audio.")
    return AudioInput(
        pcm=pcm, fields=fields,
        cost_micros=math.ceil(max(10, math.ceil(duration)) * MICROS_PER_HOUR / 3600),
    )
