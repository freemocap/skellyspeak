"""Bounded scoring contracts preserve independent request state and accounting."""
from pathlib import Path
from copy import deepcopy
import pytest
import yaml
from fastapi import HTTPException
from server.app.inference import decisions, grouped


def request(kind):
    config = yaml.safe_load((Path(__file__).parents[3] / 'content/prompts/conversation/ratings.yaml').read_text())
    state = dict(language='Arabic', variety='Levantine', learnerMessage='مرحبا', precedingPartner='')
    if kind == 'understanding':
        state['actualPartnerReply'] = 'أهلا'
    return dict(model=decisions.MODEL, state=state, questions=config[kind])


@pytest.mark.parametrize('kind', ['ratings', 'understanding'])
def test_new_requests_pass_grouped_admission_with_usage_reservation(kind):
    body = request(kind)
    result = decisions.request(body)
    assert result.payload == body
    assert result.reserve_micros > 0
    items = grouped.parse({'version':2,'items':[{'operation_id':'a'*32,'attempt_id':'1234567890-'+'b'*32,'request':body}]},max_tokens=2048)
    assert items[0].contract.payload == body


@pytest.mark.parametrize('mutation', ['future', 'missing', 'category', 'oversized', 'not_text'])
def test_invalid_rating_contracts_fail_before_inference(mutation):
    body = deepcopy(request('ratings'))
    if mutation == 'future': body['state']['actualPartnerReply']='Do not leak this'
    elif mutation == 'missing': del body['questions']['grammar']
    elif mutation == 'category': body['questions']['grammar']['criteria']['score_11']='invalid'
    elif mutation == 'oversized': body['state']['learnerMessage']='x'*30000
    else: body['state']['variety']=None
    with pytest.raises(HTTPException): decisions.request(body)
