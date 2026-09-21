"""Adapter HTTP contract tests; no network or paid provider calls."""
import asyncio
from dataclasses import replace
import io
import json
import wave

import httpx
import pytest

from server.app.inference.audio_contracts import AudioFailure, SynthesisRequest, TranscriptionRequest
from server.app.inference.elevenlabs import ElevenLabs, MAX_PCM_BYTES

KEY = "test-elevenlabs-secret"
SPEECH = SynthesisRequest("eleven_v3", "fixtureVoiceId", "നന്ദി", "ml")
RECORDING = TranscriptionRequest("scribe_v2", b"\0\0" * 16_000, "ml")


def transcript():
    return {"text": "അത് നല്ലതാണ്.", "language_code": "ml", "language_probability": 0.87,
            "words": [{"type": "word", "text": "അത്", "start": 0.0, "end": 0.3},
                      {"type": "spacing", "text": " "},
                      {"type": "word", "text": "നല്ലതാണ്.", "start": 0.4, "end": 0.9}]}


@pytest.mark.asyncio
async def test_speech_sends_verbatim_source_and_returns_standard_wav():
    async def respond(request):
        assert str(request.url) == "https://api.elevenlabs.io/v1/text-to-speech/fixtureVoiceId?output_format=pcm_24000"
        assert request.headers["xi-api-key"] == KEY
        assert "authorization" not in request.headers
        assert "cookie" not in request.headers
        assert "x-api-key" not in request.headers
        assert json.loads(request.content) == {"text": "നന്ദി", "model_id": "eleven_v3",
                                              "language_code": "ml", "apply_text_normalization": "off"}
        return httpx.Response(200, content=b"\x01\0" * 24_000,
                              headers={"content-type": "audio/pcm", "request-id": "receipt-123"})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond),
                                headers={"x-api-key": "other-provider-key"},
                                cookies={"session": "other-service-session"},
                                auth=("other-user", "other-password")) as client:
        result = await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    with wave.open(io.BytesIO(result.wav)) as audio:
        assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (24_000, 1, 2)
        assert audio.getnframes() == 24_000
    assert result.duration_seconds == 1
    assert result.receipt.request_id == "receipt-123"
    assert result.receipt.cost_micros is None
    assert "നന്ദി" not in repr(SPEECH)
    assert "wav=" not in repr(result)


@pytest.mark.asyncio
@pytest.mark.parametrize("language", ["ml", "hi", "ga", "gle", "gd", None])
async def test_transcription_language_is_not_limited_by_whisper(language):
    async def respond(request):
        body = await request.aread()
        assert request.url.path == "/v1/speech-to-text"
        assert b'name="model_id"\r\n\r\nscribe_v2' in body
        for name, value in [("no_verbatim", "true"), ("tag_audio_events", "false"),
                            ("diarize", "false"), ("timestamps_granularity", "word")]:
            assert f'name="{name}"\r\n\r\n{value}'.encode() in body
        assert b'name="prompt"' not in body
        assert b'name="keyterms"' not in body
        assert b'RIFF' in body and b'WAVE' in body
        if language is None:
            assert b'name="language_code"' not in body
        else:
            assert f'name="language_code"\r\n\r\n{language}'.encode() in body
        return httpx.Response(200, json=transcript())
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        result = await ElevenLabs(client, api_key=KEY).transcribe(replace(RECORDING, language_code=language))
    assert result.text == transcript()["text"]
    assert result.duration_seconds == 1
    assert [word.text for word in result.words] == ["അത്", "നല്ലതാണ്."]
    assert result.language_probability == 0.87
    assert result.receipt.provider == "elevenlabs"
    assert result.receipt.cost_micros is None
    assert result.receipt.diagnostics["no_verbatim"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [302, 401, 403, 429, 500, 503])
async def test_refusals_do_not_retry_follow_redirects_or_expose_body(status):
    calls = []
    def respond(request):
        calls.append(request)
        return httpx.Response(status, headers={"location": "https://other.invalid/steal",
                              "request-id": "failure-receipt"}, text=f"private transcript {KEY}")
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond), follow_redirects=True) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    assert len(calls) == 1
    assert error.value.status == status
    assert error.value.receipt.request_id == "failure-receipt"
    assert error.value.receipt.cost_micros is None
    assert error.value.unknown_outcome == (status >= 500)
    assert KEY not in str(error.value) and "private" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("body,media,code", [
    (b"", "audio/pcm", "AUDIO_RESPONSE_INVALID"),
    (b"x", "audio/pcm", "AUDIO_RESPONSE_INVALID"),
    (b"{}", "application/json", "AUDIO_RESPONSE_TYPE"),
    pytest.param(b"x" * (MAX_PCM_BYTES + 2), "audio/pcm", "AUDIO_RESPONSE_LIMIT", id="oversized-pcm"),
])
async def test_invalid_audio_retains_receipt_and_unknown_cost(body, media, code):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
            200, content=body, headers={"content-type": media, "request-id": "request-123"}))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    assert error.value.code == code
    assert error.value.unknown_outcome
    assert error.value.receipt.request_id == "request-123"


