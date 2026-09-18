# Release readiness review — 2026-09-17

Status: investigation and locally verified fixes. **Not ready to publish a new tag.**
Baseline: `d5633dbe6f0709cb8948fc96c072375af59cbba5` on `main`; initial working tree
was clean and the remote main reference matched. No version bump, commit, push,
tag, workflow dispatch or deployment was performed. Fixes below are uncommitted.

## Release tooling recovered

The September 15 cleanup (`ba688fb`) moved `scripts/release.ts`, version helpers,
iOS helpers, development launchers, benchmarks and device tooling into `tools/`.
UI-only tooling subsequently moved into `ui/tools/`. Two obsolete reading-preview
files were deleted in the initial move. There is no reason to restore the old
flat scripts directory or duplicate its entry points.

Added `npm run release -- ...` and `npm run release:test`. Hardened the script to
reject extra positional arguments, prereleases unsupported by publication, leading
zero versions and Android version-code overflow/collisions. Every release now
starts at the exact fetched `origin/main`, and branch/tag pushes explicitly target
origin atomically. Existing-tag errors advise choosing a new version rather than
suggesting deletion of published tags. CI runs the release preflight tests.

The script still does not query GitHub CI or signing credentials. Check green CI
before use. Its bump path invokes Cargo to update the package lock entry; inspect
that change. Dry-run fetches remote state but does not bump, commit, tag or push.
A dry-run in the modified checkout correctly refused the dirty working tree.

Remote `v1.21.4` already exists at `114bc1a5`; the current manifest is also 1.21.4.
Do not reuse that tag. The next version is the user's choice (1.21.5 is an available
patch candidate as of this review). The latest published release returned by
GitHub was v1.21.2.

## GitHub evidence and unresolved gates

