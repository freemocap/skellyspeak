"""Bounded grouped chat transport; each item owns admission and settlement."""
from __future__ import annotations

import hashlib
import json
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from functools import partial

import anyio
from fastapi import HTTPException
from google.cloud import firestore

import admission
import contracts
import quota
import work_admission as work

MAX_ITEMS = 8


@dataclass(frozen=True)
class Item:
    operation_id: str
    attempt_id: str
    contract: contracts.ChatRequest
    digest: str


def parse(payload: object, *, allowed_models: tuple[str, ...], max_tokens: int) -> list[Item]:
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
        if not isinstance(request, dict) or request.get("stream", False) is not False or request.get("model") != "google/gemini-2.5-flash":
            raise HTTPException(400, "Grouped operations require non-streaming text chat requests.")
        contract = contracts.chat_request(request, allowed_models=allowed_models, max_tokens=max_tokens)
        canonical = json.dumps({"version": 1, "operation_id": operation, "request": contract.payload}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        result.append(Item(operation, attempt, contract, hashlib.sha256(canonical.encode()).hexdigest()))
    return result


async def results(items: list[Item], *, db: firestore.Client, who: quota.Principal,
                  execute: Callable[[Item, work.Claim], Awaitable[dict[str, object]]]) -> AsyncIterator[bytes]:
    send, receive = anyio.create_memory_object_stream[dict[str, object]](1)

    async def run(item: Item) -> None:
        event: dict[str, object] = {"operation_id": item.operation_id, "attempt_id": item.attempt_id}
        try:
            # Each item consumes infrastructure admission, including duplicates.
            # Shield transaction ownership transfer so disconnect cannot orphan a
            # completed claim before execution gets its cleanup responsibility.
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(partial(admission.take, db, lane="account", subject=who.user_id))
                held = await anyio.to_thread.run_sync(partial(work.claim, db, user_id=who.user_id, attempt_id=item.attempt_id, digest=item.digest))
            if held.acquired:
                event.update(await execute(item, held))
            else:
                event.update({"type": "duplicate", "state": held.state})
        except HTTPException as error:
            event.update({"type": "error", "code": getattr(error, "code", "REQUEST_REJECTED"), "status": error.status_code})
            retry = (error.headers or {}).get("Retry-After", "")
            if retry.isdigit() and 0 < int(retry) <= 604800:
                event["retry_after"] = int(retry)
        except Exception:
            event.update({"type": "error", "code": "UNKNOWN_OUTCOME", "status": 500})
        await send.send(event)

    async with send, receive, anyio.create_task_group() as tasks:
        for item in items:
            tasks.start_soon(run, item)
        try:
            for _ in items:
                event = await receive.receive()
                yield (json.dumps(event, ensure_ascii=False) + "\n").encode()
            yield (json.dumps({"type": "complete", "count": len(items)}) + "\n").encode()
        finally:
            tasks.cancel_scope.cancel()