@pytest.mark.asyncio
@pytest.mark.parametrize("change", [
    {"text": 12}, {"words": None}, {"words": [{"type": "word", "text": "a", "start": 0, "end": 2}]},
    {"words": [{"type": "word", "text": "a", "start": -1, "end": 0.2}]},
    {"words": [{"type": "word", "text": "a", "start": True, "end": 0.2}]},
    {"language_probability": float("nan")}, {"language_code": "malayalam"},
])
async def test_malformed_transcripts_are_not_published(change):
    body = json.dumps(transcript() | change).encode()
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
            200, content=body, headers={"content-type": "application/json"}))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).transcribe(RECORDING)
    assert error.value.code == "AUDIO_RESPONSE_INVALID"
    assert error.value.unknown_outcome


@pytest.mark.asyncio
async def test_silence_is_explicit_and_not_an_invented_transcript_or_zero_charge():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
            200, json={"text": "", "words": []}))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).transcribe(RECORDING)
    assert error.value.code == "AUDIO_NO_SPEECH"
    assert not error.value.unknown_outcome
    assert error.value.receipt.cost_micros is None


@pytest.mark.asyncio
@pytest.mark.parametrize("audio_request", [replace(SPEECH, voice_id="../other"), replace(SPEECH, text=" "),
    replace(SPEECH, language_code="mal"), replace(RECORDING, pcm=b"x"),
    replace(RECORDING, language_code="ml-IN")])
async def test_input_validation_happens_before_network(audio_request):
    def unexpected(_):
        pytest.fail("Invalid input reached the provider")
    async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected)) as client:
        adapter = ElevenLabs(client, api_key=KEY)
        with pytest.raises(AudioFailure) as error:
            await (adapter.synthesize(audio_request) if isinstance(audio_request, SynthesisRequest) else adapter.transcribe(audio_request))
    assert error.value.code == "AUDIO_INPUT_INVALID"
    assert not error.value.unknown_outcome


@pytest.mark.asyncio
async def test_transport_error_is_unknown_and_cancellation_propagates():
    calls = 0
    async def respond(_):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ReadError(f"sensitive {KEY}")
        raise asyncio.CancelledError()
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = ElevenLabs(client, api_key=KEY)
        with pytest.raises(AudioFailure) as error:
            await adapter.transcribe(RECORDING)
        assert error.value.unknown_outcome
        assert KEY not in str(error.value)
        assert calls == 1
        with pytest.raises(asyncio.CancelledError):
            await adapter.transcribe(RECORDING)


class InterruptedAudio(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b"\0\0"
        raise httpx.ReadError("private response detail")


@pytest.mark.asyncio
async def test_partial_audio_is_not_published_and_receipt_survives_interruption():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
            200, stream=InterruptedAudio(),
            headers={"content-type": "audio/pcm", "request-id": "partial-receipt"}))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    assert error.value.code == "AUDIO_TRANSPORT_UNKNOWN"
    assert error.value.receipt.request_id == "partial-receipt"
    assert error.value.unknown_outcome


@pytest.mark.asyncio
async def test_latin_recognition_is_preserved_as_evidence_not_retranslated():
    value = {"text": "athu nallathaanu", "language_code": "ml", "language_probability": 0.2,
             "words": []}
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=value))) as client:
        result = await ElevenLabs(client, api_key=KEY).transcribe(RECORDING)
    assert result.text == value["text"]
    assert result.words == ()
    assert result.language_probability == 0.2


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [b"not json", b'{"detail":', b'x' * 16_385])
async def test_unreadable_error_detail_preserves_http_status(body):
    async with httpx.AsyncClient(transport=httpx.MockTransport(
            lambda _: httpx.Response(401, content=body))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    assert error.value.status == 401
    assert error.value.provider_error is None


@pytest.mark.asyncio
async def test_provider_error_message_is_bounded_and_code_is_preserved():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
            401, json={"detail": {"status": "quota_exceeded", "message": "No credits. " * 300}}))) as client:
        with pytest.raises(AudioFailure) as error:
            await ElevenLabs(client, api_key=KEY).synthesize(SPEECH)
    assert error.value.provider_error["code"] == "quota_exceeded"
    assert len(error.value.provider_error["message"]) == 1024


@pytest.mark.asyncio
@pytest.mark.parametrize("variety", ["Spanish — Mexico", "Spanish — Spain", "English — United Kingdom"])
async def test_variety_reaches_provider_without_changing_source(variety):
    source = replace(SPEECH, text="Gracias.", language_code="es", language_variety=variety)
    def respond(request):
        body = json.loads(request.content)
        assert body["text"] == f"[{variety} accent]\nGracias."
        assert body["language_code"] == "es"
        return httpx.Response(200, content=b"\0\0", headers={"content-type": "audio/pcm"})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        await ElevenLabs(client, api_key=KEY).synthesize(source)
    assert source.text == "Gracias."


@pytest.mark.asyncio
async def test_variety_is_not_silently_dropped_for_unsupported_model():
    def respond(request):
        pytest.fail("Unsupported accent request reached provider")
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(AudioFailure) as failure:
            await ElevenLabs(client, api_key=KEY).synthesize(
                replace(SPEECH, model="eleven_multilingual_v2", language_variety="Spanish — Mexico"))
    assert failure.value.code == "AUDIO_INPUT_INVALID"
