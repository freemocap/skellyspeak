# Error recovery checkpoint

Implemented locally, September 25, 2026. No deployment.

## Behavior

- Shared error presentations support a visible Retry control outside collapsed
  diagnostics. Owners supply the action; presentation does not infer requests.
- Conversation work, coaching, reading help, speech playback, skill evidence,
  persona generation and drill generation connect those controls to their owners.
- Drill generation resumes at the failed batch using the original inputs and
  retains successful candidates. It does not restart successful batches.
- Rate-limit metadata, including a nested 429 in an error completion delivered
  with HTTP success, produces “Sorry, rate limited. Try again shortly.” Original
  error information and response metadata remain available. Quota exhaustion is
  not labeled temporary rate limiting.
- Existing bounded automatic rate-limit retries remain unchanged. The visible
  control requests a new attempt explicitly and blocks duplicate clicks while
  that action is pending.
- Microphone audio is volatile. Its error action is **Record again**, starting a
  new recording; it does not claim to resend discarded audio. Chat now displays
  microphone failures beside the composer, and Drill retains failed take details.

## Verification

The full UI suite passed before the final microphone recovery additions (1,248
tests), as did the native suite (616 passed, three ignored). Additional focused
tests cover nested rate limits, preserved diagnostics, retry double-clicks,
retry failures and resumption of partially completed drill batches. The native
regression reproducing a failed completion with nested 429 metadata passed.
Final checks passed: 98 focused UI tests including chat and Drill, TypeScript,
stylesheet validation and whitespace validation.

Live provider failures were not deliberately induced. Desktop interaction with
the final controls still needs a running-app check; automated verification is
not a claim that those controls were exercised in the desktop app.
