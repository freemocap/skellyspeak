"""Request validation rejects billing bypasses before any upstream request."""

from __future__ import annotations

import io
import json
import math
import wave

import httpx
import pytest
from fastapi import HTTPException

import server.app.inference.audio_input as audio_input
import server.app.inference.contracts as contracts

MODELS = ("google/gemini-2.5-flash", "openai/gpt-audio-mini")


def payload() -> dict[str, object]:
    return {"model": MODELS[0], "messages": [{"role": "user", "content": "Hola"}]}


@pytest.mark.parametrize("field,value", [
    ("models", [MODELS[1]]), ("model", []), ("model", ""),
    ("max_tokens", 0), ("max_tokens", True), ("max_tokens", 32769),
    ("temperature", float("nan")), ("temperature", True),
    ("stream", "true"), ("provider", {"order": ["expensive"]}),
    ("messages", [{"role": [], "content": "hello"}]),
    ("messages", [{"role": "user", "content": [{"type": "image_url"}]}]),
    ("messages", [{"role": "user", "content": "x" * 100_000}]),
])
def test_unsupported_requests_fail_with_400(field: str, value: object) -> None:
    request = payload()
    request[field] = value
    with pytest.raises(HTTPException) as error:
        contracts.chat_request(request, max_tokens=32768)
    assert error.value.status_code == 400


def test_missing_cap_is_inserted_without_model_price_filter() -> None:
    request = contracts.chat_request(payload(), max_tokens=32768)
    assert request.payload["max_tokens"] == 32768
    assert request.payload["provider"] == {
        "allow_fallbacks": False, "require_parameters": True,
    }
    assert request.reserve_micros >= 32768 * 2.5


def structured_format() -> dict[str, object]:
    return {"type": "json_schema", "json_schema": {
        "name": "word_gloss", "strict": True,
        "schema": {"type": "object", "additionalProperties": False,
                   "required": ["spans"], "properties": {"spans": {"type": "array", "items": {"type": "string"}}}},
    }}


def test_structured_schema_is_preserved_with_server_owned_routing() -> None:
    source = {**payload(), "response_format": structured_format(), "max_tokens": 2048}
    accepted = contracts.chat_request(source, max_tokens=32768)
    assert accepted.payload["response_format"] == source["response_format"]
    assert "provider" not in source
    assert accepted.payload["provider"]["allow_fallbacks"] is False
    assert accepted.payload["provider"]["require_parameters"] is True
    assert accepted.reserve_micros == math.ceil((len(json.dumps(source, ensure_ascii=False).encode("utf-8")) + 1024) * 0.3 + 2048 * 2.5)


@pytest.mark.parametrize("response_format", [
    "json", {"type": "json_object"},
    {"type": "json_schema", "json_schema": {"name": "word_gloss", "strict": False, "schema": {}}},
    {"type": "json_schema", "json_schema": {"name": "word_gloss", "strict": True, "schema": []}},
    {"type": "json_schema", "json_schema": {"name": "word_gloss", "strict": True, "schema": {}, "extra": "private marker"}},
])
def test_invalid_structured_envelope_is_rejected_without_echo(response_format: object) -> None:
    with pytest.raises(HTTPException) as error:
        contracts.chat_request({**payload(), "response_format": response_format}, max_tokens=32768)
    assert error.value.status_code == 400
    assert "private marker" not in str(error.value.detail)


def test_structured_schema_counts_toward_exact_utf8_request_limit() -> None:
    source = {**payload(), "response_format": structured_format()}
    schema = source["response_format"]["json_schema"]["schema"]
    schema["description"] = "界"
    size = len(json.dumps(source, ensure_ascii=False).encode("utf-8")) + 1024
    schema["description"] += "x" * (100_000 - size)
    contracts.chat_request(source, max_tokens=32768)
    schema["description"] += "x"
    with pytest.raises(HTTPException) as error:
        contracts.chat_request(source, max_tokens=32768)
    assert error.value.status_code == 400


def upload(seconds: int, model: str = "whisper-large-v3") -> httpx.Request:
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(audio_input.SAMPLE_RATE)
        wav.writeframes(bytes(seconds * audio_input.SAMPLE_RATE * 2))
    return httpx.Request(method="POST", url="https://test.invalid", data={
        "model": model, "language": "es", "response_format": "json",
    }, files={"file": ("audio.wav", output.getvalue(), "audio/wav")})


