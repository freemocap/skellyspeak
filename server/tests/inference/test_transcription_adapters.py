"""The transport preserves provider content; native validates word intervals."""
import json
from email import policy
from email.parser import BytesParser
import httpx
import pytest
from server.app.inference.audio_contracts import AudioFailure, TranscriptionRequest
from server.app.inference.elevenlabs import ElevenLabs
from server.app.inference.groq_transcription import GroqTranscription
from server.tests.inference.test_elevenlabs import wav

@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
@pytest.mark.parametrize('text', ['café', 'cafe\u0301', '你好', 'مرحبا', 'नमस्ते'])
async def test_raw_response_and_native_wav_survive(provider, text):
    payload = {'text':text, 'words':[{'word':text, 'start':1.18, 'end':1.82}],
               'segments':[{'avg_logprob':-.2}], 'new_metadata':{'counter':12}}
    audio = wav()
    def respond(request):
        message = BytesParser(policy=policy.default).parsebytes(
            f"Content-Type: {request.headers['content-type']}\r\nMIME-Version: 1.0\r\n\r\n".encode() + request.read())
        fields = {p.get_param('name', header='content-disposition'):p.get_payload(decode=True) for p in message.iter_parts()}
        assert fields['file'] == audio
        assert fields['prompt'] == b'client context'
        if provider == 'groq':
            assert fields['language'] == b'en'
            assert request.headers['authorization'] == 'Bearer secret-key'
            assert 'xi-api-key' not in request.headers
        else:
            assert fields['language_code'] == b'en'
            assert request.headers['xi-api-key'] == 'secret-key'
            assert 'authorization' not in request.headers
        return httpx.Response(200, json=payload, headers={'request-id':'req-1'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        source = TranscriptionRequest(audio, 'en', {'prompt':'client context'})
        if provider == 'groq':
            result = await GroqTranscription(client, api_key='secret-key', base_url='https://groq.invalid/v1').transcribe(source)
        else:
            result = await ElevenLabs(client, api_key='secret-key').transcribe(source, model='scribe_v2')
    assert result.response == payload
    assert result.receipt.request_id == 'req-1'
    diagnostic = json.dumps(result.receipt.diagnostics, ensure_ascii=False)
    assert text not in diagnostic and 'client context' not in diagnostic and 'secret-key' not in diagnostic

@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
@pytest.mark.parametrize('body', [b'[]', b'not json', b'{"n": NaN}'])
async def test_invalid_json_retains_receipt(provider, body):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _:httpx.Response(
        200, content=body, headers={'request-id':'bad-json'}))) as client:
        source = TranscriptionRequest(wav(), 'en')
        with pytest.raises(AudioFailure) as error:
            if provider == 'groq':
                await GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1').transcribe(source)
            else:
                await ElevenLabs(client, api_key='key').transcribe(source, model='scribe_v2')
    assert error.value.receipt.request_id == 'bad-json'
    assert error.value.unknown_outcome
