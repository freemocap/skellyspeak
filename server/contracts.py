"""The hosted service accepts only the app's bounded request shapes."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import NoReturn

from fastapi import HTTPException


@dataclass(frozen=True)
class ChatRequest:
    payload: dict[str, object]
    reserve_micros: int


def reject(message: str) -> NoReturn:
    raise HTTPException(status_code=400, detail=message)


def chat_request(payload: dict[str, object], *, allowed_models: tuple[str, ...], max_tokens: int) -> ChatRequest:
    allowed = {"model", "messages", "temperature", "stream", "max_tokens", "reasoning",
               "provider", "response_format", "modalities", "audio"}
    if unexpected := payload.keys() - allowed:
        reject(f"Unsupported request fields: {', '.join(sorted(unexpected))}")
    model = payload.get("model")
    if not isinstance(model, str) or model not in allowed_models or model not in {"google/gemini-2.5-flash", "openai/gpt-audio-mini"}:
        reject("This model has no hosted pricing contract.")
    audio = model == "openai/gpt-audio-mini"
    cap = min(max_tokens, 2_000 if audio else max_tokens)
    requested = payload.get("max_tokens", cap)
    if type(requested) is not int or not 1 <= requested <= cap:
        reject(f"max_tokens must be an integer between 1 and {cap}.")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 64:
        reject("messages must contain between 1 and 64 text messages.")
    for message in messages:
        if not isinstance(message, dict) or set(message) != {"role", "content"}:
            reject("Each message must contain only role and content.")
        if not isinstance(message["role"], str) or message["role"] not in {"system", "user", "assistant"} or not isinstance(message["content"], str):
            reject("Only system, user and assistant text messages are supported.")
    temperature = payload.get("temperature", 1)
    if type(temperature) not in (int, float) or not math.isfinite(temperature) or not 0 <= temperature <= 2:
        reject("temperature must be a finite number between 0 and 2.")
    if type(payload.get("stream", False)) is not bool:
        reject("stream must be a boolean.")
    provider = payload.get("provider", {"require_parameters": True})
    if provider != {"require_parameters": True}:
        reject("Provider routing is controlled by the hosted service.")
    reasoning = payload.get("reasoning", {"enabled": False})
    if reasoning not in ({"enabled": False}, {"effort": "minimal"}):
        reject("Hosted requests support disabled or minimal reasoning only.")
    if audio:
        if payload.get("modalities") != ["text", "audio"] or payload.get("stream") is not True:
            reject("Speech requests must stream text and audio.")
        options = payload.get("audio")
        if not isinstance(options, dict) or set(options) != {"voice", "format"}:
            reject("Speech requires voice and format.")
        if options["format"] != "pcm16" or not isinstance(options["voice"], str) or options["voice"] not in {
            "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"
        }:
            reject("Unsupported speech voice or format.")
        if "response_format" in payload:
            reject("Speech does not accept a structured response format.")
    elif "audio" in payload or "modalities" in payload:
        reject("This model accepts text only.")
    response_format = payload.get("response_format")
    if response_format is not None:
        if not isinstance(response_format, dict) or set(response_format) != {"type", "json_schema"}:
            reject("Only json_schema structured output is supported.")
        schema = response_format.get("json_schema")
        if response_format["type"] != "json_schema" or not isinstance(schema, dict):
            reject("Malformed structured output schema.")
        if set(schema) != {"name", "strict", "schema"} or schema["strict"] is not True:
            reject("Structured output requires a named strict schema.")
        if not isinstance(schema["name"], str) or not isinstance(schema["schema"], dict):
            reject("Malformed structured output schema.")
    # UTF-8 bytes conservatively bound text tokens, including framing/schema overhead.
    input_bound = len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) + 1024
    if input_bound > (16_384 if audio else 100_000):
        reject("The hosted input is too long. Shorten the conversation or message.")
    prompt_price, completion_price = (1, 24) if audio else (1, 3)
    outbound = dict(payload)
    outbound["max_tokens"] = requested
    outbound["provider"] = {
        "require_parameters": True,
        "max_price": {"prompt": prompt_price, "completion": completion_price, "request": 0},
    }
    return ChatRequest(
        payload=outbound,
        reserve_micros=math.ceil(input_bound * prompt_price + requested * completion_price),
    )
