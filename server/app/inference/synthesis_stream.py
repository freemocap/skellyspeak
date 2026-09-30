"""Bounded timestamp-stream decoding, independent of HTTP and spending."""
import base64
import binascii
import json

from server.app.inference.audio_contracts import AudioFailure
from server.app.inference.synthesis_alignment import decode_alignment
from server.app.diagnostics import provider_errors

FRAME_LIMIT = 512 * 1024
FRAME_COUNT = 4096
RATE = 24_000


class SynthesisStream:
    def __init__(self, source, limit, emit):
        self.source = source
        self.limit = limit
        self.emit = emit
        self.pending = bytearray()
        self.pcm = bytearray()
        self.frames = 0
        self.receipt = None
        self.timings = {key: {'characters': [], 'starts': [], 'ends': []}
                        for key in ('original', 'normalized')}
        self.status = {key: {'status': 'unavailable', 'reason': 'not_supplied'} for key in self.timings}
        self.metadata = []

    def fail(self, stage, details=None):
        raise AudioFailure('AUDIO_RESPONSE_INVALID', receipt=self.receipt,
            unknown_outcome=True, diagnostics={'stage': stage,
                'received_frames': self.frames, 'received_samples': len(self.pcm) // 2,
                'response': self.diagnostics(), **(details or {})})

    def diagnostics(self):
        return {'http': self.receipt.diagnostics if self.receipt else None,
                'alignment': self.status, 'chunks': self.metadata,
                'omitted_chunks': max(0, self.frames - len(self.metadata))}

    async def feed(self, data, receipt):
        self.receipt = receipt
        # Process framing before appending: a network read can contain many lines.
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
        except json.JSONDecodeError as error:
            self.fail('speech_stream_json', {'line': error.lineno, 'column': error.colno,
                                            'offset': error.pos, 'reason': error.msg})
        except (UnicodeError, RecursionError) as error:
            self.fail('speech_stream_json', {'exception_type': type(error).__name__})
        if len(self.metadata) < 32:
            self.metadata.append(provider_errors.sanitize(value))
        try:
            pcm = base64.b64decode(value['audio_base64'], validate=True)
            if not pcm or len(pcm) % 2 or len(self.pcm) + len(pcm) > self.limit:
                raise ValueError()
        except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError):
            self.fail('speech_stream_audio')
        offset = len(self.pcm) // 2
        duration = len(pcm) / (RATE * 2)
        alignment = {'sourceText': self.source}
        for key, field in [('original', 'alignment'), ('normalized', 'normalized_alignment')]:
            raw_timing = value.get(field)
            alignment[key] = None
            # Audio frame boundaries need not coincide with text boundaries. Missing
            # timing in a frame adds no words; it does not revoke earlier words.
            if raw_timing is None:
                continue
            # The source timestamps use the recording clock, not the audio frame's
            # clock. They may describe audio delivered by a later frame.
            timing, status = decode_alignment(raw_timing, self.limit / (RATE * 2))
            if timing is None:
                self.status[key] = status
                continue
            target = self.timings[key]
            if target['starts'] and timing['starts'][0] < target['starts'][-1]:
                self.status[key] = {'status': 'unavailable', 'reason': 'unordered_stream_timing'}
                continue
            if sum(map(len, target['characters'])) + sum(map(len, timing['characters'])) > 20000:
                self.fail('speech_stream_alignment_limit')
            target['characters'].extend(timing['characters'])
            target['starts'].extend(timing['starts'])
            target['ends'].extend(timing['ends'])
            if self.status[key].get('reason') == 'not_supplied':
                self.status[key] = {'status': 'available'}
            # The app wire uses frame-relative timing. Only emit a frame projection
            # when all its intervals fit; retain the complete recording projection
            # regardless, and validate it against final audio length in finish().
            start = offset / RATE
            if (self.status[key]['status'] == 'available'
                    and timing['starts'][0] >= start
                    and max(timing['ends']) <= start + duration):
                alignment[key] = {'characters': timing['characters'],
                                  'starts': [t - start for t in timing['starts']],
                                  'ends': [t - start for t in timing['ends']]}
        self.pcm.extend(pcm)
        await self.emit({'sample_offset': offset, 'audio_base64': base64.b64encode(pcm).decode(),
                         'alignment': alignment, 'receipt': {
                             'request_id': self.receipt.request_id,
                             'requested_model': self.receipt.requested_model,
                             'diagnostics': self.receipt.diagnostics}})

    async def finish(self):
        await self.line()
        if not self.pcm:
            self.fail('speech_stream_empty')
        duration = len(self.pcm) / (RATE * 2)
        for key, timing in self.timings.items():
            if timing['ends'] and max(timing['ends']) > duration:
                self.status[key] = {'status': 'unavailable', 'reason': 'timing_exceeds_audio_duration'}
        return {'sourceText': self.source,
                **{key: self.timings[key] if self.status[key]['status'] == 'available' else None
                   for key in self.timings}}
