# Response observability implementation — September 18, 2026

Status: implemented in source. Local verification is recorded below. This does
not describe a deployed server or a restarted desktop application.

## Implemented behavior

- Server provider errors (including HTTP-200 error envelopes) carry sanitized
  metadata through grouped operations, streaming and audio responses. Connection
  checks retain provider reasons. Validation failures retain safe paths and types.
- Direct native HTTP adapters read bounded error bodies and retain status, useful
  headers, provider codes and reasons. Service errors retain their reviewed
  diagnostic envelope; arbitrary generic service detail remains redacted.
- Completion, transcription and speech decoders retain metadata independently of
  whether content validates. Errors identify contract stage/location/expectation.
  Partial diagnostics do not become accepted content or confirmed billing totals.
- AppError and chat, speech, transcription and persona-generation receipts carry
  diagnostics. Schema 21 persists them across workspace reopen. Generated UI
  contracts expose them without inventing a second response schema.
- Activity, generation, connection checks and fault UI expose expandable response
  details. Browser playback and recording failures retain safe error name/code and
  a specific explanation instead of a boolean or generic failure.
- Frontend/native diagnostic records preserve structured details. Native logs and
  panics retain code locations. Server internal failures retain bounded exception
  cause types and source locations without exception messages, locals or source text.

## Privacy and bounded retention

Known request text and credentials are scrubbed where available. Content fields,
credential fields, arbitrary body text and unclassified strings have explicit
redaction markers. Public permission/model identifiers, correlation IDs, usage,
cost provenance, timing, rate limits and additional numeric/boolean metadata are
retained. Structured metadata is bounded by depth, fields and item counts; error
bodies are capped. Redaction, truncation and unreadability are explicit.

This is deliberately not a promise to retain arbitrary provider prose or every
unknown string: those fields can contain credentials or learner content. Future
provider fields need sensitivity classification before retaining string values.
Transport and content validation remain strict; no automatic retry was added.

## Verification

- Server: 377 passed, 7 skipped (external integration prerequisites).
- UI: 742 passed across 117 files; an additional receipt-detail regression passes
  in the six-test LiveActivity suite. Production TypeScript/Vite build passes.
- Native: 387 passed, 16 ignored, two pre-existing exclusions: starter-persona
  inventory expectation and the long-running queue-budget test. The full exercised
  suite includes local HTTP fixtures. Clippy with warnings denied and generated
  contract checks pass. Focused diagnostics checks also cover the final header
  retention adjustment.
- Tests cover provider reasons and quoted identifiers, credentials/content removal,
  request correlation, partial completion receipts, persistence across reopening,
  custom-server error redaction, browser media identity and UI receipt details.

## Running the changes

Rebuild/restart both application and server together for the coordinated error
contracts. Schema 21 requires Factory Reset for older development workspaces;
no migration or data reset was performed here. Nothing was deployed, committed
or pushed as part of this implementation.

## Scope limits

The work follows the AI/response paths in the original audit. It is not an audit
of every storage, update, operating-system or third-party library error. Existing
large modules were extended at their owning boundaries rather than reorganized;
large-file decomposition remains a separate task.
