---
sidebar_position: 8
title: The Coach
---

# The Coach

The coach is a private second conversation. It reads the learner's conversation,
teaching plan, profile, and its own thread, but the in-character conversation
partner never receives the private thread or per-message grades. Explicit
lesson choices are supplied separately as learning directives.

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
from completing. A badge attached to each learner message opens a feedback
dialog with scores, corrections, an editing action and an Ask the coach action.
Pending, failed and unavailable feedback have distinct labels.

## Interactive thread

The coach conversation sits below the Lesson and Analysis tabs. The coach sees
recent saved conversation context, inferred plan/profile, explicit lesson choices,
and its saved thread. Each chat stores up to 40 coach messages in
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

## Requests and suggestions

A direct request to change a learning goal, preference, correction intensity or
remembered fact applies immediately to the explicit lesson choices. It takes
effect on the next partner response. Questions and unsolicited recommendations
do not apply changes; proposals show an Apply suggestion button. The choices
editor supports the same validated updates without a model call. Stale edits
and proposals cannot overwrite a newer revision.

Level, topic and persona changes remain in the chat’s collapsible setup controls. The coach must
not claim to have changed those selectors. Corrections to inferred memory are
stored as explicit preferences with higher priority; both sources stay visible.

The coach conversation starts as a compact dock with its message box visible. Drag its top border to resize it, or use the heading toggle to collapse the thread while keeping the composer available. Its height and collapsed state persist on this device across reloads. The divider also supports the Up/Down arrow keys and Enter.
