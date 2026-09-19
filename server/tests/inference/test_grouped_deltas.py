"""Protocol version 2: ordered, lossless deltas beside the unchanged result."""
from __future__ import annotations

import json
import time

import anyio
import httpx
import pytest

import server.app.inference.grouped as grouped
from server.tests.accounting.test_budget import ledger  # noqa: F401  (fixture)
from server.tests.inference.test_proxy import proxy, upstream  # noqa: F401  (fixtures)


def envelope(count: int = 1, *, version: int = 2, deltas: bool = True) -> dict:
    items = []
    for i in range(count):
        item: dict[str, object] = {"operation_id": f"{i:032x}", "attempt_id": f"{int(time.time())}-{i:032x}",
                                   "request": {"model": "google/gemini-2.5-flash", "messages": [{"role": "user", "content": f"hola {i}"}]}}
        if version == 2:
            item["deltas"] = deltas
        items.append(item)
    return {"version": version, "items": items}


def sse(*events: object, done: bool = True) -> bytes:
    body = "".join(f"data: {json.dumps(event, ensure_ascii=False)}\n\n" for event in events)
    return (body + ("data: [DONE]\n\n" if done else "")).encode()


def chunk(text: str, **extra: object) -> dict:
    choice: dict[str, object] = {"index": 0, "delta": {"content": text}}
    choice.update(extra)
    return {"id": "gen", "model": "google/gemini-2.5-flash", "object": "chat.completion.chunk", "provider": "Google", "choices": [choice]}


USAGE = {"id": "gen", "model": "google/gemini-2.5-flash", "choices": [], "usage": {"cost": 0.00001, "prompt_tokens": 4, "completion_tokens": 3, "total_tokens": 7}}


def lines(response: httpx.Response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines()]


def replay(events: list[dict]) -> dict[str, str]:
    """Rebuild each item's text from its deltas, checking every offset."""
    texts: dict[str, str] = {}
    ended: set[str] = set()
    for event in events:
        if event["type"] == "delta":
            key = event["operation_id"]
            assert key not in ended, "no delta after an item's terminal event"
            assert event["offset"] == len(texts.get(key, "")), "offsets are contiguous Unicode scalar counts"
            texts[key] = texts.get(key, "") + event["text"]
        elif event["type"] in {"result", "error", "duplicate"}:
            ended.add(event["operation_id"])
    return texts


@pytest.mark.asyncio
async def test_version_2_streams_every_character_then_the_unchanged_result(proxy, monkeypatch):
    sent = []
    pieces = ["¡Qué ", "bien! ", "🎉 ", "𠮷", "野家"]

    def respond(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, content=sse(*[chunk(piece) for piece in pieces[:-1]], chunk(pieces[-1], finish_reason="stop"), USAGE),
                              headers={"content-type": "text/event-stream"})
    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/operations", json=envelope())
    assert response.status_code == 200
    events = lines(response)
    assert [event["type"] for event in events][-2:] == ["result", "complete"]
    assert set(events[-2]) == {"type", "operation_id", "attempt_id", "response"}, "the terminal event keeps its strict shape"
    result = events[-2]["response"]
    assert result["choices"][0]["message"]["content"] == "".join(pieces)
    assert result["choices"][0]["finish_reason"] == "stop"
    assert result["usage"]["completion_tokens"] == 3
    assert replay(events) == {f"{0:032x}": "".join(pieces)}
    assert sent[0]["stream"] is True and sent[0]["usage"] == {"include": True}


@pytest.mark.asyncio
async def test_truncated_reply_is_a_result_with_its_finish_reason_and_usage(proxy, monkeypatch):
    upstream(monkeypatch, lambda request: httpx.Response(200, content=sse(chunk("Hola mun", finish_reason="length"), USAGE)))
    events = lines(await proxy.post("/v1/operations", json=envelope()))
    result = [event for event in events if event["type"] == "result"][0]["response"]
    assert result["choices"][0]["finish_reason"] == "length"
    assert result["usage"]["cost"] == 0.00001
    assert replay(events) == {f"{0:032x}": "Hola mun"}


