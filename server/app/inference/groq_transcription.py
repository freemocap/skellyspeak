"""Groq file-transcription adapter. One bounded request; unaltered JSON response.

[@groq_transcription_api] Provider fields, auth and response decoding stay here.
"""
import asyncio
import json
import re

import httpx

from server.app.diagnostics import provider_errors
from server.app.diagnostics.exceptions import describe
from server.app.inference.relay_payload import for_client
from server.app.inference.audio_contracts import AudioFailure, AudioReceipt, TranscriptionRequest, AudioResult


class GroqTranscription:
    def __init__(self, client, *, api_key, base_url, model="whisper-large-v3"):
        self.client, self.key, self.base_url = client, api_key, base_url.rstrip('/')
        self.model = model

    async def transcribe(self, source: TranscriptionRequest) -> AudioResult:
        receipt = AudioReceipt('groq', self.model)
        fields = {**source.fields, 'model': self.model, 'language': source.language_tag}
        try:
            async with asyncio.timeout(60):
                request = self.client.build_request('POST', self.base_url + '/audio/transcriptions',
                    data=fields, files={'file': ('audio.wav', source.wav, 'audio/wav')})
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
                    try:
                        value = json.loads(body)
                        if not isinstance(value, dict):
                            raise ValueError()
                        return AudioResult(for_client(value, (self.key,)), receipt)
                    except (ValueError, UnicodeError, RecursionError):
                        raise AudioFailure('AUDIO_RESPONSE_INVALID', receipt=receipt, unknown_outcome=True,
                            diagnostics={'stage':'provider_json', 'http':receipt.diagnostics}) from None
                finally:
                    await response.aclose()
        except (httpx.HTTPError, TimeoutError) as error:
            raise AudioFailure('AUDIO_TRANSPORT_UNKNOWN', receipt=receipt, unknown_outcome=True,
                diagnostics={'stage': 'transport', 'http': receipt.diagnostics,
                    'exception': describe(error, private=(self.key, source.fields.get("prompt", ""), self.base_url), include_message=True)}) from None
