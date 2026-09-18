"""Grouped HTTP execution uses independent claims, accounting and outcomes."""
from __future__ import annotations

import asyncio
import json
import time
from functools import partial

import anyio

import httpx
import pytest

import server.app.inference.grouped as grouped
import server.app.main as main
import server.app.admission.work_admission as work_admission
from server.tests.accounting.test_budget import ledger
from server.tests.inference.test_proxy import proxy, upstream
from server.tests.inference.test_contracts import structured_format


def envelope(count: int = 2) -> dict:
    return {"version": 1, "items": [{
        "operation_id": f"{i:032x}", "attempt_id": f"{int(time.time())}-{i:032x}",
        "request": {"model": "google/gemini-2.5-flash", "messages": [{"role": "user", "content": f"hello {i}"}]},
    } for i in range(count)]}


@pytest.mark.asyncio
async def test_group_forwards_structured_contract_and_retains_completion_metadata(proxy, monkeypatch):
    sent = []
    def respond(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, json={"id": "generation", "model": "google/gemini-2.5-flash",
            "choices": [{"finish_reason": "stop", "message": {"content": '{"spans":[]}'}}],
            "usage": {"cost": 0.00001, "prompt_tokens": 4, "completion_tokens": 3, "total_tokens": 7}})
    upstream(monkeypatch, respond)
    request = envelope(1)
    request["items"][0]["request"]["response_format"] = structured_format()
    response = await proxy.post("/v1/operations", json=request)
    assert response.status_code == 200
    events = [json.loads(line) for line in response.text.splitlines()]
    assert [event["type"] for event in events] == ["result", "complete"]
    assert len(sent) == 1
    assert sent[0]["response_format"] == structured_format()
    assert sent[0]["provider"]["allow_fallbacks"] is False
    assert sent[0]["provider"]["require_parameters"] is True
    assert events[0]["response"]["choices"][0]["finish_reason"] == "stop"
    assert events[0]["response"]["choices"][0]["message"]["content"] == '{"spans":[]}'
    assert events[0]["response"]["usage"]["completion_tokens"] == 3


@pytest.mark.asyncio
async def test_assistant_first_history_reaches_upstream_and_results_keep_identity(ledger, proxy, monkeypatch):
    conversation = [
        {"role": "system", "content": "Converse naturally in Spanish."},
        {"role": "assistant", "content": "Hola. ¿Te gusta la música?"},
        {"role": "user", "content": "No, no me gusta música."},
    ]
    helper = [
        {"role": "system", "content": "Return a JSON description of the supplied word."},
        {"role": "user", "content": "árbol"},
    ]
    release_conversation = asyncio.Event()
    sent = []

    async def respond(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        sent.append(body)
        if body["messages"] == conversation:
            await release_conversation.wait()
            text, identity = "¿Qué prefieres hacer?", "conversation-generation"
        else:
            assert body["messages"] == helper
            text, identity = '{"spans":[]}', "helper-generation"
        return httpx.Response(200, json={"id": identity, "model": "google/gemini-2.5-flash",
            "choices": [{"finish_reason": "stop", "message": {"content": text}}],
            "usage": {"cost": 0.00001, "prompt_tokens": 4, "completion_tokens": 3, "total_tokens": 7}})

    upstream(monkeypatch, respond)
    request = envelope()
    request["items"][0]["request"]["messages"] = conversation
    request["items"][1]["request"]["messages"] = helper
    request["items"][1]["request"]["response_format"] = structured_format()
    items = grouped.parse(request, max_tokens=100)
    who = main.quota.Principal("learner", 500_000, False)
    # Use the route's actual upstream executor; hold the first completion until
    # the second result is observed, without timing sleeps or real inference.
    stream = grouped.results(items, db=ledger, who=who,
        execute=partial(main.execute_grouped_item, who=who))
    try:
        first = json.loads(await anext(stream))
    finally:
        release_conversation.set()
    rest = [json.loads(line) async for line in stream]
    assert first["type"] == "result"
    assert (first["operation_id"], first["attempt_id"]) == (items[1].operation_id, items[1].attempt_id)
    assert first["response"]["id"] == "helper-generation"
    assert first["response"]["choices"][0]["message"]["content"] == '{"spans":[]}'
    assert rest[-1] == {"type": "complete", "count": 2}
    assert len(rest) == 2
    assert (rest[0]["operation_id"], rest[0]["attempt_id"]) == (items[0].operation_id, items[0].attempt_id)
    assert rest[0]["response"]["id"] == "conversation-generation"
    assert rest[0]["response"]["choices"][0]["message"]["content"] == "¿Qué prefieres hacer?"
    assert len(sent) == 2
    by_kind = {"helper" if "response_format" in body else "conversation": body for body in sent}
    assert by_kind["conversation"]["messages"] == conversation
    assert by_kind["helper"]["messages"] == helper
    assert by_kind["helper"]["response_format"] == structured_format()


@pytest.mark.asyncio
async def test_invalid_structured_item_prevents_all_claims_and_upstream_calls(proxy, monkeypatch):
    calls = []
    upstream(monkeypatch, lambda request: calls.append(request))
    request = envelope()
    request["items"][1]["request"]["response_format"] = {"type": "json_object"}
    response = await proxy.post("/v1/operations", json=request)
    assert response.status_code == 400
    assert calls == []
    assert not any("work_attempts" in key for key in main.db.store)


@pytest.mark.asyncio
async def test_group_duplicate_does_not_call_or_charge_again(proxy, monkeypatch):
    calls = []
    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"id": "generation", "choices": [{"message": {"content": "hola"}}],
                                      "usage": {"cost": 0.00001, "total_tokens": 3}})
    upstream(monkeypatch, respond)
    payload = envelope()
    first = await proxy.post("/v1/operations", json=payload)
    assert first.status_code == 200
    events = [json.loads(line) for line in first.text.splitlines()]
    assert [e["type"] for e in events] == ["result", "result", "complete"]
    second = await proxy.post("/v1/operations", json=payload)
    assert [json.loads(line)["type"] for line in second.text.splitlines()] == ["duplicate", "duplicate", "complete"]
    assert len(calls) == 2
    assert main.quota.read_balance(main.db, "learner", limit=500_000).requests == 2
    assert main.db.store[f"users/learner/admission/{main.quota.utc_day()}"]["requests"] == 4
    receipts = [v for k, v in main.db.store.items() if "/work_attempts/" in k]
    assert len(receipts) == 2 and all(r["state"] == "succeeded" for r in receipts)
    assert main.db.store["users/learner/work_control/slots"]["active"] == {}


