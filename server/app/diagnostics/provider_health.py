"""Authenticated provider credential probes. No prompts, audio, or inference charges."""
import asyncio
import json
import time

import httpx

from server.app.diagnostics import provider_errors, runtime


async def probe(client, provider, base_url, key):
    started = time.monotonic()
    status = None
    state = 'unreachable'
    try:
        async with asyncio.timeout(10):
            async with client.stream('GET', base_url.rstrip('/') + ('/key' if provider == 'OPENROUTER' else '/models'),
                                     headers={'Authorization': f'Bearer {key}'}, follow_redirects=False) as response:
                status = response.status_code
                if not response.is_success:
                    state = 'rejected'
                    await provider_errors.capture(response, provider, {'key': key})
                else:
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(body) + len(chunk) > 262144:
                            raise ValueError('response limit')
                        body.extend(chunk)
                    data = json.loads(body)
                    valid = isinstance(data, dict) and isinstance(data.get('data'), dict if provider == 'OPENROUTER' else list)
                    state = 'accepted' if valid else 'invalid_response'
    except (httpx.HTTPError, TimeoutError):
        state = 'unreachable'
    except (ValueError, UnicodeError, RecursionError):
        state = 'invalid_response'
    duration = round((time.monotonic() - started) * 1000)
    runtime.emit('provider_credential_checked', provider=provider, status=status, duration_ms=duration, credential_state=state)
    return {'provider': provider, 'state': state, 'status': status, 'durationMs': duration}


async def check(config):
    async with httpx.AsyncClient(timeout=10) as client:
        return list(await asyncio.gather(
            probe(client, 'OPENROUTER', config.openrouter_base_url, config.openrouter_key),
            probe(client, 'GROQ', config.groq_base_url, config.groq_key),
        ))
