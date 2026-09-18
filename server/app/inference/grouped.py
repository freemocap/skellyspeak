"""Bounded grouped chat transport; each item owns admission and settlement."""
from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from functools import partial

import anyio
from fastapi import HTTPException
from google.cloud import firestore

from server.app.diagnostics.exceptions import describe
import server.app.diagnostics.runtime as runtime
import server.app.admission.admission as admission
import server.app.inference.contracts as contracts
import server.app.accounting.quota as quota
import server.app.admission.work_admission as work

MAX_ITEMS = 8
log = logging.getLogger("skellyspeak.operations")


def record_failure(status: int, error: BaseException, *, request_id: str, item_index: int) -> None:
    # IDs originate in server middleware; indices are assigned by this executor.
    # Never include exception messages, request data or client identities.
    upstream = getattr(error, "upstream_status", None)
    raw_code = getattr(error, "code", "REQUEST_REJECTED" if isinstance(error, HTTPException) else "UNKNOWN_OUTCOME")
    code = raw_code if raw_code in {
        "REQUEST_REJECTED", "UNKNOWN_OUTCOME", "UPSTREAM_FAILURE", "SPENDING_PAUSED",
        "PERSONAL_ALLOWANCE_EXHAUSTED", "SHARED_ALLOWANCE_EXHAUSTED", "ACCOUNT_INFLIGHT_LIMIT",
        "SHARED_ACCOUNT_DAILY_LIMIT", "PERSONAL_ACCOUNT_DAILY_LIMIT",
    } or isinstance(raw_code, str) and re.fullmatch(r"(?:OPENROUTER|GROQ)_HTTP_[45][0-9]{2}", raw_code) else "OTHER"
    kind = type(error).__name__
    exception_type = kind if kind in {
        "HTTPException", "UpstreamHTTPError", "Rejection", "UsageUnknown", "ValueError",
        "TypeError", "KeyError", "RuntimeError", "TimeoutError", "ReadTimeout",
        "ConnectTimeout", "ConnectError", "ReadError", "RemoteProtocolError",
    } else "OtherException"
    log.warning(json.dumps({"event": "operation_failure",
        "severity": "ERROR" if status >= 500 else "WARNING", "request_id": request_id,
        "item_index": item_index, "code": code, "exception_type": exception_type,
        "status": status, "diagnostics": describe(error),
        "upstream_status": upstream if type(upstream) is int and 100 <= upstream <= 599 else None,
        "category": "http" if isinstance(error, HTTPException) else "internal"}))


@dataclass(frozen=True)
class Item:
    operation_id: str
    attempt_id: str
    contract: contracts.ChatRequest
    digest: str


def parse(payload: object, *, max_tokens: int) -> list[Item]:
    if not isinstance(payload, dict) or set(payload) != {"version", "items"} or type(payload["version"]) is not int or payload["version"] != 1:
        raise HTTPException(400, "Expected grouped protocol version 1.")
    entries = payload["items"]
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_ITEMS:
        raise HTTPException(400, "A group must contain 1–8 operations.")
    result: list[Item] = []
    operations: set[str] = set()
    attempts: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"operation_id", "attempt_id", "request"}:
            raise HTTPException(400, "Invalid grouped operation fields.")
        operation = entry["operation_id"]
        attempt = entry["attempt_id"]
        request = entry["request"]
        if not isinstance(operation, str) or not re.fullmatch(r"[0-9a-f]{32}", operation) or not isinstance(attempt, str):
            raise HTTPException(400, "Invalid grouped operation identity.")
        work.identity("validated", attempt, "0" * 64)
        if operation in operations or attempt in attempts:
            raise HTTPException(400, "Duplicate identity within group.")
        operations.add(operation)
        attempts.add(attempt)
        if not isinstance(request, dict) or request.get("stream", False) is not False or "audio" in request or "modalities" in request:
            raise HTTPException(400, "Grouped operations require non-streaming text chat requests.")
        contract = contracts.chat_request(request, max_tokens=max_tokens)
        canonical = json.dumps({"version": 1, "operation_id": operation, "request": contract.payload}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        result.append(Item(operation, attempt, contract, hashlib.sha256(canonical.encode()).hexdigest()))
    return result


async def results(items: list[Item], *, db: firestore.Client, who: quota.Principal, request_id: str | None = None,
                  execute: Callable[[Item, work.Claim], Awaitable[dict[str, object]]]) -> AsyncIterator[bytes]:
    request_id = request_id or uuid.uuid4().hex
    if not re.fullmatch(r"[0-9a-f]{32}", request_id):
        raise ValueError("Invalid server request ID.")
    send, receive = anyio.create_memory_object_stream[dict[str, object]](1)
    delivered = 0
    failures = 0
    complete = False

    async def run(item_index: int, item: Item) -> None:
        runtime.emit("operation_started", request_id=request_id, item_index=item_index)
        event: dict[str, object] = {"operation_id": item.operation_id, "attempt_id": item.attempt_id}
        try:
            # Each item consumes infrastructure admission, including duplicates.
            # Shield transaction ownership transfer so disconnect cannot orphan a
            # completed claim before execution gets its cleanup responsibility.
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(partial(admission.take, db, lane="account", subject=who.user_id))
                held = await anyio.to_thread.run_sync(partial(work.claim, db, user_id=who.user_id, attempt_id=item.attempt_id, digest=item.digest))
            runtime.emit("operation_claimed" if held.acquired else "operation_duplicate", request_id=request_id, item_index=item_index)
            if held.acquired:
                event.update(await execute(item, held))
            else:
                event.update({"type": "duplicate", "state": held.state})
        except HTTPException as error:
            record_failure(error.status_code, error, request_id=request_id, item_index=item_index)
            event.update({"type": "error", "code": getattr(error, "code", "REQUEST_REJECTED"), "status": error.status_code, "diagnostics": getattr(error, "diagnostics", None), "request_id": request_id})
            retry = (error.headers or {}).get("Retry-After", "")
            if retry.isdigit() and 0 < int(retry) <= 604800:
                event["retry_after"] = int(retry)
        except Exception as error:
            record_failure(500, error, request_id=request_id, item_index=item_index)
            event.update({"type": "error", "code": "UNKNOWN_OUTCOME", "status": 500, "diagnostics": describe(error), "request_id": request_id})
        runtime.emit("operation_finished", request_id=request_id, item_index=item_index)
        await send.send(event)

    async with send, receive, anyio.create_task_group() as tasks:
        for item_index, item in enumerate(items):
            tasks.start_soon(run, item_index, item)
        try:
            for _ in items:
                event = await receive.receive()
                failures += event["type"] == "error"
                delivered += 1
                yield (json.dumps(event, ensure_ascii=False) + "\n").encode()
            yield (json.dumps({"type": "complete", "count": len(items)}) + "\n").encode()
            complete = True
        finally:
            tasks.cancel_scope.cancel()
            log.info(json.dumps({"event": "group_finished", "request_id": request_id,
                "item_count": len(items), "delivered": delivered, "failures": failures,
                "complete": complete}))
