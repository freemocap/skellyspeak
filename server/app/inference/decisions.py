"""Bounded Jev Choice requests carried by the existing grouped work contract."""
from server.app.diagnostics.exceptions import DiagnosticValueError
import json
import math
from urllib.parse import urlsplit, urlunsplit
from server.app.inference.contracts import ChatRequest, reject

MODEL = "typesafe/jev-1.13"
CATEGORIES = {"demonstrated", "partial", "not_demonstrated", "not_observed", "uncertain"}

def encoded_size(value) -> int:
    # Match serde_json's compact UTF-8 representation used by native admission.
    return len(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())

def request(payload: dict) -> ChatRequest:
    if set(payload) != {"model", "state", "questions"} or payload.get("model") != MODEL:
        reject("Unsupported decisions request or model.")
    state, questions = payload["state"], payload["questions"]
    if not isinstance(state, dict) or set(state) != {"currentLearnerMessage", "precedingExchange", "input"}:
        reject("Decisions require the learner state contract.")
    if not isinstance(state["currentLearnerMessage"], str) or not state["currentLearnerMessage"].strip():
        reject("Decisions require learner text.")
    if not isinstance(state["precedingExchange"], list) or len(state["precedingExchange"]) > 4:
        reject("Decisions context exceeds four messages.")
    for message in state["precedingExchange"]:
        if not isinstance(message, dict) or set(message) != {"role", "content"} or not isinstance(message["role"], str) or message["role"] not in {"user", "assistant"} or not isinstance(message["content"], str):
            reject("Invalid decisions context message.")
    flags = state["input"]
    if not isinstance(flags, dict) or set(flags) != {"modality", "suggestion", "revision", "scaffold"} or not isinstance(flags["modality"], str) or flags["modality"] not in {"text", "speech_transcript"} or any(type(flags[k]) is not bool for k in ("suggestion", "revision", "scaffold")):
        reject("Invalid decisions input flags.")
    if not isinstance(questions, dict) or len(questions) != 45:
        reject("Decisions require 45 skill questions.")
    size = encoded_size(payload)
    if size > 100_000:
        reject("Decisions request exceeds input limit.")
    state_size = encoded_size(state)
    reserve = 0
    for key, question in questions.items():
        if not isinstance(key, str) or not key or len(key) > 64 or not isinstance(question, dict) or set(question) != {"type", "instructions", "criteria"}:
            reject("Invalid decisions question.")
        criteria = question["criteria"]
        if question["type"] != "choice" or not isinstance(question["instructions"], str) or not isinstance(criteria, dict) or set(criteria) != CATEGORIES or any(not isinstance(v, str) for v in criteria.values()):
            reject("Decisions require five-way Choice criteria.")
        bound = state_size + encoded_size(question) + 4096
        if bound > 28_000:
            reject("Decisions question exceeds context limit.")
        # Conservative repeated-state byte/token bound, $0.042/M input tokens.
        # This reservation is NOT actual cost. Settlement consumes provider usage.
        reserve += bound * .042
    return ChatRequest(payload=payload, reserve_micros=math.ceil(reserve))

def endpoint(base: str) -> str:
    parts = urlsplit(base)
    if not parts.path.rstrip('/').endswith('/v1'):
        raise DiagnosticValueError("Decisions require an OpenRouter API base ending in /v1")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip('/')[:-3] + '/alpha/decisions', '', ''))

def completion(payload: dict) -> dict:
    if not isinstance(payload.get("answers"), dict):
        from fastapi import HTTPException
        from server.app.diagnostics.provider_errors import sanitize
        error = HTTPException(502, "Decisions response lacks typed answers.")
        error.diagnostics = {"response": sanitize(payload), "validation": {
            "stage": "decisions", "path": "answers", "expected": "typed answers object"}}
        raise error
    usage = payload.get("usage")
    if isinstance(usage, dict):
        usage = dict(usage)
        for source, target in (("input_tokens", "prompt_tokens"), ("output_tokens", "completion_tokens")):
            if source in usage:
                usage[target] = usage[source]
        payload = {**payload, "usage": usage}
    # Adapt transport envelope only; native domain validation owns all answers.
    return {**payload, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(payload["answers"], ensure_ascii=False)}}]}
