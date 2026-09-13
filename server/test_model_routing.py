"""Real grouped endpoint, controlled upstream: route, auth, history, schema and cost."""
import json
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
import httpx
import pytest
import main
import model_routing as routing
from test_proxy import proxy, upstream
from test_budget import ledger
from test_grouped import envelope


def test_groq_usage_counts_reasoning_and_rejects_invalid_counts():
    assert routing.groq_usage({"usage": {"prompt_tokens": 1000, "completion_tokens": 1000, "completion_tokens_details": {"reasoning_tokens": 900}}}) == (750, 2000)
    assert routing.groq_usage({}) == (None, 0)
    for count in [-1, True, "100"]:
        with pytest.raises(ValueError):
            routing.groq_usage({"usage": {"prompt_tokens": count, "completion_tokens": 1}})


@pytest.mark.asyncio
async def test_mixed_models_use_correct_credentials_and_preserve_history(proxy, monkeypatch):
    monkeypatch.setattr(main, "CFG", replace(main.CFG, allowed_models=tuple(routing.TEXT_MODELS)))
    history = [{"role": "system", "content": "Speak Spanish."}, {"role": "assistant", "content": "¿Te gusta cocinar?"}, {"role": "user", "content": "No, prefiero leer."}]
    sent = []
    def respond(request):
        body = json.loads(request.content); sent.append(body)
        assert body["messages"] == history
        groq = body["model"] == routing.OSS
        assert str(request.url).startswith(main.CFG.groq_base_url if groq else main.CFG.openrouter_base_url)
        assert request.headers["authorization"] == "Bearer " + (main.CFG.groq_key if groq else main.CFG.openrouter_key)
        if groq:
            assert body["reasoning_effort"] == "low"
            assert body["max_completion_tokens"] == 2048
            assert "provider" not in body and "reasoning" not in body and "max_tokens" not in body
        usage = {"prompt_tokens": 1000, "completion_tokens": 1000, "total_tokens": 2000}
        if not groq: usage["cost"] = 0.0001
        return httpx.Response(200, json={"id": body["model"], "model": body["model"], "choices": [{"finish_reason": "stop", "message": {"content": "¿Qué lees?"}}], "usage": usage})
    upstream(monkeypatch, respond)
    request = envelope(3)
    for item, model in zip(request["items"], [routing.OSS, routing.LITE, routing.FLASH]):
        item["request"] = {"model": model, "messages": history, "max_tokens": 2048}
    response = await proxy.post('/v1/operations', json=request)
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [e['type'] for e in events] == ['result', 'result', 'result', 'complete']
    assert {e['response']['model'] for e in events[:-1]} == routing.TEXT_MODELS
    assert len(sent) == 3


def test_native_gloss_schema_is_relaxed_only_at_groq_transport_boundary():
    fixtures = json.loads((Path(__file__).resolve().parents[1] / 'workflow/benchmarks/model-routing/native-gloss-fixtures.json').read_text())
    original = {"model": routing.OSS, "max_tokens": 2048, "response_format": {"json_schema": {"schema": fixtures[0]['schema']}}}
    saved = deepcopy(original)
    outbound = routing.groq_payload(original)
    assert original == saved
    expected = deepcopy(saved['response_format']['json_schema']['schema'])
    for variant in expected['properties']['spans']['items']['oneOf']:
        for endpoint in ['first', 'last']:
            variant['properties'][endpoint] = {"type": "string"}
    assert outbound['response_format']['json_schema']['schema'] == expected