@pytest.mark.asyncio
async def test_malformed_group_rejected_before_any_claim(proxy):
    payload = envelope()
    payload["items"][1]["attempt_id"] = payload["items"][0]["attempt_id"]
    response = await proxy.post("/v1/operations", json=payload)
    assert response.status_code == 400
    assert not any("work_attempts" in k for k in main.db.store)


@pytest.mark.asyncio
async def test_results_arrive_independently(ledger):
    items = grouped.parse(envelope(), max_tokens=100)
    slow = asyncio.Event()
    async def execute(item, held):
        if item.operation_id == items[0].operation_id:
            await slow.wait()
        work_admission.finish(ledger, claim=held, state="succeeded")
        return {"type": "result"}
    stream = grouped.results(items, db=ledger, who=main.quota.Principal("learner", 100, False), execute=execute)
    first = json.loads(await anext(stream))
    assert first["operation_id"] == items[1].operation_id
    slow.set()
    rest = [json.loads(line) async for line in stream]
    assert rest[-1]["type"] == "complete"


@pytest.mark.asyncio
async def test_partial_failure_keeps_unknown_lease_without_blocking_sibling(proxy, monkeypatch, caplog):
    def respond(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["messages"][0]["content"] == "hello 0":
            return httpx.Response(502, text="private upstream content")
        return httpx.Response(200, json={"id": "ok", "choices": [], "usage": {"cost": 0.00001, "total_tokens": 1}})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/operations", json=envelope())
    assert "private upstream content" not in response.text + caplog.text
    diagnostic = next(json.loads(r.message) for r in caplog.records if r.name == "skellyspeak.operations")
    assert diagnostic == {"event": "operation_failure", "severity": "ERROR", "status": 502, "upstream_status": 502, "category": "http", "request_id": response.headers["x-request-id"], "item_index": 0, "code": "OPENROUTER_HTTP_502", "exception_type": "UpstreamHTTPError"}
    events = [json.loads(line) for line in response.text.splitlines()]
    assert sorted(e["type"] for e in events) == ["complete", "error", "result"]
    assert next(e for e in events if e["type"] == "error")["status"] == 502
    assert len(main.db.store["users/learner/work_control/slots"]["active"]) == 1
    assert sorted(v["state"] for k, v in main.db.store.items() if "/work_attempts/" in k) == ["succeeded", "unknown"]


@pytest.mark.asyncio
async def test_disconnect_retains_unknown_claim_and_settles_reservation(ledger, monkeypatch):
    monkeypatch.setattr(main, "db", ledger)
    started = anyio.Event()
    async def provider(*args, **kwargs):
        started.set()
        await anyio.sleep_forever()
    monkeypatch.setattr(main, "provider_json", provider)
    who = main.quota.Principal("learner", 500_000, False)
    items = grouped.parse(envelope(1), max_tokens=100)
    async def consume():
        async for _ in grouped.results(items, db=ledger, who=who, execute=partial(main.execute_grouped_item, who=who)):
            pass
    async with anyio.create_task_group() as tasks:
        tasks.start_soon(consume)
        await started.wait()
        tasks.cancel_scope.cancel()
    receipt = next(v for k, v in ledger.store.items() if "/work_attempts/" in k)
    assert receipt["state"] == "unknown"
    assert len(ledger.store["users/learner/work_control/slots"]["active"]) == 1
    reservations = [v for k, v in ledger.store.items() if "/reservations/" in k]
    assert len(reservations) == 1 and reservations[0]["status"] == "unknown"


@pytest.mark.asyncio
async def test_group_requires_authentication_before_storage(ledger, monkeypatch):
    monkeypatch.setattr(main, "db", ledger)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.post("/v1/operations", json=envelope())
    assert response.status_code == 401
    assert ledger.store == {}


@pytest.mark.asyncio
async def test_protocol_capabilities_are_authenticated_and_match_grouped_contract(proxy):
    response = await proxy.get("/v1/protocol")
    assert response.status_code == 200
    assert response.json() == {"protocol": "skellyspeak", "version": 1, "max_items": 8,
                               "chat_models": ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "openai/gpt-oss-120b"],
                               "accepts_other_text_models": True, "transcription_model": "whisper-large-v3",
                               "audio": {"version": 1, "speech_provider": "elevenlabs", "speech_model": "eleven_v3", "speech_ready": False, "transcription_provider": "groq"}}


