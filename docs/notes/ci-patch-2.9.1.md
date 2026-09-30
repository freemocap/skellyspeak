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