@pytest.mark.parametrize("seconds,charge", [(1, 309), (11, 340), (120, 3700)])
def test_decoded_duration_controls_reservation(seconds: int, charge: int) -> None:
    request = upload(seconds)
    result = audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
    assert len(result.pcm) == seconds * audio_input.SAMPLE_RATE * 2
    assert result.cost_micros == charge


def test_long_recording_is_rejected_without_truncating_it_into_a_billable_request() -> None:
    request = upload(121)
    with pytest.raises(HTTPException, match="120 seconds"):
        audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])


def timing_upload(format="verbose_json", granularities=("word", "segment")):
    return httpx.Request("POST", "https://test.invalid", files=[
        ("file", ("audio.wav", b"RIFF0000WAVE", "audio/wav")),
        ("model", (None, "whisper-large-v3")),
        ("language", (None, "es")),
        ("response_format", (None, format)),
        *(("timestamp_granularities[]", (None, value)) for value in granularities),
    ])


@pytest.mark.parametrize("granularities", [("word",), ("segment",), ("word", "segment"), ()])
def test_verbose_audio_preserves_timestamp_fields(monkeypatch, granularities):
    import subprocess
    monkeypatch.setattr(audio_input.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess([], 0, stdout=bytes(32000)))
    request = timing_upload(granularities=granularities)
    decoded = audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
    assert decoded.fields["response_format"] == "verbose_json"
    assert decoded.fields.get("timestamp_granularities[]", []) == list(granularities)
    assert decoded.cost_micros == 309


@pytest.mark.parametrize("format,granularities", [("json", ("word",)), ("verbose_json", ("word", "word")), ("verbose_json", ("sentence",)), ("text", ())])
def test_invalid_timing_fields_rejected_before_decode(monkeypatch, format, granularities):
    def forbidden(*args, **kwargs):
        raise AssertionError("Invalid fields must not reach the decoder")
    monkeypatch.setattr(audio_input.subprocess, "run", forbidden)
    request = timing_upload(format, granularities)
    with pytest.raises(HTTPException) as error:
        audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
    assert error.value.status_code == 400

@pytest.mark.parametrize("answer", ["Sí, me gusta la música.", "No, no me gusta la música."])
def test_opening_role_and_human_answer_reach_upstream_unchanged(answer):
    messages = [
        {"role": "system", "content": "Converse in Spanish."},
        {"role": "assistant", "content": "¿Te gusta la música?"},
        {"role": "user", "content": answer},
    ]
    request = {"model": MODELS[0], "messages": messages}
    validated = contracts.chat_request(request, max_tokens=2048)
    assert validated.payload["messages"] == messages


def test_other_model_is_forwarded_with_reservation_estimate_only():
    source = {**payload(), 'model': 'new/model', 'max_tokens': 2048}
    result = contracts.chat_request(source, max_tokens=32768)
    assert result.payload['model'] == 'new/model'
    assert 'max_price' not in result.payload['provider']
    assert 'only' not in result.payload['provider']
    assert result.reserve_micros == math.ceil((len(json.dumps(source, ensure_ascii=False).encode()) + 1024) * 0.3 + 2048 * 2.5)


@pytest.mark.parametrize("model", ["whisper-large-v3-turbo", "future-transcription-model"])
def test_transcription_model_is_forwarded_without_a_catalog_gate(model):
    request = upload(1, model=model)
    decoded = audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])
    assert decoded.fields["model"] == model


@pytest.mark.parametrize("model", ["", "has spaces", "line\nbreak", "x" * 257])
def test_transcription_model_identifier_is_bounded(model):
    request = upload(1, model=model)
    with pytest.raises(HTTPException, match="nonempty identifier"):
        audio_input.decode_upload(request.read(), content_type=request.headers["content-type"])


@pytest.mark.parametrize('model', ['future/audio-model', 'openai/gpt-audio-mini'])
def test_output_shape_not_model_name_selects_speech_contract(model):
    source = {**payload(), 'model': model, 'modalities': ['text', 'audio'],
              'audio': {'voice': 'alloy', 'format': 'pcm16'}, 'stream': True}
    result = contracts.chat_request(source, max_tokens=32768)
    assert result.payload['model'] == model
    assert result.payload['max_tokens'] == 2000
    assert result.payload['audio'] == source['audio']
    text = contracts.chat_request({**payload(), 'model': model}, max_tokens=32768)
    assert text.payload['model'] == model
    assert text.payload['max_tokens'] == 32768
