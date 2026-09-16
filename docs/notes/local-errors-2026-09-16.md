# Local error investigation — September 16, 2026

Status: observed logs and read-only workspace inspection; no runtime fixes,
restarts, provider requests or data changes performed.

## Current failures

The latest captured turn (17:41 UTC / 13:41 EDT) contains successful partner
reply, both translations, both word-gloss operations, speech and local context
preparation. Its preceding transcription also succeeded.

- `coach_feedback`, Gemini 2.5 Flash: failed with “Coach observation rejected:
  incomplete or oversized output.” Usage was 5,770 input / 2,048 output tokens.
  `native/src/ai/transport/provider/payload.rs` hard-codes `max_tokens: 2048`,
  including structured requests. The observation validator rejects non-`stop`
  completion or more than 32,768 output bytes at this branch. Reaching the exact
  token cap strongly suggests truncation, but finish reason and output byte count
  are not retained in the attempt record, so this is an inference.
- `coach_reaction`, Gemini 2.5 Flash Lite: failed with “Partner reaction is
  incomplete or invalid.” Usage was 156 input / 145 output tokens. The validator
  uses the same error for non-normal completion, excessive bytes, JSON/schema
  decoding failure, blank fields and fields exceeding 400 characters. The saved
  evidence cannot distinguish these causes; token exhaustion is not indicated.

The latest server run reports both provider credential checks accepted (200),
successful transcription, and seven completed grouped operations with zero
server-reported item failures. This is compatible with the two native failures:
the server finishes transport/accounting before native domain validation decides
whether the result can be published. Connection health does not establish output
validity. Attempt token usage is preserved even when publication rejects output.

## Earlier, separate errors

Earlier server runs show local-session HTTP 401 refusals and Groq HTTP 403
refusals. Later diagnostic logging captured Groq's message: “Access denied.
Please check your network settings.” This does not identify the specific network
condition. The latest run accepts Groq credentials and transcribes successfully.
The current persistent-session implementation is documented in
`server-runtime-logging.md`; older saved errors saying every restart invalidates
tokens describe the former behavior.

Three frontend `check_access` validation errors occurred before the latest server
startup. Their redacted records do not establish the precise reason. A subsequent
server-side protocol/provider check succeeded.

## Repair targets and verification limits

1. Give structured coaching an explicit output budget appropriate to its schema,
   reviewed alongside server limits; verify complete observations against the
   validator. Do not simply accept truncated output or automatically retry it.
2. Split reaction/observation validation errors into useful reason categories and
   retain safe completion metadata (finish reason and byte count). Add focused
   regression cases for the actual failure branches before guessing a reaction
   format repair.
3. Distinguish provider completion from native publication failure in diagnostics.

No failed response bodies are retained in the inspected records. Exact reaction
output cannot be reconstructed from logs. Existing passing mock tests and server
HTTP success do not establish live model compliance with the native validators.

Evidence: private `.local/logs/` server/native runs from September 16, particularly
server run `server-1789580445511371000-7663`, native run
`native-1789580390515-7199`, and read-only queries of the current workspace's
`attempts`, `operations` and `transcription_attempts` tables. Private logs and
workspace contents were not copied into the repository.

## Implemented follow-up: native validation diagnostics

Added `inference_prepared` and `inference_validation` events to `native.jsonl`.
Join them using `attemptId` (or `operationId`); these UUIDs also identify the
workspace attempt/operation records. Events distinguish transport failure from
native validation rejection. `validationAccepted` describes validation, not a
committed publication: the event precedes the existing database commit.

Preparation records include operation kind, route, app version, requested-model
hash, assembled system-instruction hash, schema hash, captured configuration and
construct-registry hashes, current build configuration hash, captured/build match,
candidate count, prompt byte count, message count and configured output-token cap.
Completion records include allowlisted finish reason, output bytes, input/output
tokens, whether reported output tokens reached the cap, actual-model hash, error
code, fixed domain reason and a structural inspection report where a schema exists.
Hashes identify changes without persisting prompt, model-name or response text.
Missing usage remains null. Unknown finish reasons use `other`.

The structural inspector reports invalid JSON (category/line/column), missing
fields, unexpected fields (without their names), type/enum mismatch, string bounds
and item bounds. Paths contain only schema-owned field names and numeric array
indices. It is a bounded diagnostic inspector, not a replacement JSON Schema
validator; `no_structural_mismatch_detected` does not establish semantic validity.
Rust decoding and all existing source/evidence/publication checks remain authoritative.
Observation/reaction decoding errors now expose these safe locations in saved
attempt errors; reaction text-field failures identify the specific field.
Non-normal completion and oversized output have separate errors.

Two inspected prompt inconsistencies were corrected:

- Shared assessment guidance referred to a `correction` field absent from the
  observation response. It now directs corrections to the task's response schema
  without prescribing a field across different tasks.
- The reaction instruction could be read as requiring translation of `kind`.
  It now explicitly keeps that enum unchanged and localizes only prose fields.

Neither inconsistency is proven to have caused the historical errors. The 2,048
output-token cap is unchanged; its value now has one exported owner used by the
payload and diagnostics. No automatic retry, relaxed validation, raw-response
capture or workspace migration was added. No live inference was requested.

After rebuilding, reproduce the failing action and locate `inference_validation`
with `validationAccepted: false` in the latest native log. Follow its `attemptId`
to `inference_prepared` to compare the content/schema/instruction fingerprints.
The running Tauri development watcher was observed rebuilding as source changed;
this is not manual verification of a fresh conversation or its provider output.

### Verification of the follow-up

- Full native suite with localhost mock-server permission: 365 passed, one ignored,
  one expected content-baseline failure. Regenerated that fixture, verified its
  only semantic changes are the 121 copies of the corrected assessment sentence,
  and preserved existing JSON ordering. All 21 configuration tests then passed.
- New diagnostics tests verify durable event writing, attempt correlation,
  truncation metadata, safe field paths, and exclusion of private output/credentials.
  Reaction and observation tests check schema enums against Rust decoding and
  distinguish malformed JSON, missing fields and non-normal completion.
- Clippy (`--lib --tests`, warnings denied), Rust formatting, content inspection,
  generated-contract check, Node 24 language checks and whitespace checks passed.
- Initial sandbox-only run could not bind the mock HTTP sockets; the permissioned
  run passed those tests. No real-provider generation was performed.

## Follow-up: coaching task audit

The user requested a prompt/role audit before expanding token budgets. The
[coaching prompt audit](coaching-prompt-audit-2026-09-16.md) reconstructs the latest
failed request and identifies the broad candidate set and mandatory prewritten
help as repair targets. Its proposed smaller help/evidence contract supersedes
the earlier suggestion to begin by increasing the coaching output budget. No
behavior changes were made during that audit.
