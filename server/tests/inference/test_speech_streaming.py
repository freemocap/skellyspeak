"""Streaming speech contract and cancellation; synthetic audio, no paid calls."""
import asyncio
import base64
from dataclasses import replace
import json

import httpx
import pytest

from server.app import main
from server.app.inference import audio_service, speech_streaming
from server.app.inference.audio_contracts import AudioFailure, AudioReceipt, SynthesisRequest
from server.app.inference.elevenlabs import ElevenLabs
from server.app.inference.synthesis_stream import SynthesisStream
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.accounting.test_budget import ledger

SOURCE = SynthesisRequest('eleven_v3', 'fixtureVoice', '你好', 'zh')
KEY = 'fixture-secret'


def frame(text='你', pcm=b'\0\0' * 2400, start=0):
    timing = {'characters': [text], 'character_start_times_seconds': [start],
              'character_end_times_seconds': [start + 0.1]}
    return json.dumps({'audio_base64': base64.b64encode(pcm).decode(),
        'alignment': timing, 'normalized_alignment': timing}, ensure_ascii=False).encode() + b'\n'


class DelayedAudio(httpx.AsyncByteStream):
    def __init__(self):
        self.release = asyncio.Event()
        self.closed = False

    async def __aiter__(self):
        first = frame()
        # Split inside the UTF-8 source, independent of JSON framing.
        for i in range(0, len(first), 7):
            yield first[i:i + 7]
        await self.release.wait()
        yield frame('好', start=0.1)

    async def aclose(self):
        self.closed = True


@pytest.mark.asyncio
async def test_wire_audio_arrives_before_upstream_completion():
    audio = DelayedAudio()

    def respond(request):
        assert request.url.path.endswith('/stream/with-timestamps')
        assert request.url.params['output_format'] == 'pcm_24000'
        assert json.loads(request.content)['text'] == SOURCE.text
        return httpx.Response(200, stream=audio, headers={'content-type': 'application/json', 'request-id': 'receipt-1'})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        async def execute(emit):
            result = await ElevenLabs(client, api_key=KEY).synthesize(SOURCE, on_audio=emit)
            return result, {'request_id': result.receipt.request_id}

        wire = speech_streaming.response(execute, asyncio.Semaphore(1), (KEY, SOURCE.text)).body_iterator
        assert json.loads(await anext(wire))['type'] == 'start'
        first = json.loads(await asyncio.wait_for(anext(wire), 1))
        assert first['type'] == 'audio' and first['seq'] == 1
        assert first['response'] == json.loads(frame())
        assert first['receipt']['request_id'] == 'receipt-1'
        assert not audio.closed and not audio.release.is_set()
        audio.release.set()
        second = json.loads(await anext(wire))
        assert second['response'] == json.loads(frame('好', start=0.1))
        done = json.loads(await anext(wire))
        assert done['type'] == 'complete' and done['seq'] == 3
        assert 'alignment' not in done and 'total_samples' not in done
        with pytest.raises(StopAsyncIteration):
            await anext(wire)
        assert audio.closed


@pytest.mark.asyncio
async def test_disconnect_releases_upstream_and_slot_even_if_settlement_raises():
    audio = DelayedAudio()
    slots = asyncio.Semaphore(1)
    settled = []
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
        200, stream=audio, headers={'content-type': 'application/json'})))

    async def execute(emit):
        try:
            await ElevenLabs(client, api_key=KEY).synthesize(SOURCE, on_audio=emit)
        finally:
            settled.append('unknown')
            raise RuntimeError('Settlement reported an unknown outcome')

    try:
        wire = speech_streaming.response(execute, slots, ()).body_iterator
        await anext(wire)
        await anext(wire)
        await asyncio.wait_for(wire.aclose(), 1)
        assert audio.closed and not slots.locked() and settled == ['unknown']
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_disconnect_settles_submitted_work_as_unknown_with_partial_identity(monkeypatch):
    audio = DelayedAudio()
    upstream(monkeypatch, lambda _: httpx.Response(200, stream=audio,
        headers={'content-type': 'application/json', 'request-id': 'cancelled-receipt'}))
    reservations, settlements = [], []
    slots = asyncio.Semaphore(1)

    def reserve(_who, amount):
        reservations.append(amount)
        return 'reservation'

    async def settle(_reservation, **values):
        settlements.append(values)
        if values['raise_unknown']:
            raise RuntimeError('Unknown usage')

    async def execute(emit):
        progress = {}

        async def forward(chunk):
            progress.update(chunk['receipt'])
            await emit(chunk)

        result = await audio_service._execute(None, reserve, settle, 20,
            lambda adapter: adapter.synthesize(SOURCE, on_audio=forward),
            provider='fixture', label='Speech', create=lambda client: ElevenLabs(client, api_key=KEY),
            raise_cancelled_unknown=True, progress=progress)
        return result, {}

    wire = speech_streaming.response(execute, slots, (KEY, SOURCE.text)).body_iterator
    await anext(wire)
    await anext(wire)
    await asyncio.wait_for(wire.aclose(), 1)
    assert reservations == [20] and len(settlements) == 1
    assert settlements[0]['cost'] is None
    assert settlements[0]['provider_id'] == 'cancelled-receipt'
    assert settlements[0]['raise_unknown'] is True
    assert audio.closed and not slots.locked()


