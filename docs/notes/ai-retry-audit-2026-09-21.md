# AI request retry audit — 2026-09-21

## Scope and authorization

User requested an audit and consolidation of temporary provider rate-limit retries,
including transcription. This explicitly changes the older no-automatic-retry
expectation for confirmed 429 refusals. Unknown outcomes and partial output still
must not be automatically replayed. Source implementation only; no commit, release,
deployment, cloud trust changes, or paid provider probes were performed.

## Findings

The existing `application/rate_limit_retry.rs` runner was only called from the
scheduler's direct OpenRouter text branch, and that branch explicitly bypassed it
for Decisions. Other application owners had individual cancellation loops or
single-shot checked futures. There were not multiple exponential-backoff engines:
the main defect was that the one existing engine was not shared across owners.

The local transcription failure at 08:50:20 was ElevenLabs `system_busy`, upstream
HTTP 429, wrapped in service HTTP 502. The existing runner was Completion-specific
and recognized only direct provider errors. Simply calling it from transcription
would not have recognized this wrapped refusal.

## Implemented ownership

| Active application request | Before | Current retry owner |
| --- | --- | --- |
| Direct text/structured/coaching requests | Scheduler-specific runner | Shared native AI policy |
| Direct Decisions | Explicit runner bypass | Shared native AI policy |
| Microphone transcription, custom/hosted/Groq | Single submission | Shared native AI policy |
| Conversation speech | Separate cancellation loop, single submission | Shared native AI policy |
| Selected-word/passage speech | Single checked future | Shared native AI policy |
| Reading gloss help | Single checked future | Shared native AI policy, or server-owned grouped item |
| Persona generation | Single checked future | Shared native AI policy, or server-owned grouped item |
| Hosted/grouped text and Decisions | Single upstream submission | Shared server executor per item |

The existing Rust engine moved to `ai/policy/retry.rs` and supports Completion,
TranscriptionResponse and SpeechOutcome without converting away their metadata.
Callers supply authority checks and durable receipt updates. No provider adapter
owns a retry loop. Redacted failures are saved before backoff; final outcomes carry
`automatic_retries`, including prior provider IDs/reasons, scheduled times and delays.
Native metadata-only receipts remain separate according to their existing owners;
no common persistence schema or stored recording content was introduced.

Grouped execution runs in Python under a server-owned claim. Its single runner
in `server/app/inference/retry.py` uses the same limits; it cannot call the native
Rust executor. It retries a provider round inside the existing claim, never a
whole group. Each round reserves and settles separately. The rejected round's
unknown billing survives a subsequent successful round. The group claim finishes
once. Native code rejects group replay and displays server retry history accurately.

## Policy and boundaries

- Three retries (four total submissions), exponential 1/2/4-second waits plus up
  to 250ms jitter; maximum cumulative wait 30 seconds.
- Valid Retry-After seconds or HTTP-date sets a minimum wait. Invalid headers or
  waits beyond the budget stop retries rather than retrying before the deadline.
- Explicit 429s only, including the audio service's structured 502/upstream-429
  envelope and direct embedded rate-limit refusals before text publication.
- No automatic replay of quota exhaustion, authentication failure, malformed
  results, network timeouts, lost streams, or partial output. A server-side daily
  allowance hold is not reclassified as a provider rate limit.
- Native retains admission permits and checks authority every 100ms in flight and
  during waits; cancellation/pause/connection changes stop resubmission. Server
  cancellation propagates; existing work deadlines and lease checks still apply.
- Success usage describes the successful submission. Earlier unknown billing is
  retained in retry diagnostics and, on the server, separate ledger reservations.
- Key verification, authentication, Firestore transaction retries, protocol probes,
  reading repair, explicit user retries and UI polling are different operations.
  They are not additional provider-backoff implementations.
- The raw server chat compatibility endpoint remains single-submission. Active
  SkellySpeak text work uses grouped operations. An arbitrary custom server must
  implement operation-owned retries itself; replaying its durable attempt IDs
  from the client would violate duplicate protection.

## Verification

- Native library suite: 488 passed, four ignored before the final additional
  transport tests. Shared engine tests cover maximum count, Retry-After, cancellation,
  persistence failure, partial output, quota exclusions and all three outcome types.
- Real localhost transcription fixture reproduces HTTP 502 with upstream 429,
  resubmits the same recording, then succeeds. Provider reason/ID survive; recording
  content and credentials do not enter the retry diagnostics.
- Server suite: 469 passed, seven emulator-only skips before final diagnostic
  refinements. Group test verifies only the rejected sibling retries and three
  distinct reservations remain for two successes plus one unknown refusal.
- Packaging allowlist verified with local sentinels; no upload was performed.
- Full-suite verification exposed older blanket-redaction fixture expectations and
  a missing Retry-After in the primary hosted error summary. Fixtures now identify
  the sensitive spans explicitly and assert useful reasons survive. The summary
  retains Retry-After again.

Final check results will be recorded below. A running desktop/native app must be
rebuilt/restarted for the new native retry owner; hosted group changes need deployment.

Final verification: native library suite **491 passed, four ignored**; server
suite **469 passed, seven emulator-only skips**. The exact wrapped transcription
fixture and exhausted-group summary regression pass. `git diff --check` passes.
No live provider requests or application restart were performed.

## Follow-up: misleading conversation-support error

Observed in the local attempt at 2026-09-21 15:02:02 UTC: `reply_explanations`
using `google/gemini-2.5-flash` returned an embedded upstream 429 with
`finish_reason: error`, 12 response bytes, zero reported tokens and zero reported
cost. The displayed “Conversation support: incomplete or oversized response”
came from feature validation, not an oversized output or a Japanese-language
validation rule.

Source correction: publication now recognizes the provider's error finish before
feature validators, showing the redacted provider reason. Partial response text
continues to be retained for inspection, along with request/model, usage and error
metadata. This does not change the existing policy against automatically replaying
partial output. The correction requires a native rebuild/restart to run; saved
historical attempt errors are not rewritten.

Verification: all eight coaching execution tests and five provider-response tests
passed, including a regression that preserves partial text, provider 429 and usage
metadata while excluding response content and reasoning from diagnostics. No live
provider retry or running-app verification was performed.
