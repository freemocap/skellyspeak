"""Groq file-transcription adapter. One bounded request; normalized audio result.

[@groq_transcription_api] Provider fields, auth and response decoding stay here.
"""
import asyncio
import io
import json
import re
import wave

import httpx

from server.app.inference.transcription_confidence import summarize
from server.app.inference.transcription_languages import WHISPER_MODELS, whisper_code, primary_code
from server.app.diagnostics import provider_errors
from server.app.diagnostics.exceptions import describe
from server.app.inference.transcription_timing import decode_words
from server.app.inference.audio_contracts import AudioFailure, AudioReceipt, TranscriptionRequest, TranscriptionResult


class GroqTranscription:
    def __init__(self, client, *, api_key, base_url, model="whisper-large-v3"):
        self.client, self.key, self.base_url = client, api_key, base_url.rstrip('/')
        self.model = model

    async def transcribe(self, source: TranscriptionRequest) -> TranscriptionResult:
        receipt = AudioReceipt('groq', self.model)
        duration = len(source.pcm) / 32000
        language = transcription_language(source.language_tag, model=self.model)
        if (not self.model or language is None
                or len(source.pcm) % 2 or not .1 <= duration <= 120):
            raise AudioFailure('AUDIO_INPUT_INVALID', receipt=receipt, unknown_outcome=False)
        output = io.BytesIO()
        with wave.open(output, 'wb') as writer:
            writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(16000)
            writer.writeframes(source.pcm)
        fields = {'model': self.model, 'language': language,
                  'response_format': 'verbose_json', 'timestamp_granularities[]': ['word', 'segment']}
        # Context is provider-neutral preceding speech, never an instruction to correct it.
        if source.context:
            fields['prompt'] = (source.language_tag + '\n' + source.context).encode('utf-8')[:224].decode('utf-8', errors='ignore')
        try:
            async with asyncio.timeout(60):
                request = self.client.build_request('POST', self.base_url + '/audio/transcriptions',
                    data=fields, files={'file': ('audio.wav', output.getvalue(), 'audio/wav')})
                for name in list(request.headers):
                    if name not in {'host', 'content-type', 'content-length', 'transfer-encoding'}:
                        del request.headers[name]
                request.headers['authorization'] = 'Bearer ' + self.key
                response = await self.client.send(request, stream=True, auth=None, follow_redirects=False)
                try:
                    request_id = response.headers.get('x-request-id') or response.headers.get('request-id')
                    if request_id and not re.fullmatch(r'[A-Za-z0-9_-]{1,256}', request_id):
                        request_id = None
                    receipt = AudioReceipt('groq', self.model, request_id,
                        diagnostics={'status': response.status_code, 'response_headers': provider_errors.response_headers(response)})
                    if not response.is_success:
                        detail = await provider_errors.capture(response, 'GROQ', {'key': self.key, 'request': fields})
                        raise AudioFailure('AUDIO_PROVIDER_HTTP', receipt=receipt, status=response.status_code,
                            unknown_outcome=response.status_code >= 500, diagnostics=detail)
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 1_048_576:
                            raise AudioFailure('AUDIO_RESPONSE_LIMIT', receipt=receipt, unknown_outcome=True,
                                diagnostics={'stage': 'response_body', 'truncated': True, 'limit_bytes': 1_048_576, 'http': receipt.diagnostics})
                        body.extend(chunk)
                    return decode(bytes(body), duration, receipt)
                finally:
                    await response.aclose()
        except (httpx.HTTPError, TimeoutError) as error:
            raise AudioFailure('AUDIO_TRANSPORT_UNKNOWN', receipt=receipt, unknown_outcome=True,
                diagnostics={'stage': 'transport', 'http': receipt.diagnostics,
                    'exception': describe(error, private=(self.key, source.context, self.base_url), include_message=True)}) from None


def transcription_language(tag, *, model="whisper-large-v3"):
    if model in WHISPER_MODELS:
        return whisper_code(tag)
    # Unknown custom models retain provider-side validation.
    return primary_code(tag)


def decode(body, duration, receipt):
    value, path = None, '$'
    try:
        value = json.loads(body)
        if not isinstance(value, dict): raise ValueError()
        path = 'text'
        text = value['text']
        if not isinstance(text, str) or len(text) > 20000 or '\0' in text: raise ValueError()
        words, timing = decode_words(value.get('words'), duration, 'groq')
        # Detected language/confidence are provider metadata, not text validity.
        receipt = AudioReceipt(receipt.provider, receipt.requested_model, receipt.request_id, receipt.cost_micros,
            {'http': receipt.diagnostics, 'response': provider_errors.sanitize(value),
             'timing': timing, 'transcription_confidence': summarize(value, 'groq')})
        return TranscriptionResult(text, duration, words, receipt)
    except (ValueError, TypeError, KeyError, UnicodeError, OverflowError):
        raise AudioFailure('AUDIO_RESPONSE_INVALID', receipt=receipt, unknown_outcome=True,
            diagnostics={'stage': 'transcription_validation', 'path': path, 'expected': 'string transcript text, at most 20000 characters, without NUL',
                'response': provider_errors.sanitize(value), 'http': receipt.diagnostics}) from None