@pytest.mark.asyncio
async def test_provider_error_after_partial_output_keeps_the_text_and_reports_bounded_facts(proxy, monkeypatch):
    upstream(monkeypatch, lambda request: httpx.Response(200, content=sse(chunk("Parti"), {"error": {"code": 502, "message": "Upstream said no"}}, done=False)))
    events = lines(await proxy.post("/v1/operations", json=envelope()))
    error = [event for event in events if event["type"] == "error"][0]
    assert error["code"] == "OPENROUTER_HTTP_502"
    assert error["diagnostics"]["partial"]["chars"] == 5
    assert "Parti" not in json.dumps(error)
    assert replay(events) == {f"{0:032x}": "Parti"}


@pytest.mark.asyncio
async def test_a_stream_that_breaks_off_is_an_unknown_outcome_with_its_text_already_sent(proxy, monkeypatch):
    upstream(monkeypatch, lambda request: httpx.Response(200, content=sse(chunk("Cut"), done=False)))
    events = lines(await proxy.post("/v1/operations", json=envelope()))
    error = [event for event in events if event["type"] == "error"][0]
    assert (error["code"], error["status"]) == ("STREAM_BROKEN", 502)
    assert error["diagnostics"]["reason"] == "transport_broken"
    assert replay(events) == {f"{0:032x}": "Cut"}


@pytest.mark.asyncio
async def test_the_response_limit_is_an_error_never_a_truncated_result(proxy, monkeypatch):
    big = "a" * 100_000
    upstream(monkeypatch, lambda request: httpx.Response(200, content=sse(chunk(big), chunk(big), chunk(big), USAGE)))
    events = lines(await proxy.post("/v1/operations", json=envelope()))
    assert not [event for event in events if event["type"] == "result"]
    error = [event for event in events if event["type"] == "error"][0]
    assert (error["code"], error["status"]) == ("RESPONSE_LIMIT", 502)
    assert error["diagnostics"]["reason"] == "response_limit"
    assert error["diagnostics"]["chars"] == 200_000
    assert error["diagnostics"]["id"] == "gen"
    assert error["diagnostics"]["model"] == "google/gemini-2.5-flash"
    assert len(replay(events)[f"{0:032x}"]) == 200_000


