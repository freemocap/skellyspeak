# Spec: LLM tutor (conversation partner)

## Purpose
A mixed-language tutor reply: answers "how do I say X", grammar/vocab help, natural
reformulation.

## Behavior
- Minimal `reqwest` + `schemars` client, OpenAI-compatible `POST /v1/chat/completions`
  with `response_format: {type:"json_schema", ...}`.
- Providers: Ollama (local), LM Studio, OpenAI, OpenRouter.

## Acceptance criteria
- [ ] A structured reply model is returned and rendered as a bubble.
- [ ] Provider + model are configurable.

## Test plan
Unit: request/response (de)serialization + schema generation against a fake HTTP layer.
Integration: real Ollama/OpenAI call (manual, Jon's machine).
