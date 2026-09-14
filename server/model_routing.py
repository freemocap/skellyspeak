"""Provider bindings and spending ceilings, independent of model availability."""
from __future__ import annotations
from copy import deepcopy
import math

FLASH = "google/gemini-2.5-flash"
LITE = "google/gemini-2.5-flash-lite"
OSS = "openai/gpt-oss-120b"
RECOMMENDED_TEXT_MODELS = (FLASH, LITE, OSS)
# Other text IDs go unchanged to OpenRouter, which enforces this price ceiling.
# This is a spending bound, not an estimate of an unknown model's actual price.
# [@openrouterPriceRouting20260914]
DEFAULT_TEXT_PRICE_CEILING = (0.3, 2.5)
# USD per million tokens, numerically equal to microdollars per token.
# [@groqModels20260913] [@openrouterGeminiLite20260913]
PRICES = {FLASH: (0.3, 2.5), LITE: (0.1, 0.4), OSS: (0.15, 0.6)}


def groq_payload(payload: dict) -> dict:
    if payload.get("model") != OSS:
        raise ValueError("No Groq binding for this model.")
    result = deepcopy(payload)
    result.pop("provider", None)
    result.pop("reasoning", None)
    result["max_completion_tokens"] = result.pop("max_tokens")
    result["reasoning_effort"] = "low"
    schema = result.get("response_format", {}).get("json_schema", {}).get("schema", {})
    variants = schema.get("properties", {}).get("spans", {}).get("items", {}).get("oneOf")
    if variants is not None:
        if len(variants) != 2 or sorted(v.get("properties", {}).get("kind", {}).get("enum", []) for v in variants) != [["gloss"], ["literal"]]:
            raise ValueError("Unexpected gloss union.")
        for variant in variants:
            for key in ("first", "last"):
                endpoint = variant["properties"][key]
                if endpoint.get("type") != "string" or set(endpoint) - {"type", "enum"}:
                    raise ValueError("Unexpected gloss source endpoint.")
                variant["properties"][key] = {"type": "string"}
    return result


def groq_usage(payload: dict) -> tuple[int | None, int]:
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None, 0
    prompt, completion = usage.get("prompt_tokens"), usage.get("completion_tokens")
    if type(prompt) is not int or type(completion) is not int or min(prompt, completion) < 0:
        raise ValueError("Missing or invalid Groq token usage.")
    # Completion counts include reasoning tokens. Round up once per request.
    return math.ceil(prompt * PRICES[OSS][0] + completion * PRICES[OSS][1]), prompt + completion
