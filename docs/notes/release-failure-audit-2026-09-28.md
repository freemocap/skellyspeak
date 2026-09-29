# Release failure audit — 2026-09-28

Status: completed investigation. Fast validation and CI ordering are implemented
locally in the follow-up below; the other recommendations remain proposals.

## Finding

Four of the ten most recent Release workflow runs failed. All four failed in the
reused CI suite, before desktop/Android release builds. Every failed tag also had
failed ordinary branch CI on the identical commit. The dominant problem is the
timing and enforcement of existing checks, not missing tests for these failures.

Three releases failed Rust formatting, two failed the unused-message audit, and
one failed UI tests (categories overlap). The localization failures were unused
catalog entries, not locale identifiers, missing translations or placeholder
mismatches. No signing, packaging or tag/version mismatch caused a failure in this
ten-tag sample.

## Evidence and scope

Used `gh run list`, `gh run view --json jobs,attempt`, `gh run view --log-failed`,
`gh release list` and read-only repository rules APIs against `freemocap/skellyspeak`.
Inspected job/step outcomes for all ten Release runs, failed-job logs for the four
failures, 70 recent ordinary CI run summaries, matching failed-job names, and logs
for three additional inconsistent or slow CI runs. Also inspected the matching
iOS distribute outcomes: all ten succeeded. All ten Release runs were push events,
attempt 1, and executed their validation jobs; this sample does not implicate the
explicit development-release bypass.

Local source baseline: `e736807e` (v2.6.1). Historical workflow comparison shows
the same relevant localization and formatting checks existed across this sample.
The audit did not rerun historical checkouts, inspect every successful job log,
or establish the underlying cause of intermittent tests. Results describe these
ten tags, not all releases.

