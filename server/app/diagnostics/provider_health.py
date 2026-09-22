"""Authenticated provider credential probes. No prompts, audio, or inference charges."""
from server.app.diagnostics.exceptions import DiagnosticValueError
import asyncio
import json
import time

import httpx

from server.app.diagnostics import provider_errors, runtime
from server.app.diagnostics.exceptions import describe


async def probe(client, provider, base_url, key):
    started = time.monotonic()
    status = None
    state = 'unreachable'
    diagnostics = None
    try:
        async with asyncio.timeout(10):
            async with client.stream('GET', base_url.rstrip('/') + ('/key' if provider == 'OPENROUTER' else '/models'),
                                     headers=({'xi-api-key': key} if provider == 'ELEVENLABS' else {'Authorization': f'Bearer {key}'}), follow_redirects=False) as response:
                status = response.status_code
                if not response.is_success:
                    state = 'rejected'
                    diagnostics = await provider_errors.capture(response, provider, {'key': key})
                else:
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 262144:
                            raise DiagnosticValueError('response limit')
                        body.extend(chunk)
                    data = json.loads(body)
                    valid = isinstance(data, list) if provider == 'ELEVENLABS' else isinstance(data, dict) and isinstance(data.get('data'), dict if provider == 'OPENROUTER' else list)
                    state = 'accepted' if valid else 'invalid_response'
                    if not valid:
                        diagnostics = {'stage': 'credential_response', 'path': '$' if provider == 'ELEVENLABS' else '$.data',
                                       'expected': 'array' if provider != 'OPENROUTER' else 'object'}
    except (httpx.HTTPError, TimeoutError) as error:
        state = 'unreachable'
        diagnostics = describe(error, private=(key, base_url), include_message=True)
    except (ValueError, UnicodeError, RecursionError) as error:
        state = 'invalid_response'
        diagnostics = describe(error)
        if isinstance(error, json.JSONDecodeError):
            diagnostics.update(line=error.lineno, column=error.colno, reason=error.msg)
    duration = round((time.monotonic() - started) * 1000)
    runtime.emit('provider_credential_checked', provider=provider, status=status, duration_ms=duration, credential_state=state, diagnostics=diagnostics)
    return {'provider': provider, 'state': state, 'status': status, 'durationMs': duration, 'diagnostics': diagnostics}


async def check(config):
    async with httpx.AsyncClient(timeout=10) as client:
        checks = [probe(client, 'OPENROUTER', config.openrouter_base_url, config.openrouter_key)]
        if config.groq_key:
            checks.append(probe(client, 'GROQ', config.groq_base_url, config.groq_key))
        if config.elevenlabs_key:
            checks.append(probe(client, 'ELEVENLABS', 'https://api.elevenlabs.io/v1', config.elevenlabs_key))
        return list(await asyncio.gather(*checks))
