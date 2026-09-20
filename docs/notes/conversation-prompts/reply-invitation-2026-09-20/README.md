# Reply invitation correction — 2026-09-20

**Superseded for conversational quality:** user testing rejected the question-only pilot. See the [meaning-based comparison](../engagement-2026-09-20/README.md). Historical results below are not current acceptance.

## Failure and implemented correction

User testing rejected conversation-25: low-level openings were isolated statements
without a useful next turn. Prior acceptance overvalued shortness and constraint
compliance. The previous opening recommendation is superseded.

Runtime source is `content/prompts/conversation/instructions.yaml`, assembled by
`native/src/conversations/conversation_prompt.rs`. Notes are not runtime inputs.
Revision conversation-28 requires one direct opening question and relevant
follow-up questions. Examples appear only at the two lowest levels. Difficulty
precedes the final task. No production retries or post-processing were added.

## Live verification

Batches used actual native-exported prompts, synthetic starter personas, Gemini
2.5 Flash via Google AI Studio on OpenRouter, and generated conversation history.
No saved user conversation was sent to these tests.

| Revision | Calls | Mechanical invitation failures | Provider cost USD |
| --- | ---: | ---: | ---: |
| conversation-26 | 48 | 7 | 0.0131395 |
| conversation-27 (`recheck/`) | 48 | 6 | 0.0135001 |
| conversation-28 (`final-check/`) | 48 | 0 | 0.0131918 |

Final: 36 openings and 12 subsequent turns. All openings were direct questions
without standalone introductions, including “¿Te gusta la música?” and “¿Te gusta
cocinar?”. Exact prompts/hashes/settings and responses are in batch artifacts.
Total provider-reported cost: $0.0398314.

## Remaining failures

This is not a general quality pass. Spanish Absolute Zero returned to music
instead of clarifying its dancing question. Mandarin Absolute Zero switched from
noodles to rice and back. Some Arabic clarification replies changed the
alternative rather than explaining the question. Question punctuation does not
establish semantic quality. Longer conversations and broader difficulty
calibration remain unverified.

## Verification

Native composer and opening execution tests, clippy, benchmark checks and
TypeScript checks passed. Benchmark negative cases reject isolated statements,
empty replies, generic check-ins and multiple questions. Native runs now exit
unsuccessfully on mechanical invitation failures independently of HTTP success.
The development app rebuilt with the corrected source. Changes are uncommitted.