@pytest.mark.asyncio
async def test_version_1_is_unchanged_and_rejects_deltas(proxy, monkeypatch):
    upstream(monkeypatch, lambda request: httpx.Response(200, json={"id": "gen", "model": "m", "choices": [{"finish_reason": "stop", "message": {"content": "Hola"}}],
                                                                    "usage": {"cost": 0.00001, "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}))
    events = lines(await proxy.post("/v1/operations", json=envelope(version=1)))
    assert [event["type"] for event in events] == ["result", "complete"]
    bad = envelope(version=1)
    bad["items"][0]["deltas"] = True
    assert (await proxy.post("/v1/operations", json=bad)).status_code == 400
    structured = envelope()
    structured["items"][0]["request"]["response_format"] = {"type": "json_object"}
    assert (await proxy.post("/v1/operations", json=structured)).status_code == 400


def test_digest_ignores_the_protocol_that_carried_the_request():
    [v1] = grouped.parse(envelope(version=1), max_tokens=2000)
    [v2] = grouped.parse(envelope(version=2), max_tokens=2000)
    assert v1.digest == v2.digest
    assert (v1.deltas, v2.deltas) == (False, True)


@pytest.mark.asyncio
async def test_slow_consumer_and_racing_terminals_lose_nothing():
    """A delta arriving right before the terminal is flushed first; nothing is
    written after an item's terminal; every character arrives in order."""
    items = grouped.parse(envelope(3), max_tokens=2000)

    async def execute(item, held, on_delta):
        text = f"item-{item.operation_id[-1]}-" + "é" * 40 + "🎉"
        for character in text:
            on_delta(character)
            if character == "é":
                await anyio.sleep(0)
        # The last piece lands in the same instant as the result.
        on_delta("!")
        return {"type": "result", "response": {"id": "x", "model": "m", "choices": [{"finish_reason": "stop", "message": {"content": text + "!"}}]}}

    class Claim:
        acquired = True
        state = "running"

    events = []
    import server.app.admission.admission as admission
    import server.app.admission.work_admission as work
    originals = (admission.take, work.claim)
    admission.take = lambda *args, **kwargs: None
    work.claim = lambda *args, **kwargs: Claim()
    try:
        async for line in grouped.results(items, db=None, who=type("Who", (), {"user_id": "u"})(), request_id="0" * 32, execute=execute):
            events.append(json.loads(line))
            await anyio.sleep(0.01)  # a slow consumer
    finally:
        admission.take, work.claim = originals
    texts = replay(events)
    for item, event in zip(items, [event for event in events if event["type"] == "result"]):
        assert texts[event["operation_id"]] == event["response"]["choices"][0]["message"]["content"]
    assert events[-1] == {"type": "complete", "count": 3}


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["eof", "framing", "provider", "limit", "timeout"])
async def test_stream_failures_keep_metadata_redaction_and_known_settlement(proxy, monkeypatch, failure):
    import server.app.main as main

    metadata = chunk("Private response", finish_reason="length", native_finish_reason="MAX_TOKENS")
    metadata.update({"debug_blob": "private unknown value", "api_key": main.CFG.openrouter_key})
    usage = {**USAGE, "usage": {**USAGE["usage"], "prompt_tokens_details": {"cached_tokens": 2}, "content": "private usage content"}}
    body = sse(metadata, usage, done=False)
    if failure == "framing":
        body += b"data: {broken\n\n"
    elif failure == "provider":
        body += sse({"error": {"code": 502, "message": f"hola 0 {main.CFG.openrouter_key} Private response"}}, done=False)
    elif failure == "limit":
        body += sse(chunk("x" * 262_144), done=False)
    upstream(monkeypatch, lambda request: httpx.Response(200, content=body, headers={"x-request-id": "http-retained"}))
    if failure == "timeout":
        async def timed_out(client, url, outbound, headers, on_delta, accumulator):
            on_delta(accumulator.accept(metadata))
            accumulator.accept(usage)
            raise TimeoutError()
        monkeypatch.setattr(main, "stream_grouped_item", timed_out)
    settlements = []
    settle = main._settle
    async def record_settlement(reservation, **kwargs):
        settlements.append(kwargs)
        return await settle(reservation, **kwargs)
    monkeypatch.setattr(main, "_settle", record_settlement)

    events = lines(await proxy.post("/v1/operations", json=envelope()))
    error = next(event for event in events if event["type"] == "error")
    details = error["diagnostics"]
    if failure == "provider":
        details = details["partial"]
    assert details["id"] == "gen"
    assert details["model"] == "google/gemini-2.5-flash"
    assert details["provider"] == "Google"
    assert details["finish_reason"] == "length"
    assert details["native_finish_reason"] == "MAX_TOKENS"
    assert details["usage"]["prompt_tokens_details"]["cached_tokens"] == 2
    assert details["usage"]["cost"] == 0.00001
    if failure != "timeout":
        assert details["http"]["response_headers"]["x_request_id"] == "http-retained"
    for private in ["Private response", "hola 0", main.CFG.openrouter_key, "private unknown value", "private usage content"]:
        assert private not in json.dumps(error)
    assert settlements == [{"cost": 10, "tokens": 7, "provider_id": "gen"}]
    assert replay(events) == {f"{0:032x}": "Private response"}


@pytest.mark.asyncio
async def test_invalid_stream_usage_preserves_validation_and_provider_metadata(proxy, monkeypatch):
    upstream(monkeypatch, lambda request: httpx.Response(200, content=sse(
        chunk("Private response", finish_reason="stop"), {**USAGE, "usage": {"total_tokens": -1, "cost": 0.00001}})))
    events = lines(await proxy.post("/v1/operations", json=envelope()))
    error = next(event for event in events if event["type"] == "error")
    assert error["diagnostics"]["id"] == "gen"
    assert error["diagnostics"]["reason"] == "invalid_usage"
    assert error["diagnostics"]["validation"]["path"] == "usage"
    assert error["diagnostics"]["usage"]["total_tokens"] == -1
    assert "Private response" not in json.dumps(error)
