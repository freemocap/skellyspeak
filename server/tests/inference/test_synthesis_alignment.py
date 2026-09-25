import pytest
from server.app.inference.synthesis_alignment import decode_alignment


@pytest.mark.parametrize('text', ['café', 'cafe\u0301', 'مرحبا', '你好', 'नमस्ते'])
def test_preserves_every_character_and_its_timing(text):
    source = {'characters': list(text), 'character_start_times_seconds': [0.1] * len(text),
              'character_end_times_seconds': [0.8] * len(text)}
    result, status = decode_alignment(source, 1)
    assert status == {'status': 'available'}
    assert ''.join(result['characters']) == text
    assert result['starts'] == source['character_start_times_seconds']
    assert result['ends'] == source['character_end_times_seconds']


@pytest.mark.parametrize('change', [
    {'characters': []}, {'characters': ['a', 'b']}, {'character_start_times_seconds': [float('nan')]},
    {'character_end_times_seconds': [1.1]}, {'character_start_times_seconds': [-0.1]},
    {'character_end_times_seconds': [True]}, {'characters': ['\0']},
])
def test_rejected_alignment_has_an_explicit_reason(change):
    source = {'characters': ['a'], 'character_start_times_seconds': [0], 'character_end_times_seconds': [0.5], **change}
    result, status = decode_alignment(source, 1)
    assert result is None
    assert status['reason'] == 'invalid_provider_timing'


def test_absent_timing_is_distinct_from_invalid_timing():
    assert decode_alignment(None, 1)[1]['reason'] == 'not_supplied'
    assert decode_alignment({}, 1)[1]['reason'] == 'invalid_provider_timing'