- [Current CI](https://github.com/freemocap/skellyspeak/actions/runs/35223530757)
  was still in progress at the final query, with frontend, server, docs and
  Android setup already failed. iOS simulator and Linux checks passed. This run
  does not contain the local fixes below.
- [Previous completed CI](https://github.com/freemocap/skellyspeak/actions/runs/35197769694)
  also failed Rust library tests, server tests, docs build and Android setup.
  Windows Rust failure details remain unverified.
- [Latest server deployment](https://github.com/freemocap/skellyspeak/actions/runs/35128740993)
  passed the container startup/authentication test but failed pytest; deployment
  was skipped. The last successful deployment found was
  [34905345925](https://github.com/freemocap/skellyspeak/actions/runs/34905345925)
  at `b64da033`. Substantial server source and layout changes followed it.
- [v1.21.4 release](https://github.com/freemocap/skellyspeak/actions/runs/34790927308)
  passed reusable CI, Android, both macOS and both Linux builds, but the Windows
  Tauri build failed and publication was skipped. The annotation shows an older
  pre-reorganization command using `src-tauri/` paths. It does not establish a
  signing failure specifically; the root cause needs the full log/current run.
- [v1.21.4 iOS distribution](https://github.com/freemocap/skellyspeak/actions/runs/34790927113)
  built and attached the IPA, then failed with **Set APPSTORE_ISSUER_ID repository
  variable**. Inspect the remaining App Store configuration before rerunning;
  credential contents and current repository settings were not accessible.
- Android currently fails inside the pinned setup-android action, before app
  compilation. Public annotations do not identify the cause. Actions also report
  deprecated Node 20 runtimes and setup-java v4. Do not assume those notices alone
  explain the failure or blindly refresh all pins.

Public GitHub APIs supplied run/job state and annotations. Full job-log requests
returned HTTP 403 without authenticated GitHub access; `gh` is not installed.
No claim is made that Windows signing credentials or Android/iOS distribution
secrets are currently usable.

## Implemented fixes

1. Server logging subprocess test now selects the repository root explicitly.
   Before the fix it passed from the root but failed from `server/` (CI's working
   directory) with an import failure. The entire server suite now passes there.
2. Reward-flight test now expects the current 50-XP milestone: 10 pending/20 saved
   XP produces 20% before arrival and 40% after arrival. Product behavior is
   unchanged; the former 30-XP expectations were stale.
3. Coaching website pages link to repository working notes using GitHub URLs.
   Docusaurus cannot publish relative links outside its docs plugin; the broken
   links previously failed the production build. Broken-link checking stays on.
4. Deploy-server now runs the existing cloud-upload boundary checker in its own
   test gate, after gcloud installation and before Firestore emulator checks.
   Manual deployment therefore also gets this check rather than relying on CI.
5. Release/npm documentation and stale docs-security command paths were updated.

## Local verification

| Check | Result |
| --- | --- |
| Frontend suite | 719 passed across 115 files |
| Frontend production build | Passed; large main chunk warning remains |
| Server suite from `server/` | 306 passed; 7 Firestore emulator tests skipped |
| Native library tests with localhost permission | 352 passed; 16 ignored; queue-budget test excluded |
| Queue-budget test | Stopped after over five minutes in initial full run; incomplete |
| Rust Clippy, library and tests, warnings denied | Passed |
| Rust formatting | Passed |
| Generated Rust/UI contracts | Passed |
| Release/version tests | 13 passed |
| iOS workflow/verifier tests on macOS | 2 passed |
| Docs behavior tests / image-parser mitigation tests | 28 / 7 passed |
| Docs production build | Passed after link fixes |
| Documentation links / style checks | Passed |
| Actual gcloud upload manifest with synthetic private sentinels | Passed |
| Root npm audit | 0 reported vulnerabilities |
| Separate docs npm audit | 1 high-severity dependency: image-size |
| Git whitespace check | Passed |

The initial sandboxed Rust run could not bind loopback HTTP fixtures. Those
failures disappeared in the rerun with localhost permission. The queue-budget
test was already running separately; it fills the 512-operation limit through
repeated conversation creation/snapshots. Its duration warrants investigation,
but this review does not establish a deadlock or successful completion. All
processes launched for that incomplete run were stopped.

Docker is unavailable locally. Container and Firestore emulator checks still
need a fresh GitHub run. No signed release build, updater installation, mobile
sign-in, paid provider inference or authenticated hosted-chat smoke test was run.

## Server and deployment readiness

Read-only production probes returned `{"status":"ok"}` from `/health` and HTTP
401 from unauthenticated `/v1/me`. This verifies basic liveness/auth rejection,
not provider health, current revision identity, Firestore availability or the
new code. Live GCP IAM, WIF permissions and secret state were not inspected.

Source review confirmed the current Docker/import allowlists and module entry
points are covered by tests and the real gcloud upload-manifest check. Deployment
still builds an immutable digest, creates a no-traffic candidate, checks exact
revision/digest/readiness, provisions retention and verifies 100% traffic after
promotion. No runtime security policy was relaxed by these changes.

**Pushing these changes to main triggers production server deployment**, because
both the server test and deploy workflow changed. That requires explicit deployment
authorization. To validate first without deployment, use a pull request branch:
CI and the deployment test/container jobs run there; the deploy job is main-only.
After an authorized deployment, check authenticated diagnostics and one hosted chat.

## Drift and debt to address separately

- The docs image-size pin retains two upstream infinite-loop advisories. The
  existing fingerprinted local bounds mitigation and hostile-input tests passed;
  npm audit still reports the package as high severity. It now advertises a fix
  as available. Review the upstream fix against both advisories before retiring
  the local patch. Do not use a broad audit-fix command.
- The size inventory is a dated snapshot. `native/src/model.rs` is now 1,064 lines,
  `server/app/main.py` 814 and the conversation page 717. Follow the agreed
  one-original-file-at-a-time process; no speculative split was performed here.
- The frontend main bundle is approximately 1.06 MB uncompressed. Consider focused
  lazy-loading review after release gates are healthy.
- README claims that internal organization is still future work are stale, and
  many historical links remain. A complete documentation content audit is still
  outstanding; fixing the broken build does not finish it.
- Action runtime/pin modernization, authenticated log investigation and the
  slow queue-budget test deserve focused follow-up. No complete dependency
  vulnerability audit of Python/Rust or exhaustive application security review
  was performed.

## Before a new tag

Get fresh green CI (including Windows Rust and Android), fresh deployment
preflight/container/emulator results, and resolve or verify the previous Windows
release build failure. Configure App Store issuer/settings if TestFlight is part
of this release. Authorize the main push/deployment separately, then verify hosted
behavior. Choose a version newer than 1.21.4 and invoke the release script only
from the clean, verified main commit. Local fixes alone are not release approval.

## Follow-up: TestFlight intentionally disabled

At the user's request, the TestFlight job and manual upload input are commented
out. Active iOS distribution ends after the signed IPA is built, verified and
attached to its tagged release. App Store Connect configuration is deferred and
is no longer a gate for this workflow. The historical failure above remains a
record of the earlier run. Tests verify only the build and attachment jobs are
active and no App Store credential references remain active.

The user's shell selected Node 22.8.0, which cannot execute the TypeScript release
entry point directly. Run `nvm use` from the repository root to select the existing
`.nvmrc` requirement (Node 24), then retry the release dry-run. No shell or global
Node configuration was changed.

## Follow-up: v2.0.0 Rust check and release queue

The authenticated GitHub CLI became available for this follow-up. The cancelled
[v2.0.0 run](https://github.com/freemocap/skellyspeak/actions/runs/35227348259)
shows Android setup failing at 13:29:20 UTC, independently of Rust. Rust's library
test step ran from 13:32:33 until manual cancellation at 14:22:53 (50m20s).
Matching slow-test warnings to subsequent results gives 350 passing tests, no
reported failed tests, and exactly one slow test without a completion result:
`queue_budget_counts_chat_coach_and_paused_work_transactionally`. Five other tests
with over-60-second warnings subsequently passed. The last passing test was
reported around 13:39:16; the log then remained quiet until cancellation.

The unfinished test fills a 512-operation budget by repeatedly creating a new
conversation, reading the workspace snapshot, and accepting a coach turn. Its
while loop has no iteration/progress assertion or deadline. Errors unwrap and
fail; this is not a retry-on-failure loop. Repeated full command/snapshot work is
a plausible performance cause, but no profiler or completed isolated Windows run
has established slow progress versus a true hang. Do not call the suite green.
This is the same test left unverified in the earlier local review.

`release.yml` has the shared `skellyspeak-release` concurrency group with
`cancel-in-progress: false`. The failed Android job does not cancel independent
Rust jobs, so the old run retains the slot until all jobs finish or the run is
cancelled. The v2.0.1 run was created at 14:15:36 and started jobs around 14:23:00,
immediately after the older run ended at 14:22:59. This explains the queue without
attributing the Rust stall to Android. At the final job query, v2.0.1's Rust test
step was in progress, having started at 14:31:03 UTC; the preceding checks passed.

Recommended follow-up: profile and bound this test's fixture construction while
preserving capacity/retry/cancellation coverage; add an explicit test-step/job
timeout so one stalled check cannot retain the release slot for hours. Keep
release publication serialized rather than enabling cancellation in the middle of
artifact publication. No workflows were cancelled, tags changed, or test/runtime
code modified in this diagnostic follow-up. Unrelated in-progress translation
changes were left intact.

## Implemented: explicit development release mode

The user requested a faster development release route while the app is pre-public.
`npm run release -- patch --skip-tests` now writes an annotated tag with the exact
`SkellySpeak development release: skip CI suite` marker. Normal lightweight tags
and ordinary annotations retain full CI. Release mode selection runs before the
reusable CI workflow; CI records the explicit bypass and skips its eight expensive
jobs only when called with that opt-in. Branch/PR CI inputs default to full checks.
Manual Release dispatch requires an existing tag and has a default-false
`skip_tests` input. Manual full validation overrides a development tag's marker.

The release draft still requires the validation gate to succeed, and publication
still requires the entire desktop matrix plus Android to succeed. Version/tag
checks, main ancestry, signatures, updater checks, artifact presence and the guard
against replacing a newer release remain. Release notes identify the bypass.
This mode publishes Latest/update feeds, not a separate prerelease channel.
iOS retains its independent signed-IPA build/attachment workflow.

Rust library-test steps now have a 15-minute limit and Rust jobs a 30-minute limit.
This bounds stalls but does not fix the slow queue-budget test. These limits and
new inputs do not alter already-running or old-tag workflows. No active release
was cancelled or redispatched, and no version/tag/publication was created here.

Verification: 15 release/version tests passed, including actual annotated versus
lightweight tags, manual opt-in/override, and dry-run/no-push execution against a
disposable local remote. Two iOS workflow/verifier tests passed. The release-mode
module passed strict TypeScript checking. Actionlint 1.7.7 accepted both modified
workflows (shellcheck/pyflakes integrations disabled); Git whitespace checks passed.
The GitHub execution path has not yet run with these changes. Changes remain local
and uncommitted, alongside preserved unrelated user work.

## v2.0.2 skip-tests checkout regression

The user correctly invoked `npm run release -- patch --skip-tests`. The remote
annotated tag contains the exact development marker. The version-job log for
run 35249750060 nevertheless shows checkout first fetching tags, then fetching
`+e8911e53b5c2714de028cadf136665428f9b5db4:refs/tags/v2.0.2`, replacing the local
annotated tag reference with its peeled commit. The selector consequently printed
`Full release: CI suite required.` This was an implementation defect, not misuse
of the release command.

The selector now fetches the canonical remote tag into a separate local metadata
reference and verifies its peeled commit matches HEAD before reading the marker.
It does not rewrite a release tag; failed fetches or mismatches fail explicitly.
Manual dispatch uses its explicit input without needing annotation recovery.
Regression tests reproduce checkout flattening the local tag while preserving the
remote annotation, and reject metadata from another commit. All 15 release tests,
strict TypeScript checking of the selector and Git whitespace checks passed.
The fix remains local and uncommitted.

The cancellation request for the test-blocked v2.0.2 run succeeded. Restarting that
same tag with manual `skip_tests=true` was rejected by automatic approval review
because workflow dispatch can publish artifacts and explicit authorization to
restart/publish v2.0.2 was required. Approval was requested; no replacement run
was dispatched at this point. No tag or version was changed.

The user subsequently explicitly authorized restarting v2.0.2 with tests skipped.
Dispatched [run 35251054207](https://github.com/freemocap/skellyspeak/actions/runs/35251054207)
on the existing v2.0.2 tag with `skip_tests=true`. Verified the version and mode
gates passed, all eight reusable CI jobs (including Rust) were skipped, and the
release draft step succeeded. Desktop/Android artifact builds are running or
queued; publication has not yet been verified. No tag or version was changed.

## v2.0.2 target failures after manual test bypass

Inspected run 35251054207 target logs. Three targets compiled and bundled, then
failed inside tauri-action while uploading GitHub release assets:

- Linux x64: `other side closed` while uploading the amd64 AppImage, after
  successful DEB/RPM uploads.
- macOS Intel: `Error saving asset` while uploading the updater tarball, after
  signing/bundling and successful DMG upload.
- Linux arm64: GitHub returned its HTML `Unicorn!` error page while uploading the
  ARM64 DEB.

These are upload/service/connection failures, not reported Rust compilation
failures. They do not establish a platform-wide GitHub incident or its precise
cause. The later independent artifact-verification step did not run for these
failed jobs. Android and macOS Apple Silicon jobs passed. Windows remained in
its signing preflight at the final query. The release remained a draft with
partial assets; publication was correctly blocked. No failed jobs were rerun in
this diagnostic turn. Once Windows settles, rerunning failed jobs is the immediate
recovery path. Separating build retention from upload retries would avoid repeating
successful compilation after transient upload failures in future workflows.
