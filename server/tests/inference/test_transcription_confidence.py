"""Confidence evidence is passed through in full, not summarized by the relay."""
from server.app.inference.relay_payload import for_client

def test_long_confidence_evidence_preserved():
    value = {'text':'private transcript', 'segments':[
        {'text':'private word', 'avg_logprob':-.2, 'no_speech_prob':.1} for _ in range(100)],
        'language_probability':.99}
    assert for_client(value) == value
