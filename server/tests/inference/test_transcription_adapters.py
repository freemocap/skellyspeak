"""One internal request/result contract across both provider boundaries."""
import json
from dataclasses import replace
from email import policy
from email.parser import BytesParser

import httpx
import pytest

from server.app.inference.audio_contracts import AudioFailure, TranscriptionRequest
from server.app.inference.elevenlabs import ElevenLabs
from server.app.inference.groq_transcription import GroqTranscription


@pytest.mark.asyncio
@pytest.mark.parametrize('tag,code,text', [('en-US','en','Hello'), ('es-MX','es','Hola'),
    ('ar-LB','ar','صباح الخير'), ('zh-Hans','zh','你好')])
async def test_same_request_and_result_across_providers(tag, code, text):
    source = TranscriptionRequest(bytes(32000), tag, 'private context')
    results = []
    for provider in ['groq', 'elevenlabs']:
        def respond(request):
            message = BytesParser(policy=policy.default).parsebytes(
                f"Content-Type: {request.headers['content-type']}\r\nMIME-Version: 1.0\r\n\r\n".encode() + request.read())
            fields = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True) for part in message.iter_parts()}
            if provider == 'groq':
                assert fields['language'] == code.encode()
                assert fields['model'] == b'whisper-large-v3'
                assert request.headers['authorization'] == 'Bearer secret-key'
                assert 'xi-api-key' not in request.headers
                payload = {'text':text, 'words':[{'word':text,'start':.1,'end':.8}]}
            else:
                assert fields['language_code'] == code.encode()
                assert fields['model_id'] == b'scribe_v2'
                assert fields['no_verbatim'] == b'false'
                assert 'prompt' not in fields
                assert request.headers['xi-api-key'] == 'secret-key'
                assert 'authorization' not in request.headers
                payload = {'text':text, 'language_code':code, 'words':[{'type':'word','text':text,'start':.1,'end':.8}]}
            return httpx.Response(200, json=payload, headers={'request-id':'req-1'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            adapter = (GroqTranscription(client, api_key='secret-key', base_url='https://groq.invalid/v1')
                       if provider == 'groq' else ElevenLabs(client, api_key='secret-key'))
            result = await adapter.transcribe(source)
            results.append((result.text, result.duration_seconds, result.words))
            diagnostic = json.dumps(result.receipt.diagnostics, ensure_ascii=False)
            assert text not in diagnostic and 'private context' not in diagnostic and 'secret-key' not in diagnostic
            assert result.receipt.request_id == 'req-1'
    assert results[0] == results[1]


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq','elevenlabs'])
async def test_absent_timing_is_explicit_and_missing_language_never_submits(provider):
    calls = []
    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={'text':'Hello'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = (GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1')
                   if provider == 'groq' else ElevenLabs(client, api_key='key'))
        source = TranscriptionRequest(bytes(32000), 'en')
        result = await adapter.transcribe(source)
        assert result.words is None
        for tag in ['', None, 'en_XX']:
            with pytest.raises(AudioFailure) as error:
                await adapter.transcribe(replace(source, language_tag=tag))
            assert error.value.code == 'AUDIO_INPUT_INVALID'
        assert len(calls) == 1
