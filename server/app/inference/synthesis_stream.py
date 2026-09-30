"""Bounded provider JSON framing. Native code owns audio and timing interpretation."""
import json

from server.app.inference.audio_contracts import AudioFailure
from server.app.inference.relay_payload import for_client

FRAME_LIMIT = 512 * 1024
FRAME_COUNT = 4096


class SynthesisStream:
    def __init__(self, emit, secrets=()):
        self.emit = emit
        self.secrets = secrets
        self.pending = bytearray()
        self.frames = 0
        self.receipt = None

    def fail(self, stage):
        raise AudioFailure('AUDIO_RESPONSE_INVALID', receipt=self.receipt,
            unknown_outcome=True, diagnostics={'stage': stage, 'received_frames': self.frames,
                                               'response': self.receipt.diagnostics})

    async def feed(self, data, receipt):
        self.receipt = receipt
        for index, piece in enumerate(data.split(b'\n')):
            if index:
                await self.line()
            if len(self.pending) + len(piece) > FRAME_LIMIT:
                self.fail('speech_stream_frame_limit')
            self.pending.extend(piece)

    async def line(self):
        raw = bytes(self.pending).strip()
        self.pending.clear()
        if not raw:
            return
        self.frames += 1
        if self.frames > FRAME_COUNT:
            self.fail('speech_stream_frame_count')
        try:
            value = json.loads(raw)
            if not isinstance(value, dict):
                raise ValueError()
            value = for_client(value, self.secrets, limit=FRAME_LIMIT)
        except (ValueError, UnicodeError, RecursionError):
            self.fail('speech_stream_json')
        await self.emit({'response': value, 'receipt': {
            'request_id': self.receipt.request_id,
            'requested_model': self.receipt.requested_model,
            'diagnostics': self.receipt.diagnostics}})

    async def finish(self):
        await self.line()
        if not self.frames:
            self.fail('speech_stream_empty')
