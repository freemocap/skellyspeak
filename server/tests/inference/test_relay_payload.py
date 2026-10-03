"""Content relay and diagnostic redaction are separate security boundaries."""
import json
import pytest
from server.app.inference.relay_payload import for_client
from server.app.diagnostics.provider_errors import sanitize


def test_preserves_content_and_unknown_fields_but_never_credentials():
    raw = {'choices':[{'delta':{'role':'assistant','content':'private response'}}],
           'usage':{'total_tokens':12}, 'unrecognized':{'number':1,'string':'private metadata'},
           'api_key':'server-secret', 'echo':'contains server-secret', 'server-secret':'value'}
    result = for_client(raw, ('server-secret',))
    assert result['choices'] == raw['choices']
    assert result['usage'] == raw['usage']
    assert result['unrecognized'] == raw['unrecognized']
    assert 'server-secret' not in json.dumps(result)
    diagnostic = json.dumps(sanitize(raw, ('server-secret','private response','private metadata')))
    assert all(s not in diagnostic for s in ['server-secret','private response','private metadata'])

@pytest.mark.parametrize('value', [{'number':float('nan')}, {'text':'x'*200}])
def test_bounds_fail_explicitly(value):
    with pytest.raises(ValueError):
        for_client(value,limit=100)

def test_depth_is_bounded():
    value = {}
    for _ in range(66): value = {'next':value}
    with pytest.raises(ValueError): for_client(value)

def test_error_logs_remove_content_echoes_and_keep_reason_and_usage(caplog):
    from server.app.diagnostics.provider_errors import record
    import logging
    caplog.set_level(logging.INFO, logger='skellyspeak.runtime')
    record('fixture', 200, {'text':'private generated text',
        'error':{'code':'partial_failure', 'message':'Invalid result: private generated text'},
        'usage':{'total_tokens':12}})
    assert 'private generated text' not in caplog.text
    event = json.loads(caplog.records[-1].message)
    assert event['response_body']['error']['code'] == 'partial_failure'
    assert 'Invalid result:' in event['response_body']['error']['message']
    assert event['response_body']['usage']['total_tokens'] == 12
