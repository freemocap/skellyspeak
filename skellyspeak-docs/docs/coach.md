---
sidebar_position: 8
title: The Coach
---

# The Coach

The coach is a private second conversation. It reads the learner's conversation,
teaching plan, profile, and its own thread, but the in-character conversation
partner never receives coach output.

## Per-message feedback

After each learner message, the guided pipeline asks the coach for a validated
`CoachFeedback` result:

| Field | Meaning |
|---|---|
| `remark` | Brief feedback, primarily in the learner's native language |
| `used_target` / `used_native` | Verbatim portions of the learner message split by language |
| `corrections` | Up to three corrected phrases with kind and explanation |
| `comprehensibility` | 1–5 score for whether a native speaker would understand |
| `grammar` | 1–5 grammatical-correctness score |

Greeting and steering turns have no learner message, so they skip feedback.
Coach failures are surfaced without preventing independent analysis sections
from completing.

## Interactive thread

The Coach tab also accepts direct questions. The coach sees recent conversation
context and its saved thread. Each chat stores up to 40 coach messages in
`chats/<chat-id>/coach.json`.

Only one coach question can run at a time. A conversation change invalidates a
late answer, and the completed thread is persisted before it replaces in-memory
state.

## Call flow

1. The reply worker streams the conversation partner's response.
2. Learner tokenization can begin immediately.
3. After the reply, reply tokenization, translation, grammar explanation,
   scaffolds, and coach feedback run independently.
4. The observer updates teaching memory on its separate cadence.

Coach corrections do not currently mutate `TeachingPlan.recurring_errors`.
That remains a possible deterministic integration, not current behavior.

## Model and privacy

The automatic feedback pass uses the configured worker model. Interactive coach
questions use the same selected provider route. The thread is local application
data and is never sent to the conversation partner, but it is sent to the
selected provider when the coach answers.