@pytest.mark.asyncio
async def test_protocol_requires_session(ledger, monkeypatch):
    monkeypatch.setattr(main, "db", ledger)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        response = await client.get("/v1/protocol")
    assert response.status_code == 401
    assert ledger.store == {}


@pytest.mark.asyncio
async def test_internal_failure_diagnostic_never_logs_exception_text(proxy, monkeypatch, caplog):
    async def fail(*args, **kwargs):
        raise ValueError("PRIVATE_PROMPT_AND_KEY")
    monkeypatch.setattr(main, "provider_json", fail)
    response = await proxy.post("/v1/operations", json=envelope(1))
    assert "PRIVATE_PROMPT_AND_KEY" not in response.text + caplog.text
    failure = next(json.loads(line) for line in response.text.splitlines() if json.loads(line)["type"] == "error")
    assert failure["status"] == 500
    diagnostic = next(json.loads(r.message) for r in caplog.records if r.name == "skellyspeak.operations")
    assert diagnostic == {"event": "operation_failure", "severity": "ERROR", "status": 500, "upstream_status": None, "category": "internal", "request_id": response.headers["x-request-id"], "item_index": 0, "code": "UNKNOWN_OUTCOME", "exception_type": "ValueError"}


@pytest.mark.asyncio
async def test_concurrent_groups_correlate_failure_and_finish_without_client_data(proxy, monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger='skellyspeak.operations')
    caplog.set_level(logging.INFO, logger='skellyspeak.requests')
    upstream(monkeypatch, lambda request: httpx.Response(422, text='PRIVATE_PROVIDER_BODY'))
    requests = [envelope(1), envelope(1)]
    requests[1]['items'][0]['attempt_id'] = requests[1]['items'][0]['attempt_id'][:-1] + 'a'
    responses = await asyncio.gather(*(proxy.post('/v1/operations', json=request,
        headers={'X-Request-ID': 'PRIVATE_CLIENT_REQUEST_ID'}) for request in requests))
    ids = {response.headers['x-request-id'] for response in responses}
    assert len(ids) == 2
    rows = [json.loads(record.message) for record in caplog.records if record.name == 'skellyspeak.operations']
    for request_id in ids:
        related = [row for row in rows if row['request_id'] == request_id]
        failure = next(row for row in related if row['event'] == 'operation_failure')
        assert failure['item_index'] == 0 and failure['code'] == 'OPENROUTER_HTTP_422'
        assert failure['exception_type'] == 'UpstreamHTTPError'
        finished = next(row for row in related if row['event'] == 'group_finished')
        assert finished == {'event': 'group_finished', 'request_id': request_id,
            'item_count': 1, 'delivered': 1, 'failures': 1, 'complete': True}
    assert 'PRIVATE_' not in caplog.text
