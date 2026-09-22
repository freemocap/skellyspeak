"""Optional word alignment must never gate a usable transcript.

Reject unusable timing as timing, retaining the original provider metadata in
its receipt. Do not fabricate corrected timestamps or discard transcript text.
"""
import math
from server.app.inference.audio_contracts import WordTiming


def decode_words(raw_words, duration, provider):
    if raw_words is None:
        return None, {'status': 'unavailable', 'reason': 'not_supplied'}
    path = 'words'
    try:
        if not isinstance(raw_words, list) or len(raw_words) > 20000:
            raise ValueError()
        words, previous = [], 0.0
        for index, word in enumerate(raw_words):
            path = f'words[{index}]'
            if provider == 'elevenlabs':
                if word.get('type') in {'spacing', 'audio_event'}:
                    continue
                if word.get('type') != 'word':
                    raise ValueError()
            start, end = word['start'], word['end']
            token = word['text' if provider == 'elevenlabs' else 'word']
            if (any(type(x) not in (int, float) or not math.isfinite(x) for x in (start, end))
                    or not previous <= start <= end <= duration
                    or not isinstance(token, str) or not token.strip() or '\0' in token):
                raise ValueError()
            words.append(WordTiming(token, start, end))
            previous = start
        return tuple(words), {'status': 'available'}
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return None, {'status': 'unavailable', 'reason': 'invalid_provider_timing',
                      'stage': 'transcription_timing', 'path': path,
                      'expected': 'ordered finite word intervals within recording duration'}
