# Direct-provider rate-limit retries

Status: implemented and automatically verified; no deployment or live-provider
verification. Authorized by the user's request for bounded exponential retries of
transient failures. This is a narrow exception to the previous no-automatic-retry
behavior, not a general retry policy for all AI work.

## Behavior

- Scheduled conversation text operations on the direct OpenRouter route retry
  explicit HTTP 429, single-choice HTTP-200 completion errors with code 429 and
  no text, and streamed provider errors with code 429 before text arrives.
- At most three retries after the first request. Delays are 1, 2 and 4 seconds plus
  0–250 milliseconds jitter. Numeric or HTTP-date Retry-After takes precedence.
  Cumulative scheduled waiting cannot exceed 30 seconds; an excessive or unreadable
  Retry-After stops automatic retry rather than sending early.
- Error prose never drives retry classification. Schema/evidence validation errors,
  unknown network outcomes, partial text, authentication errors and other status
  codes retain their existing failure behavior. No new retries are introduced for
  hosted/grouped requests, audio, or standalone reading/persona-generation paths.
- The scheduler rechecks active operation, access destination, credential identity
  and holds before submission and during waits/in-flight work. Cancellation stops
  further submissions. The captured request stays fixed. Admission capacity remains
  occupied during backoff, so retries do not create additional simultaneous work.
- HTTP rounds stay in the original durable attempt. Before each wait, persist the
  refusal and its redacted provider metadata, scheduled time and delay. The
  `automatic_retries` diagnostic list survives final success, failure or revocation.
  Counts identify scheduled retries, including one cancelled before submission.
  Restart reconciliation retains diagnostics and never restarts interrupted work.
- Embedded provider errors with no text now become provider errors before domain
  validation. Partial completions still retain their text for inspection and are
  not automatically retried. Request bodies and credentials are not included in
  retry metadata.

## Owners and verification

Application orchestration: `native/src/application/rate_limit_retry.rs`, invoked
from the scheduler. Durable receipt update:
`native/src/conversations/execution/retry_diagnostics.rs`. Provider envelope
recognition: `native/src/ai/transport/provider/response.rs`. A small `httpdate`
dependency parses standard Retry-After dates; Cargo metadata and lockfile agree.

- Full native library suite: 475 passed, 2 intentionally ignored.
- Clippy for library/tests with warnings denied: passed.
- New coverage: exponential delay/cap, jitter bounds, Retry-After seconds/date and
  wait budget, strict error classification, partial-text refusal, eventual success,
  exhaustion, revocation during waiting, persistence failures, and a real loopback
  HTTP-200 embedded-429 followed by success with a persisted redacted receipt.
- Initial sandbox run could not bind localhost. The suite passed with localhost
  test permissions; no real provider requests were sent.
- No native app restart or live rate-limit incident was used as verification.
