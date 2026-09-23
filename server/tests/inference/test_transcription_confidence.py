import json
import math

import pytest

from server.app.inference.transcription_confidence import summarize
from server.app.inference.audio_contracts import AudioReceipt
from server.app.inference.groq_transcription import decode
from server.app.inference.elevenlabs import _transcript


@pytest.mark.parametrize('provider', ['groq', 'elevenlabs'])
def test_summary_survives_long_responses_without_content(provider):
    field = 'avg_logprob' if provider == 'groq' else 'logprob'
    key = 'segments' if provider == 'groq' else 'words'
    rows = [{'text': 'private word', 'type': 'word', field: math.log(.8), 'no_speech_prob': .1} for _ in range(100)]
    summary = summarize({key: rows, 'language_probability': .99}, provider)
    assert summary['score'] == pytest.approx(.8)
    assert summary['complete'] is True
    assert summary['count'] == 100
    assert 'private' not in json.dumps(summary)
    rows[-1][field] = None
    assert summarize({key: rows}, provider)['score'] is None


def test_language_probability_is_not_recognition_confidence():
    assert summarize({'language_probability': 1.0}, 'elevenlabs')['score'] is None
    assert summarize({'words': [{'type': 'spacing', 'logprob': 0}]}, 'elevenlabs')['score'] is None
    for invalid in [True, '0', float('nan'), float('inf'), 1]:
        assert summarize({'segments': [{'avg_logprob': invalid}]}, 'groq')['score'] is None


@pytest.mark.parametrize('provider,decoder', [('groq', decode), ('elevenlabs', _transcript)])
def test_adapters_retain_confidence_and_original_text(provider, decoder):
    raw = {'text': 'private transcript', 'segments': [{'avg_logprob': -2, 'no_speech_prob': .9}],
           'words': [{'text': 'private transcript', 'type': 'word', 'start': 0, 'end': .5, 'logprob': -2}]}
    result = decoder(json.dumps(raw).encode(), 1, AudioReceipt(provider, 'fixture', 'req-1'))
    assert result.text == raw['text']
    assert result.receipt.diagnostics['transcription_confidence']['score'] == pytest.approx(math.exp(-2))
    assert result.receipt.request_id == 'req-1'
    assert 'private transcript' not in json.dumps(result.receipt.diagnostics)