| Tag | Release result | Failed checks / observations |
| --- | --- | --- |
| [v2.6.1](https://github.com/freemocap/skellyspeak/actions/runs/36495234906) | Success | All validation and release jobs succeeded |
| [v2.6.0](https://github.com/freemocap/skellyspeak/actions/runs/36490208277) | Failure | Localization usage audit: one removal candidate, `Speak reply`; Rust formatting in nine files |
| [v2.5.6](https://github.com/freemocap/skellyspeak/actions/runs/36361966222) | Success | Release CI passed; separate branch CI failed a Drill UI test on the same commit |
| [v2.5.5](https://github.com/freemocap/skellyspeak/actions/runs/36338365478) | Success | All validation and release jobs succeeded |
| [v2.5.3](https://github.com/freemocap/skellyspeak/actions/runs/36336944603) | Failure | Two existing UI tests: `element.showModal is not a function` |
| [v2.5.2](https://github.com/freemocap/skellyspeak/actions/runs/36333106879) | Success | All validation and release jobs succeeded |
| [v2.5.1](https://github.com/freemocap/skellyspeak/actions/runs/36286258567) | Success | All validation and release jobs succeeded |
| [v2.5.0](https://github.com/freemocap/skellyspeak/actions/runs/36284330796) | Failure | Localization usage audit: 49 removal candidates; Rust formatting |
| [v2.4.0](https://github.com/freemocap/skellyspeak/actions/runs/36207952901) | Success | All validation and release jobs succeeded |
| [v2.3.7](https://github.com/freemocap/skellyspeak/actions/runs/35950614858) | Failure | Rust formatting in microphone recording modules |

All six successful Release runs correspond to published releases. The four failed
tags remained drafts at inspection time. The independent iOS workflow can create
or populate a draft even when Release validation fails; a draft's existence is
not evidence that Release validation passed.

## Why existing checks did not prevent tags

### Tags were pushed before the preceding CI result existed

For all ten tags, ordinary CI on the tag's commit started at the same second as
Release, except v2.5.3, where it started one second earlier. This is consistent
with pushing branch and tag together. It is not a pre-tag validation gate.

For the four failures, ordinary CI on the immediately preceding source commit
started only 20–45 seconds before Release:

| Tag | Source CI started (UTC) | Release started (UTC) | Source CI finished (UTC) |
| --- | --- | --- | --- |
| v2.6.0 | Sep 28 22:04:05 | 22:04:50 | 22:09:31, failure |
| v2.5.3 | Sep 27 17:25:51 | 17:26:31 | 17:39:44, failure |
| v2.5.0 | Sep 27 01:02:22 | 01:02:42 | 01:07:41, failure |
| v2.3.7 | Sep 24 03:14:02 | 03:14:23 | 03:19:48, failure |

Matching branch CI: [v2.6.0](https://github.com/freemocap/skellyspeak/actions/runs/36490207377),
[v2.5.3](https://github.com/freemocap/skellyspeak/actions/runs/36336943730),
[v2.5.0](https://github.com/freemocap/skellyspeak/actions/runs/36284330151),
[v2.3.7](https://github.com/freemocap/skellyspeak/actions/runs/35950614198).
These show the same release-blocking checks failing. v2.3.7 branch CI also had a
Drill UI failure absent from its release run.

`tools/release.ts` verifies Git state, version and tag availability, but never
queries CI or runs validation before committing/tagging/pushing. README tells the
operator to check CI manually. The current main branch protection API returned
`Branch not protected`; the effective branch-rules API returned `[]`. This is a
current configuration observation, not proof of historical settings.

CI triggers on PRs and pushes to `main`/`rebuild`, not every feature branch push
without a PR. Local commits do not trigger GitHub CI. No committed local hook
workflow was identified. Personal hooks were not audited.

### Local verification is fragmented

- `npm test` runs the UI Vitest suite. It validates catalog parity, nonblank values,
  plural shapes and placeholders, but does not run the unused-message audit.
- `localization:check` only type-checks localization tooling. Its name does not
  mean that it validates the application catalogs.
- `localization:test` type-checks that tooling and tests synthetic checker inputs;
  it does not run the real-tree usage audit.
- `npm run build` runs `tools/check-languages.ts` through root `prebuild`, checking
  real catalogs, duplicate properties, source literals and catalog coverage. It
  still does not run `localization:audit -- --check`.
- The README's main Verification block omits the usage audit and localization
  tooling tests. Running that block can therefore miss a CI-blocking condition.

The usage audit deliberately reports *candidates*, based on conservative static
references. Missing references are not proof a dynamically constructed key is
unused. Review candidates; do not automatically delete translations to get green.
Conversely, an arbitrary textual reference can retain an otherwise unused key.

### Cheap failures are reported after slower work

In the frontend job, dependency installation and all UI tests precede the usage
audit. In the Rust job, clippy and exporters precede formatting. The formatting
steps took about two seconds in these failed releases but started 3–5 minutes
after the jobs began. Earlier failing steps also skip later checks, so one failed
job is not a complete inventory of defects.

### Test reliability is a separate gap

The v2.5.3 failures were in existing saved-word-help and Android-disclosure tests.
Commit `daea717d` added shared dialog visibility mocks and updated modal
expectations; v2.5.5 passed. This was already detectable with ordinary UI tests.

Two same-commit discrepancies warrant a focused investigation:

- [v2.5.6 branch CI](https://github.com/freemocap/skellyspeak/actions/runs/36361965835)
  could not find `Microphone test failure` in the Drill microphone-error test;
  Release CI on that exact commit passed.
- [v2.3.7 branch CI](https://github.com/freemocap/skellyspeak/actions/runs/35950614198)
  could not find the `Stop` button in the Drill playback test; Release's frontend
  job passed on the exact same commit.

These demonstrate inconsistent outcomes, not a proven timing or state-leak root
cause. Review async completion, media teardown, timers and shared mock/store resets.
Do not mask failures with automatic retries.

Separately, [CI on cda596fe](https://github.com/freemocap/skellyspeak/actions/runs/36495224873)
hit the 15-minute native-test step timeout, with multiple tests reporting over
60 seconds. That is the source parent of v2.6.1, not the identical commit. Its
failure should not be described as a reproduced product defect or conclusively
diagnosed runner problem. Measure test durations and resource contention before
choosing a timeout or concurrency change.

## Recommended changes, in order

1. **One fast validation command, used locally and by CI.** Include formatting,
   real catalog/source validation, unused-message audit, and localization checker
   tests. Keep compile-heavy contracts and full suites as separate required checks.
   Run cheap independent checks early and report every failure with a final nonzero
   exit status. Document the command in the main verification block. An optional
   local hook can call it; a hook alone cannot enforce remote release readiness.
2. **Require successful CI before creating a normal release tag.** Split version
   preparation from tagging: push the candidate version commit, wait for successful
   required CI on that exact SHA, then tag it. Recheck the candidate/ref before
   pushing the tag. Checking only the pre-bump parent leaves the newly created
   version commit unvalidated. Preserve the explicitly authorized development
   bypass, and keep release validation as defense in depth. Add gate tests for
   pending/missing/failed/cancelled/stale checks, API errors, changed SHAs and success.
3. **Enforce required checks on main.** Use repository rules and a clearly named
   aggregate readiness check. Treat missing/skipped expected jobs as not ready.
   Direct tag pushes also need protection or a controlled release entry point;
   a CLI guard alone is bypassable. Repository policy changes need a deliberate
   implementation pass; none were applied during this audit.
4. **Stabilize the identified tests and measure native test time.** Reproduce under
   CI-like concurrency, replace incidental timing with explicit async state, and
   verify repeated runs without retry-based success. Keep real-browser/device
   coverage for modal/media behavior that DOM mocks cannot establish.
5. **Test orchestration, not just individual validators.** Assert that the shared
   fast command is actually invoked by CI and pre-tag validation. Add a temporary
   fixture with a removed UI reference and retained catalog key and verify the
   aggregate command fails. Existing validator unit tests alone do not prove that
   a developer's usual command executes those validators.

These changes should move all four observed failures ahead of tag creation. They
cannot guarantee a signed release succeeds: platform packaging, credentials,
external signing services and runner/network failures remain release-specific
risks, although none caused the four sampled failures.

## Current-checkout verification

- `node tools/check-languages.ts`: passed; seven locales, 1,368 messages each.
- `node ui/tools/localization/usage.ts --check`: passed; zero removal candidates.
- `cargo fmt --manifest-path native/Cargo.toml -- --check`: exit 0; local environment
  emitted a path-canonicalization warning.
- Existing localization, saved-word-help and Android-disclosure suites: 29 tests
  passed across three files, run with Vitest from `ui/`.

At audit completion, no application code, workflows, repository settings, commits,
tags or releases had changed. The only repository addition was this investigation.
Full native tests, full UI tests and signed builds were not rerun for that audit.

## Implemented follow-up: fast validation and CI ordering

Added `npm run check:fast`, also invoked automatically by root `npm test` through
`pretest`. It runs Rust formatting first, then real localization source/catalog
validation and unused-key auditing, diagnostic policy, styles, validation tooling
type checks and regression tests. Independent checks continue after a failure;
the command preserves their output, reports failed checks and exits nonzero.
Each child process has a two-minute timeout; missing tools and process failures
also fail the gate. It performs no native compilation or dependency installation.

The reusable CI workflow now runs `fast-validation` before frontend, native,
server, docs and mobile build jobs. Android resource validation remains an
independent cheap job and is an additional prerequisite for Android compilation.
Checks moved to the gate were removed from their later positions; the frontend
job runs the UI workspace test command directly because the root pretest gate
has already passed. Existing full suites remain. Explicit development-release
skip semantics remain unchanged.

Five new regression tests exercise:

- The real localization CLI commands against a disposable tree: removing the
  final source reference fails even when all dictionaries still agree and a
  test file mentions the key.
- A placeholder mismatch and unused key reported in the same invocation.
- Nonzero subprocess exits and unavailable executables, with later checks still
  running and the aggregate process exiting nonzero.
- Real unformatted/formatted Rust fixtures, with the failed check leaving the
  source unchanged and requiring no compilation.
- Package/CI/release wiring, requiring expensive jobs to depend on the fast gate
  without an unconditional execution override, and retaining the release gate.

The language/source and usage CLIs accept an explicit fixture root; normal callers
continue to use the repository root. The validation type check includes the shared
locale validator; its type-only import now specifies the extension for Node module
resolution. No runtime localization behavior changed. Regression fixtures capture
expected error output so successful test logs do not resemble failing validation.

Verification of the follow-up:

- Final `npm run check:fast`: passed in **6.76 seconds** locally, including all
  **13** validation tests (five new, eight existing). CI runner startup, dependency
  installation and toolchain setup are additional time; no hosted timing is claimed.
- Root `npm test`: verified automatic fast validation, then **1,437 UI tests passed
  across 223 files**. The suite emitted DOM canvas-not-implemented notices; it
  does not verify canvas rendering.
- `npm run build`: passed TypeScript and production bundling; the existing large
  bundle warning remains.
- Documentation entry-point links and `git diff --check`: passed.

These changes are uncommitted and have not run on hosted CI. Pre-tag CI enforcement,
remote branch/tag rules, intermittent Drill tests and native-test timeout analysis
remain separate follow-ups. The independent signed iOS distribution workflow is
unchanged; this gate applies to reusable CI and therefore the main Release workflow.
No commit, tag, push, release, deployment or repository-settings change was made.
