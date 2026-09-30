# CI fixes and patch preparation — 2026-09-30

Status: source fixes implemented locally; version 2.9.1 prepared. No commit,
tag, push or release has been made.

## Findings

The latest [branch CI](https://github.com/freemocap/skellyspeak/actions/runs/36754487864)
on `c4a8a2f0` fails at `npm run check:fast`; dependent build jobs are skipped.
The preceding branch run and [v2.9.0 Release](https://github.com/freemocap/skellyspeak/actions/runs/36748309366)
also fail that step. Local execution on the latest checkout reproduced four
unused translation keys in every interface catalog. Source and content searches,
plus review of activity labels and message feedback, found no remaining caller.
Removed only those four retired revision-status keys from all seven catalogs.

The independent [v2.9.0 iOS run](https://github.com/freemocap/skellyspeak/actions/runs/36748309161)
fails at `npm run build`. Its annotation reports a zero-length tuple indexed at
zero. Local production build reproduced TS2493 in `ActivityGraph.test.tsx`:
the argument-free mock implementation inferred an argument-free call signature,
but the test inspects the options passed to `fitView`. Typed the mock with the
actual graph API method type and removed the redundant options cast.

Evidence consists of public workflow/job outcomes and check annotations, local
reproduction and source inspection. Full hosted job logs were not retrieved.

Full local UI testing then exposed a third failure hidden behind the fast gate:
`TargetText.test.tsx` expected pronunciation suppression when saved romanization
exists, but inline glosses had started conditioning suppression on the language's
romanization capability. Restored the shared saved-field rule already used by
the word-help popup and documented in the
[reading settings decision](conversation-ui-cleanup-2026-09-20.md#task-7--reading-settings-consistency).
This preserves saved data and applies to all languages, without an override.

## Version and release handoff

Updated the authoritative `native/Cargo.toml` package version and its matching
`native/Cargo.lock` entry from 2.9.0 to 2.9.1. No dependencies changed.
After committing and pushing these changes and checking CI, use the prepared
version release path (`npm run release -- current`), rather than another patch
bump, to release 2.9.1. Tagging and publishing remain with the user.

## Verification

- `npm test`: passed the fast gate (including 13 validation tests), then all
  1,642 UI tests across 253 files. Existing DOM canvas notices remain; these
  tests do not establish actual canvas rendering.
- `npm run build`: passed TypeScript and production bundling after the final
  source edit. The existing large-bundle warning remains.
- `npm run release:test`: all 16 tests passed.
- Locked offline Cargo metadata: accepted the matching 2.9.1 package version.
- Documentation entry-point links and `git diff --check`: passed.

The sandbox initially prevented the bundler from resolving its configuration;
the successful build and UI test runs used approved execution outside that
filesystem restriction. Native/server suites, device inspection, hosted CI and
signed platform builds were not rerun. Hosted validation requires the subsequent
push and is not claimed green for these uncommitted changes.

## Follow-up: v2.9.2 CI failures

The user subsequently committed the earlier fixes and prepared v2.9.2.
[CI on 83c8351f](https://github.com/freemocap/skellyspeak/actions/runs/36755822935)
passed fast validation, Linux compilation, server tests, docs and both mobile
builds, but failed Windows Clippy and the UI suite. The earlier local verification
did not include Clippy; the fast gate is not a replacement for that check.

Local Clippy reproduced three errors in speech streaming code: constant-size
byte chunks, a nested condition and a manual divisibility check. Applied the
equivalent typed-chunk, chained-condition and divisibility forms without
changing bounds, lock scope or return behavior. The README's broader Clippy
command also found an unnecessary clone in an effort test; used a borrowed slice.

The UI annotation identifies the 0.25x scrub-reader case exceeding five seconds.
The preceding branch run and the release run on the same application source
passed frontend validation. Locally the isolated eight-test file took 2.85
seconds of test time. Its per-sample loop made hundreds of thousands of matcher
calls. It now still inspects every output sample, but accumulates the minimum
forward step and maximum destination overshoot and asserts those bounds once.
NaN propagates to failing bounds; marker, terminal position and silence checks
remain. No retries, timeout increase, rate reduction or sample skipping were
introduced. Isolated test time fell to 36 milliseconds on the same machine.

Updated the working agreement to inspect all failed jobs and verify downstream
checks that an earlier failure skipped. Native edits require Clippy and native
tests, in addition to the fast gate. This follow-up does not change versions,
tags or release workflows.

Follow-up verification is in progress; hosted CI has not run these local edits.
