"""Bounded character alignment; preserve original and normalized text separately."""
import math


def decode_alignment(value, duration):
    if value is None:
        return None, {'status': 'unavailable', 'reason': 'not_supplied'}
    try:
        chars = value['characters']
        starts = value['character_start_times_seconds']
        ends = value['character_end_times_seconds']
        if (not all(isinstance(v, list) for v in (chars, starts, ends))
                or not 0 < len(chars) <= 20000 or len(chars) != len(starts) or len(chars) != len(ends)
                or sum(len(c) for c in chars if isinstance(c, str)) > 20000):
            raise ValueError()
        previous = 0
        for text, start, end in zip(chars, starts, ends):
            if (not isinstance(text, str) or not text or '\0' in text
                    or any(type(t) not in (int, float) or not math.isfinite(t) for t in (start, end))
                    or not previous <= start <= end <= duration):
                raise ValueError()
            previous = start
        return {'characters': chars, 'starts': starts, 'ends': ends}, {'status': 'available'}
    except (KeyError, TypeError, ValueError):
        return None, {'status': 'unavailable', 'reason': 'invalid_provider_timing',
                      'stage': 'synthesis_alignment', 'expected': 'parallel character arrays with ordered finite intervals within audio duration'}