@pytest.mark.asyncio
@pytest.mark.parametrize('bad', [b'not json\n', b'[]\n'])
async def test_invalid_tail_never_completes_or_loses_partial_receipt(bad):
    received = []

    async def emit(value):
        received.append(value)

    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(
        200, content=frame() + bad, headers={'content-type': 'application/json', 'request-id': 'partial-1'}))) as client:
        with pytest.raises(AudioFailure) as failure:
            await ElevenLabs(client, api_key=KEY).synthesize(SOURCE, on_audio=emit)
    assert len(received) == 1
    assert failure.value.receipt.request_id == 'partial-1'
    assert failure.value.diagnostics['received_frames'] == 2
    assert KEY not in json.dumps(failure.value.diagnostics)


@pytest.mark.asyncio
async def test_frame_limit_and_missing_timing_are_explicit():
    received = []

    async def emit(value):
        received.append(value)

    decoder = SynthesisStream(emit)
    receipt = AudioReceipt('fixture', 'model', 'id')
    value = json.loads(frame())
    value['alignment'] = None
    await decoder.feed(json.dumps(value).encode(), receipt)
    await decoder.finish()
    assert received[0]['response'] == value
    with pytest.raises(AudioFailure):
        await decoder.feed(b'x' * (512 * 1024 + 1), receipt)


@pytest.mark.asyncio
async def test_route_streams_and_settles_once(proxy, ledger, monkeypatch):
    monkeypatch.setattr(main, 'CFG', replace(main.CFG, elevenlabs_key=KEY, elevenlabs_voice_id='fixtureVoice'))
    upstream(monkeypatch, lambda _: httpx.Response(200, content=frame() + frame('好', start=0.1),
        headers={'content-type': 'application/json', 'request-id': 'stream-receipt'}))
    response = await proxy.post('/v1/audio/speech', headers={'accept': speech_streaming.MEDIA_TYPE},
        json={'language_code': 'zh', 'model': 'eleven_v3', 'text': '你好'})
    assert response.status_code == 200, response.text
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [event['type'] for event in events] == ['start', 'audio', 'audio', 'complete']
    assert events[-1]['usage']['request_id'] == 'stream-receipt'
    assert events[-1]['usage']['cost_micros'] is None
    rows = [v for k, v in ledger.store.items() if '/reservations/' in k]
    assert len(rows) == 1 and rows[0]['status'] == 'settled'


@pytest.mark.asyncio
async def test_route_partial_failure_preserves_unknown_charge(proxy, ledger, monkeypatch):
    monkeypatch.setattr(main, 'CFG', replace(main.CFG, elevenlabs_key=KEY, elevenlabs_voice_id='fixtureVoice'))
    upstream(monkeypatch, lambda _: httpx.Response(200, content=frame() + b'bad\n',
        headers={'content-type': 'application/json', 'request-id': 'failed-receipt'}))
    response = await proxy.post('/v1/audio/speech', headers={'accept': speech_streaming.MEDIA_TYPE},
        json={'language_code': 'zh', 'model': 'eleven_v3', 'text': '你好'})
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [event['type'] for event in events] == ['start', 'audio', 'error']
    assert 'failed-receipt' in json.dumps(events[-1])
    assert KEY not in json.dumps(events[-1])
    assert SOURCE.text not in json.dumps(events[-1], ensure_ascii=False)
    rows = [v for k, v in ledger.store.items() if '/reservations/' in k]
    assert len(rows) == 1 and rows[0]['status'] == 'unknown'


@pytest.mark.asyncio
async def test_audio_only_frames_preserve_recording_timestamps_and_final_words():
    received = []
    async def emit(value):
        received.append(value)
    decoder = SynthesisStream(emit)
    receipt = AudioReceipt('fixture', 'model', 'id')
    first = json.loads(frame('one ', start=0))
    second = json.loads(frame('two', start=0.1))
    # Timing arrives ahead of its audio, followed by an audio-only tail.
    second['alignment']['character_end_times_seconds'] = [0.3]
    second['normalized_alignment']['character_end_times_seconds'] = [0.3]
    tail = json.loads(frame())
    tail['alignment'] = tail['normalized_alignment'] = None
    for value in [first, second, tail]:
        await decoder.feed(json.dumps(value).encode() + b'\n', receipt)
    await decoder.finish()
    assert [v['response'] for v in received] == [first, second, tail]
