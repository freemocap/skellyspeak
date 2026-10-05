"""Combined native assessments pass through bounded service admission."""
from pathlib import Path
from copy import deepcopy
import json
import pytest
from fastapi import HTTPException
from server.app.inference import decisions, grouped


def request():
    return json.loads((Path(__file__).parent / 'fixtures/jev-native-request.json').read_text(encoding='utf-8'))


def test_combined_assessment_passes_grouped_admission_with_usage_reservation():
    body = request()
    assert len(body['questions']) == 10
    assert {'grammar', 'understandability'} <= body['questions'].keys()
    result = decisions.request(body)
    assert result.payload == body
    assert result.reserve_micros > 0
    items = grouped.parse({'version':3,'items':[{'operation_id':'a'*32,'attempt_id':'1234567890-'+'b'*32,'request':body}]},max_tokens=2048)
    assert items[0].contract.payload == body


@pytest.mark.parametrize('mutation', ['future', 'missing', 'category', 'oversized', 'not_text'])
def test_server_bounds_size_and_leaves_assessment_semantics_to_native(mutation):
    body = deepcopy(request())
    if mutation == 'future': body['state']['actualPartnerReply']='Do not leak this'
    elif mutation == 'missing': del body['questions']['grammar']
    elif mutation == 'category': body['questions']['grammar']['criteria']['unrecognized']='invalid'
    elif mutation == 'oversized': body['state']['currentLearnerMessage']='x'*30000
    else: body['state']['variety']=None
    if mutation == 'oversized':
        with pytest.raises(HTTPException): decisions.request(body)
    else:
        assert decisions.request(body).payload == body
