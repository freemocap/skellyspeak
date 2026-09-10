"""End-to-end proxy admission and settlement with a controlled upstream."""

from __future__ import annotations

import json
from collections.abc import Callable, AsyncIterator

import httpx
import pytest
import pytest_asyncio

import budget
import main
import quota
from test_budget import ledger
from test_quota import FakeDb


@pytest_asyncio.fixture
async def proxy(ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setattr(main, "db", ledger)
    main.app.dependency_overrides[main.current_user] = lambda: quota.Principal(
        user_id="learner", daily_limit=500_000, overridden=False)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
        yield client
    main.app.dependency_overrides.clear()


def upstream(monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]) -> None:
    real_client = httpx.AsyncClient

    def client(*, timeout: float) -> httpx.AsyncClient:
        return real_client(timeout=timeout, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(main.httpx, "AsyncClient", client)


def request(*, stream: bool) -> dict[str, object]:
    return {"model": "google/gemini-2.5-flash", "stream": stream,
            "messages": [{"role": "user", "content": "Hola"}], "max_tokens": 2000}


@pytest.mark.asyncio
async def test_account_response_contract(proxy: httpx.AsyncClient) -> None:
    response = await proxy.get("/v1/me")
    assert response.status_code == 200
    body = response.json()
    assert body["estimated_turns_remaining"] == 250
    assert isinstance(body["estimated_turns_remaining"], int)
    assert body["remaining_usd"] == 0.5
    assert body["requests_today"] == 0
    assert body["estimated_tokens_remaining"] == 0


@pytest.mark.asyncio
async def test_rejected_routing_never_reserves(proxy: httpx.AsyncClient, ledger: FakeDb) -> None:
    payload = request(stream=False)
    payload["models"] = ["unpriced/model"]
    assert (await proxy.post("/v1/chat/completions", json=payload)).status_code == 400
    assert ledger.store == {}


@pytest.mark.asyncio
async def test_success_settles_reported_cost(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        body = json.loads(sent.content)
        assert body["provider"]["max_price"]["request"] == 0
        return httpx.Response(status_code=200, json={"id": "generation-1", "choices": [],
                                                   "usage": {"cost": 0.000035, "total_tokens": 10}})

    upstream(monkeypatch, respond)
    assert (await proxy.post("/v1/chat/completions", json=request(stream=False))).status_code == 200
    balance = quota.read_balance(ledger, "learner", limit=500_000)
    assert (balance.used, balance.tokens, balance.requests) == (35, 10, 1)


@pytest.mark.asyncio
async def test_truncated_stream_retains_reservation_and_reports_error(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, text='data: {"id":"generation-1","choices":[]}\n\n')

    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert '"error"' in response.text
    assert "[DONE]" not in response.text
    records = [value for path, value in ledger.store.items() if f"/{budget.RESERVATIONS}/" in path]
    assert len(records) == 1
    assert records[0]["status"] == "unknown"
    assert records[0]["actual_micros"] == records[0]["reserved_micros"]


@pytest.mark.asyncio
async def test_complete_stream_settles_before_done(proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=200, text='data: {"id":"generation-1","usage":{"cost":0.000035,"total_tokens":10}}\n\ndata: [DONE]\n\n')

    upstream(monkeypatch, respond)
    response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert "[DONE]" in response.text
    assert '"error"' not in response.text
    assert quota.read_balance(ledger, "learner", limit=500_000).used == 35


@pytest.mark.asyncio
async def test_provider_error_does_not_refund_or_echo_private_content(
    proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    secret: str = "PRIVATE_TRANSCRIPT_AND_API_KEY_SENTINEL"

    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=400, text=secret)

    upstream(monkeypatch, respond)
    response: httpx.Response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert secret not in response.text
    assert secret not in caplog.text
    records: list[dict[str, object]] = [value for path, value in ledger.store.items() if f"/{budget.RESERVATIONS}/" in path]
    assert records[0]["status"] == "unknown"
    assert records[0]["actual_micros"] == records[0]["reserved_micros"]


@pytest.mark.asyncio
async def test_exhausted_audio_budget_never_decodes(
    proxy: httpx.AsyncClient, ledger: FakeDb, monkeypatch: pytest.MonkeyPatch,
) -> None:
    ledger.store[f"global_usage/{quota.utc_day()}"] = {"micros": main.CFG.global_daily_micros}

    def forbidden_decode(*args: object, **kwargs: object) -> None:
        raise AssertionError("Audio decoding must follow spending admission")

    monkeypatch.setattr(main.audio_input, "decode_upload", forbidden_decode)
    response: httpx.Response = await proxy.post("/v1/audio/transcriptions", content=b"not audio",
                                              headers={"Content-Type": "multipart/form-data; boundary=test"})
    assert response.status_code == 429


@pytest.mark.asyncio
async def test_upstream_payment_failure_preserves_safe_status(proxy: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def respond(sent: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=402, text="PRIVATE_PROVIDER_BODY")

    upstream(monkeypatch, respond)
    response: httpx.Response = await proxy.post("/v1/chat/completions", json=request(stream=True))
    assert '"code": 402' in response.text
    assert "PRIVATE_PROVIDER_BODY" not in response.text
    assert "[DONE]" not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize('payload,status', [
    ({'provider': 'PRIVATE_SENTINEL', 'redirect_uri': 'http://127.0.0.1/callback', 'code_challenge': 'a'*43}, 400),
    ({'provider': 'google', 'redirect_uri': 'http://127.0.0.1/callback', 'code_challenge': 'a'*43, 'code_challenge_method': 'PRIVATE_SENTINEL'}, 400),
    ({'provider': 'PRIVATE_SENTINEL'}, 422),
])
async def test_auth_errors_do_not_reflect_input(proxy, payload, status, caplog):
    response = await proxy.get('/auth/start', params=payload)
    assert response.status_code == status
    assert 'PRIVATE_SENTINEL' not in response.text + caplog.text
    assert response.json()['request_id'] == response.headers['x-request-id']


@pytest.mark.asyncio
async def test_callback_error_and_unknown_fields_are_not_echoed(proxy, caplog):
    response = await proxy.get('/auth/callback/google', params={'error': 'PRIVATE_SENTINEL'})
    assert response.status_code == 400
    assert 'PRIVATE_SENTINEL' not in response.text + caplog.text
    value = request(stream=False)
    value['PRIVATE_SENTINEL'] = 'anything'
    response = await proxy.post('/v1/chat/completions', json=value)
    assert response.status_code == 400
    assert 'PRIVATE_SENTINEL' not in response.text + caplog.text


@pytest.mark.asyncio
async def test_provider_response_limit_stops_reading_without_content_length():
    reads = []
    class Chunks(httpx.AsyncByteStream):
        async def __aiter__(self):
            for _ in range(10):
                reads.append(1)
                yield b'x' * 8
    async with httpx.AsyncClient(transport=httpx.MockTransport(
        lambda _: httpx.Response(200, stream=Chunks()))) as client:
        with pytest.raises(main.HTTPException, match='size limit'):
            await main.provider_json(client, 'https://example.invalid', limit=10)
    assert len(reads) == 2


@pytest.mark.asyncio
async def test_provider_redirect_never_receives_credentials():
    seen = []
    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(307, headers={'Location': 'https://other.invalid'}, text='PRIVATE_SENTINEL')
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(main.HTTPException) as error:
            await main.provider_json(client, 'https://example.invalid', limit=10,
                                     headers={'Authorization': 'Bearer PRIVATE_SENTINEL'})
    assert len(seen) == 1
    assert 'PRIVATE_SENTINEL' not in str(error.value)
