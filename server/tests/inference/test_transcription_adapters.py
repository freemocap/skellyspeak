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


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
async def test_word_end_overrun_preserves_transcript_with_explicit_unavailable_timing(provider):
    # Reproduce the iPad receipt's final word: end=1.82 on about 1.76 s of PCM.
    duration = 1.7626875
    source = TranscriptionRequest(bytes(int(duration * 32000)), 'en')
    def respond(_request):
        word = {'start': 1.18, 'end': 1.82}
        word.update({'word': 'private-word'} if provider == 'groq' else {'text': 'private-word', 'type': 'word'})
        return httpx.Response(200, json={'text': 'private-transcript', 'words': [word]},
                              headers={'request-id': 'timing-receipt'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = (GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1')
                   if provider == 'groq' else ElevenLabs(client, api_key='key'))
        result = await adapter.transcribe(source)
    assert result.text == 'private-transcript'
    assert result.words is None
    assert result.duration_seconds == duration
    assert result.receipt.request_id == 'timing-receipt'
    assert result.receipt.cost_micros is None
    detail = result.receipt.diagnostics
    assert detail['timing']['status'] == 'unavailable'
    assert detail['timing']['path'] == 'words[0]'
    assert detail['response']['words'][0]['end'] == 1.82
    assert 'private-word' not in json.dumps(detail)
    assert 'private-transcript' not in json.dumps(detail)


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
@pytest.mark.parametrize('start,end', [(0, 1.101), (-.01, .8), (.8, .7), (1.01, 1.05), (True, .8), (0, float('nan'))])
async def test_invalid_alignment_does_not_discard_valid_transcript(provider, start, end):
    word = {'start': start, 'end': end}
    word.update({'word': 'private'} if provider == 'groq' else {'text': 'private', 'type': 'word'})
    def respond(_request):
        return httpx.Response(200, content=json.dumps({'text': 'private', 'words': [word]}),
                              headers={'content-type': 'application/json', 'request-id': 'invalid-timing'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = (GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1')
                   if provider == 'groq' else ElevenLabs(client, api_key='key'))
        result = await adapter.transcribe(TranscriptionRequest(bytes(32000), 'en'))
    assert result.text == 'private'
    assert result.words is None
    assert result.receipt.request_id == 'invalid-timing'
    assert result.receipt.diagnostics['timing']['status'] == 'unavailable'


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
async def test_decodable_transcript_does_not_require_correct_mime_metadata(provider):
    def respond(_request):
        return httpx.Response(200, content=b'{"text":"Hello"}', headers={'content-type': 'text/plain'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = (GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1')
                   if provider == 'groq' else ElevenLabs(client, api_key='key'))
        result = await adapter.transcribe(TranscriptionRequest(bytes(32000), 'en'))
    assert result.text == 'Hello'
    assert result.words is None
    assert 'text/plain' in json.dumps(result.receipt.diagnostics)


@pytest.mark.asyncio
@pytest.mark.parametrize('provider,tag', [('groq', 'ga'), ('groq', 'gd'),
    ('elevenlabs', 'chr'), ('elevenlabs', 'gd'), ('elevenlabs', 'gd_invalid'), ('elevenlabs', 'CHR'), ('elevenlabs', '')])
async def test_unsupported_language_never_reaches_provider(provider, tag):
    def respond(_request):
        pytest.fail('Unsupported language must fail before submission')
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        adapter = (GroqTranscription(client, api_key='key', base_url='https://groq.invalid/v1')
                   if provider == 'groq' else ElevenLabs(client, api_key='key'))
        with pytest.raises(AudioFailure) as error:
            await adapter.transcribe(TranscriptionRequest(bytes(32000), tag))
    assert error.value.code == 'AUDIO_INPUT_INVALID'
    assert not error.value.unknown_outcome
