# v2.2.0 CI and release failures — 2026-09-21

## Observed failures

Release run 35618674754 and CI run 35618674315 failed on the v2.2.0
commit bd2ebd4. The frontend localization audit found eight obsolete messages.
Windows Clippy rejected a nested conditional in hosted error sanitization.
The release Android preflight timed out downloading Gradle 8.14.3, before
application compilation. Server deployment run 35618635109 succeeded; the iOS
distribution workflow also succeeded. The main release did not publish.

## Implemented source corrections

- Removed the eight unreferenced messages from all seven locale dictionaries,
  after checking the revised message, reward, sharing and assessment callers.
- Collapsed the hosted service-ID conditional without changing validation.
- Ran Rust formatting across the committed source to satisfy the later CI gate.
  Most changed Rust files contain formatting only.
- Fixed three additional test lint failures: read complete HTTP request headers
  in the hosted fixture, borrow the spelling slice, and remove a one-item loop.
- Aligned the older romanization helper test with the content validator’s
  existing three-example minimum. New schemes contain three or four examples;
  every configured example must still appear in generated guidance. The first
  full native run passed 508 tests and exposed this stale five-example assertion.
- No Android application change was made for the transient distribution download
  timeout. A fresh CI run must verify that download and the subsequent build.

## Verification

UI: 1,042 tests passed. Localization tests/audit, benchmark tests, Android runner
checks, dependency/style reports, documentation links/tests, style validation,
release tests, iOS tooling typecheck, logging checks/tests and production UI build
passed. Native Clippy (library and tests), generated contract check, benchmark
fixture check, formatting and diff whitespace checks passed.

Some Node subprocess checks and native localhost HTTP fixtures were blocked by
the filesystem/network sandbox; Node checks passed when rerun with the required
access. The final full native suite passed with localhost access: **509 passed,
zero failed, six intentionally ignored**. Final Clippy and formatting checks pass.

## Release state

The user authorized one commit and a patch release. These corrections and the
v2.2.1 version bump are prepared together for that commit. CI on the pushed
commit must pass before publishing the new tag. The existing v2.2.0 tag remains
unchanged; rerunning it would use its original failing source. Release completion
is determined by GitHub Actions, not by this preparation record.

## Clarification: UI messages versus added languages

Rechecked after the user's concern: no language configuration or font was removed
or modified by these CI fixes. Japanese, Korean, Vietnamese, Indonesian, Turkish,
Russian, Ukrainian and Cherokee are all tracked in commit 377aa6d and v2.2.0.
The two added-language registry/Unicode tests and bundled guidance test pass.
The loader discovers the language YAML files; the language browser uses the shared
catalog rather than a separate hand-maintained list.

The eight removed dictionary keys were UI prose: one generic log-sharing error,
two fragments of the old edit warning, three old reward explanations, one reward
map button label, and one superseded Jev description. Comparison with bdc05d8
confirms their callers were already removed or replaced in the pushed source.
Log sharing now displays structured errors; the edit warning preserves coach
history; assessment help describes the quote-extraction path. This cleanup removes
unused dictionary entries, not any of the eight new learning languages.
