"""Bounded, content-free confidence evidence, before raw metadata truncation.

[@groq_transcription_confidence] [@elevenlabs_transcription_confidence]
These are model likelihoods, not calibrated probabilities of correctness.
Language detection probability is deliberately not transcript confidence.
"""
import math


def summarize(value, provider):
    rows = value.get('segments') if provider == 'groq' else value.get('words')
    field = 'avg_logprob' if provider == 'groq' else 'logprob'
    source = 'segment_logprobs' if provider == 'groq' else 'word_logprobs'
    if not isinstance(rows, list) or not rows or len(rows) > 10000:
        return {'score': None, 'source': source, 'complete': False, 'count': 0, 'no_speech_probability': None}
    invalid_rows = any(not isinstance(row, dict) for row in rows)
    if provider == 'elevenlabs':
        invalid_rows = invalid_rows or any(isinstance(row, dict) and row.get('type') not in {'word', 'spacing', 'audio_event'} for row in rows)
        rows = [row for row in rows if isinstance(row, dict) and row.get('type') == 'word']
    logs = [row.get(field) if isinstance(row, dict) else None for row in rows]
    valid = lambda x: type(x) in (float, int) and math.isfinite(x)
    complete = not invalid_rows and bool(logs) and all(valid(x) and x <= 0 for x in logs)
    silence = [row.get('no_speech_prob') for row in rows if isinstance(row, dict)] if provider == 'groq' else []
    silence = [x for x in silence if valid(x) and 0 <= x <= 1]
    return {'score': math.exp(sum(logs) / len(logs)) if complete else None,
            'source': source, 'complete': complete, 'count': len(logs),
            'no_speech_probability': max(silence) if silence else None}
