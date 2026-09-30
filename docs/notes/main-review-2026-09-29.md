# Recent main changes: review and fixes

Status: source review and implemented fixes; verification recorded below.

## Scope

Reviewed the five commits after `80ce2197`, through `3a95e18e`, with emphasis on
native changes, recording ownership, message submission and UI/native wiring.
The checkout started clean on main, matching the local origin/main reference.
Archive deletion was excluded from functional review. This is not a complete
audit of earlier changes or a running application acceptance test.

The native changes added manual transcription retry and changed new conversation
direction to Coach's choice. The server change in this range was CSS only.

## Fixed findings

- **Draft loss on Retry.** Retrying an earlier failed message cleared a newer
  composer draft immediately, and again after acceptance. Retry now submits the
  held message independently of the composer. The conversation regression test
  checks that the newer draft survives both moments; it failed before the fix.
- **Stale transcription completion overwrote newer retry audio.** Initial
  transcription completion unconditionally replaced the shared failed-take slot;
  a failed retry also unconditionally restored its old take. Capture now selects
  the latest take identity under the slot lock, and completions only update that
  identity. Tests cover older success, older failure and failed retry completing
  after a newer take has been selected and retained.
- **Missing diagnostic command identity.** The retry command was registered in
  native startup but omitted from generated diagnostic contracts. Regenerated
  contracts with the existing Rust exporter; no manual generated-file edits.
- **Two native tests hung indefinitely.** Retry fixtures changed the destination
  URL, which correctly failed recording destination validation, then waited for
  a request that could not arrive. They now reuse one listening address across
  responses. The local fixture bounds connection acceptance so missing dispatch
  fails rather than hanging. A separate test verifies that changing destinations
  still refuses retry, retains audio and performs no provider work.
- **Validation failures.** Formatted the retry code and made the learner-focus
  test explicitly select no conversation recommendation. Its old reliance on
  the default contradicted the newly added Coach's choice default test. The
  product default remains unchanged by this review.

## Verification

- Native library: 686 passed, 4 ignored; no live provider calls were enabled.
- Recording execution suite: 11 passed, including the new race and destination tests.
- Fast validation passed: Rust formatting, localization, diagnostic policy,
  style rules, validation types and 13 tooling regression tests.
- Generated contract freshness and UI TypeScript checks passed.
- Final full UI run with four workers: 1,465 passed across 224 files, zero failures.

An initial unrestricted UI run had a Drill microphone-error timeout under load;
that suite passed in isolation and the next full run with four workers passed
all UI behavior tests. That run still caught the diagnostic contract omission,
which was then repaired. The test environment reports unavailable canvas drawing;
these runs do not establish rendered waveform correctness.

The already-large conversation coordinator and recording implementation/test
files were kept in place for these focused correctness fixes. Splitting those
owners remains a separate pass; no unrelated restructuring was included.

## Limits

No live microphone, desktop/mobile visual acceptance, paid inference, deployment,
commit or push was performed. Destination changes intentionally invalidate a
held recording's retry; this review does not introduce automatic rerouting.
Retry uses the existing shared recognition cache and admission checks; reuse is
conditional on cache availability, not an unconditional no-additional-cost promise.
