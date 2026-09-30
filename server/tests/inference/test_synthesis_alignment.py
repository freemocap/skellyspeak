"""Timing validity belongs to native; transport must not discard original fields."""
import pytest
from server.app.inference.relay_payload import for_client

@pytest.mark.parametrize('alignment', [None, {}, {'characters':['café','cafe\u0301','مرحبا','你好','नमस्ते'],
    'character_start_times_seconds':[0,1,2,3,4], 'character_end_times_seconds':[1,2,3,4,100]},
    {'characters':['a'], 'character_start_times_seconds':[True], 'character_end_times_seconds':[-1]}])
def test_raw_timing_survives(alignment):
    value = {'audio_base64':'AAA=', 'alignment':alignment, 'normalized_alignment':None}
    assert for_client(value) == value
