"""Bounded Jev Choice requests carried by the existing grouped work contract."""
from server.app.diagnostics.exceptions import DiagnosticValueError
import json
import math
from urllib.parse import urlsplit, urlunsplit
from server.app.inference.contracts import ChatRequest, reject

MODEL = "typesafe/jev-1.13"

def encoded_size(value) -> int:
    # Match serde_json's compact UTF-8 representation used by native admission.
    return len(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())

def request(payload: dict) -> ChatRequest:
    if set(payload) != {"model", "state", "questions"} or payload.get("model") != MODEL:
        reject("Unsupported decisions request or model.")
    state, questions = payload["state"], payload["questions"]
    if not isinstance(state, dict) or not isinstance(questions, dict) or not 1 <= len(questions) <= 64:
        reject("Decisions require bounded state and questions objects.")
    try:
        size = encoded_size(payload)
    except (ValueError, TypeError, RecursionError):
        reject("Decisions require bounded finite JSON.")
    if size > 100_000:
        reject("Decisions request exceeds input limit.")
    state_size = encoded_size(state)
    reserve = 0
    for key, question in questions.items():
        if not isinstance(key, str) or not key or len(key) > 64 or not isinstance(question, dict) or set(question) != {"type", "instructions", "criteria"}:
            reject("Invalid decisions question.")
        criteria = question["criteria"]
        if (question["type"] != "choice" or not isinstance(question["instructions"], str)
                or not isinstance(criteria, dict) or not 1 <= len(criteria) <= 64
                or any(not isinstance(k, str) or not k or len(k) > 64 or not isinstance(v, str)
                       for k, v in criteria.items())):
            reject("Invalid provider choice criteria.")
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
