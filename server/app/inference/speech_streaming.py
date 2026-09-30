"""Opt-in speech delivery; completed results alone establish successful synthesis."""
import asyncio
import contextlib
import json

from fastapi.responses import StreamingResponse

from server.app.diagnostics.exceptions import describe
from server.app.diagnostics.provider_errors import sanitize

MEDIA_TYPE = 'application/x-ndjson'


def response(execute, slots, private):
    async def body():
        queue = asyncio.Queue(maxsize=2)
        sequence = 0

        async def emit(value):
            nonlocal sequence
            record = {'version': 2, 'seq': sequence, **value}
            sequence += 1
            await queue.put((json.dumps(record, ensure_ascii=True, allow_nan=False) + '\n').encode())

        async def produce():
            try:
                async with slots:
                    await emit({'type': 'start', 'format': 'pcm_s16le', 'sample_rate': 24000, 'channels': 1})
                    result, usage = await execute(lambda chunk: emit({'type': 'audio', **chunk}))
                    await emit({'type': 'complete', 'total_samples': round(result.duration_seconds * 24000),
                                'alignment': result.alignment, 'usage': usage})
            except Exception as error:
                if asyncio.current_task().cancelling():
                    raise asyncio.CancelledError() from error
                details = describe(error, private=private)
                await emit({'type': 'error', 'code': getattr(error, 'code', 'SPEECH_STREAM_FAILED'),
                            'status': getattr(error, 'status_code', None),
                            'message': 'Speech generation did not complete.',
                            'provider_error': sanitize(getattr(error, 'provider_error', None), private),
                            'diagnostics': sanitize(getattr(error, 'diagnostics', None), private),
                            'exception': details})
            finally:
                # Cancellation must not wait on a full delivery queue.
                if not asyncio.current_task().cancelling():
                    await queue.put(None)

        task = asyncio.create_task(produce())
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    return StreamingResponse(body(), media_type=MEDIA_TYPE,
                             headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
