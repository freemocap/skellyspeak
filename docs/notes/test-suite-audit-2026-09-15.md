# Application test suite audit — 2026-09-15

Status: **historical audit snapshot and recommendations.** The subsequent authorized repair pass is recorded in [test-suite-repairs.md](test-suite-repairs.md); findings and counts below describe the pre-repair suite.

Scope: active UI, native application, hosted server, content validation, developer/release tools and documentation website. Baseline HEAD: `434ba389c8904743040755e7afeeb18240ce313e`, **plus the existing uncommitted working tree**, including appearance/style work. Existing changes were preserved. `old/` was excluded from active test coverage.

During the audit, HEAD advanced externally to `684806a8dc176bf41f348370f8f78fd50db521d6` (`styles`), which also included the inventory written during this audit. This audit did not create that commit or push changes. Results describe the files exercised during the recorded runs, not an independently reproduced clean checkout of the final commit.

## Assessment

**There is a substantial foundation of useful tests. There is not yet sufficient automated evidence of complete application workflows.** The problem is primarily missing connections between well-tested parts, a few weak assertions, and maintenance drift—not a suite dominated by worthless tests.

- **Keep most behavior tests.** Native SQLite tests exercise real transactions, restart, duplicate publication, cancellation and ownership. UI tests frequently check lost-draft prevention and stale asynchronous responses. Server tests protect admission, conservative accounting, redaction and independent grouped outcomes. These address consequential failures.
- **Do not treat the passing count as application readiness.** UI tests replace the native boundary; native tests usually drive Store methods directly; server route tests mostly replace authentication, persistence and upstream HTTP. These layers do not demonstrate the complete UI → IPC → scheduler → server → provider → persistence → UI path.
- **There is confirmed drift.** The server suite currently fails on a retired fixture path. The model-routing benchmark tests also fail before their assertions and are not wired into CI. An important iOS verification test is skipped on the only CI job that invokes it.
- **The Android harness needs repair before it is reliable evidence.** It drives the actual app, but its success predicates can accept missing feedback and a gloss already visible before the click. Its README explicitly records live execution as unverified.
- **Cleanup should be selective.** Remove reporting-only pseudo-tests from pass totals; consolidate redundant static assertions and fixtures; reduce incidental animation/DOM coupling. Preserve precise checks for durable identity, no extra inference, one-time credit, privacy and required reward behavior.

### Confidence by layer

| Area | Assessment | Main limitation |
| --- | --- | --- |
| Native persistence and conversation rules | Strong behavioral foundation | Many scenarios manually dispatch/finish work and isolate operation graphs |
| Server request/accounting rules | Strong negative and boundary cases | Most persistence is simulated; current fixture regression fails |
| UI behavior and asynchronous state | Useful, substantial coverage | jsdom and mocked native responses; no layout or real IPC proof |
| Reading/source integrity | Particularly good deterministic cases | Structural validity does not establish linguistic quality |
| Learning evidence and rewards | Good ownership, provenance and duplicate-credit checks | No complete generated-feedback → persisted-credit → real-screen journey |
| Recording/playback | Good lifecycle pieces | Browser recording lifecycle, hardware and operating-system behavior remain weakly integrated |
| End-to-end application coverage | Insufficient | One narrow, live-provider Android runner with weak predicates and no verified run in its maintained README |
| CI/test maintenance | Uneven | Orphaned benchmark, wrong-platform test execution, limited observability |

## Method and verification

I inventoried every active test-bearing source file found by test filenames and Rust test attributes, reviewed all runner and CI configurations, searched suite-wide assertion/mocking/skip patterns, and examined representative assertions and production code for the main workflows and trust boundaries. Detailed review focused on integration seams and high-impact behavior. **This is a whole-suite architectural and risk audit, not a claim that every individual assertion received a separate line-by-line semantic review.**

The [file inventory](test-suite-inventory-2026-09-15.md) lists **205 test-bearing files**: 107 UI, 71 native, 19 server, six tools (including the updater utility), and two website. Rust production modules containing colocated tests count as test-bearing files. Fixture/support modules without test declarations are additional infrastructure.

No coverage percentage or mutation score was collected. File counts, mock counts and passing cases are discovery evidence, not quality scores. No live provider, deployment, device interaction or user-data reset was performed.

### Commands executed

| Check | Observed result |
| --- | --- |
| `npm test`, with Node 24.15.0 | **107 files, 667 tests passed**, 22.85 seconds |
| Native `cargo test --locked --manifest-path native/Cargo.toml --lib`, with loopback access | **356 passed, zero failed, one ignored**, 113.69 seconds |
| `server/.venv/bin/python -m pytest server/tests -q` | **271 passed, one failed, seven skipped**, 7.35 seconds; failing fixture path detailed in F1 |
| `npm run docs:test`, Node 24 | **28 download tests + seven image-patch/security tests passed** |
| Node test runner over version, iOS release, run logging, Android harness and benchmark test files | **19 passed; benchmark file failed during import** (its five declared tests did not execute) |
| `npm run e2e:check`, Node 24 | Type-check passed; **one device-selection test passed**; does not run the app |
| `cargo test --locked --manifest-path tools/verify-updater/Cargo.toml` | **One test passed** |
| `npm run build`, Node 24 | TypeScript and frontend build passed; existing large-chunk build warning |
| Rust contract exporter with `--check` | Passed |
| `npm run docs:links`, Node 24 | Passed for its **nine explicitly listed documentation entry points** |

The first UI run used the shell's Node 22.8.0 and failed to start 76 jsdom workers (`ERR_REQUIRE_ESM`); 212 Node-environment tests passed. Rerunning with the repository's documented Node 24 resolved this. It was an environment mismatch, not 76 product failures.

The first native run completed with 342 passed, 14 failed and one ignored in 104.91 seconds. Socket-based fixtures could not bind loopback in the sandbox; a targeted reproduction confirmed `PermissionDenied` at `provider/tests/fixtures.rs:22`. The suite was rerun with loopback access enabled, retaining the ignored live-provider exclusion. These sandbox failures must not be reported as product regressions.

The Firestore emulator tests were not run locally. They are intentionally skipped without explicit emulator configuration. The deployment workflow does run them on matching server pull requests before deployment; see F5. Release builds, Docker startup, mobile builds, Clippy and the complete docs build were inspected in CI configuration but not executed for this audit.

## Findings, ordered by priority

Priority meanings: **P1** undermines a major confidence claim or leaves a critical boundary unproved; **P2** actionable maintenance/coverage debt; **P3** narrower cleanup. These are test-assurance findings, not claims that the corresponding product behavior is broken.

### F1 · P1 · Fixture relocation has broken a server regression and orphaned the evaluation suite

**Confirmed execution failure.** [Server model-routing test](../../server/tests/inference/test_model_routing.py) line 51 opens `workflow/benchmarks/model-routing/native-gloss-fixtures.json`. That is no longer an active directory. The failure prevents `test_native_gloss_schema_is_relaxed_only_at_groq_transport_boundary` from testing its intended contract.

[Benchmark implementation](../../tools/benchmarks/model-routing.ts) line 4 and [its tests](../../tools/benchmarks/screening.test.ts) also depend on `workflow/benchmarks/model-routing/fixtures.json`. Importing the implementation fails before any benchmark test executes. The current active-tree fixture search found neither required JSON file. Other scripts under `tools/benchmarks/` retain the same historical directory convention.

**Impact:** the server check fails visibly; the benchmark is worse because root `npm test` only runs the UI workspace and neither package scripts nor CI invoke this benchmark test. Broken semantic screening can remain unnoticed while UI/native checks are green.

**Recommendation:** establish reviewed active fixtures beside their owner, derive path resolution from the module location, and add an explicit non-network benchmark-validator check to CI. Do not restore archived fixtures wholesale: review their schemas and expected meanings against current native generation/validation first. Keep live inference execution separately opt-in.

**Done when:** the currently failing server test and all five benchmark tests execute and pass from their documented entry points; changing a relevant schema or fixture breaks a deterministic check rather than producing a missing-file error.

### F2 · P1 · No automated journey spans the assembled application

The strongest UI suite, [ConversationPage.conversation.test.tsx](../../ui/src/features/conversation/ConversationPage.conversation.test.tsx), runs real page/controller code and checks submitted actions and rendered snapshots. It replaces native `invoke`, settings access and microphone behavior; tests manually supply subsequent snapshots. That is valuable frontend integration, not proof that Rust accepted the command and produced the result.

Native [execution fixtures](../../native/src/conversations/execution/tests/fixtures.rs) call `Store::execute`, `dispatch` and `finish`; several helpers delete ancillary operations to isolate a subject. Even the useful [grouped transport integration](../../native/src/conversations/execution/tests/grouped_transport.rs) supplies a hand-written loopback HTTP response. The actual [application scheduler](../../native/src/application/scheduler.rs) is launched from startup; no test call to it was found. Its grouping, credential reads, permits, cancellation polling and result publication are not exercised together by the Store tests.

Server [proxy tests](../../server/tests/inference/test_proxy.py) use ASGI transport, a fake ledger, authentication dependency overrides and HTTP MockTransport. They do not run the Rust client against FastAPI or prove the deployed authentication path. The module docstring's “End-to-end proxy” wording should be qualified accordingly.

**Recommendation:** first add a deterministic native ↔ local server integration, then a small real-app journey using that arrangement. Run the real request parsing, authentication validation, operation scheduler and durable storage; substitute only external provider responses with scripted successes, delays and failures. Use a disposable workspace and emulator. Resolve ownership and expected user behavior before choosing the harness implementation.

**Done when:** a control activated in the app produces one persisted learner turn, a published partner reply, saved assistance and correct learning/usage results; restarting preserves them; a server error or late completion produces the expected visible behavior. Merely checking an IPC mock call or mounting a synthetic page is insufficient.

### F3 · P1 · Android success predicates can pass without proving their claims

In [android.ts](../../tools/e2e/android.ts):

- Feedback completion searches `/Feedback|Try again|One suggestion/`. The current [MessageFeedback](../../ui/src/features/conversation/coaching/MessageFeedback.tsx) renders **“Feedback unavailable”** when there is no decision and no active review. That string matches. The predicate also matches “Feedback failed,” although a later error scan is intended to catch that case. A local evaluation confirmed all three strings match.
- Gloss disclosure clicks a word and then checks for **any** `.msg.me .wg`. [SavedGlossText](../../ui/src/components/reading/SavedGlossText.tsx) already renders `.wg` when auto-translation is enabled. The test neither proves that disclosure was closed before the click nor scopes the observed change to the clicked word. A broken click handler can therefore escape this assertion.
- The runner assumes existing locale, reading and access settings. It changes target language, but success checks use English labels/text and require assistance that configuration may disable. Three target languages do not establish three interface locales or three AI routes.
- CDP `element.click()` and JavaScript input events drive real handlers but do not prove physical touch hit-testing, focus/keyboard behavior or unobstructed controls.
- There is no restart/read-only reopening check. The voice variant substitutes a microphone stream and waits for reply/feedback; it does not assert actual playback or physical capture.

**Recommendation:** require an explicit completed feedback state for the newly sent message; assert a before/after disclosure change on that exact word; establish and record test preconditions through ordinary settings controls; record route and interface locale; test failure predicates with missing feedback, disabled assistance and a no-op disclosure. Retain screenshots and useful failure artifacts.

The [harness README](../../tools/e2e/README.md) candidly says live runs remain unverified. The root README contains earlier manual desktop/voice observations, which should be retained as historical manual evidence, not converted into automated Android coverage.

### F4 · P1 · A useful iOS execution test is skipped in CI

[tools/ios-release.test.ts](../../tools/ios-release.test.ts) line 39 skips the actual verification-shell test unless `process.platform === 'darwin'`. It uses real zip/unzip and Apple's plist parser, substitutes signing, and checks valid input plus six rejection scenarios. It passed locally on macOS.

[CI](../../.github/workflows/ci.yml) invokes `npm run ios:test` in the **Windows frontend job**. Its macOS iOS job builds the simulator but does not run this test. No other workflow invocation of this test was found. The static workflow assertion runs, but the substantive verifier regression is skipped by the checked-in CI wiring.

**Recommendation:** invoke the existing test in the macOS job. Keep portable checks on Windows if useful, but explicitly report platform skips. No new framework or rewrite is needed.

### F5 · P2 · Real Firestore coverage exists, but it is a separate and narrower gate

[test_firestore.py](../../server/tests/integration/test_firestore.py) has seven valuable emulator cases: concurrent budget admission, dated/idempotent settlement, single-use login codes, cross-process budget/account/request ceilings and operation claims. These are important evidence beyond in-memory fakes.

The ordinary [CI server job](../../.github/workflows/ci.yml) skips them. [Deploy server](../../.github/workflows/deploy-server.yml) runs them, with a bounded emulator startup, on pull requests matching `server/**`, `.gcloudignore` or that workflow, and gates deployment alongside a container startup check. **They are not absent from CI.** They are absent from the broad default suite and may not run on changes outside those filters that affect a cross-layer contract.

[FakeDb](../../server/tests/accounting/test_quota.py) applies writes immediately. The stronger [ledger fixture](../../server/tests/accounting/test_budget.py) adds a Python lock and deepcopy rollback. These test application intent, not Firestore conflict/retry behavior. The fake's own comments describe a previous mismatch where missing fields returned differently from Firestore and production failed while tests passed.

**Recommendation:** make the emulator/container checks reusable and ensure changes to native/server shared contracts and active fixtures trigger them. Extend emulator cases for high-risk transaction failure/rollback and historical settlement behavior, prioritizing states the fake explicitly simulates. Keep fast fakes, but document what each fake cannot establish.

### F6 · P2 · Mobile browser recording lifecycle has little direct automated coverage

[browser-recording.test.ts](../../ui/src/platform/audio/browser-recording.test.ts) tests WAV encoding and a duration limit only. It does not invoke `startBrowserRecording`, which owns `getUserMedia`, AudioContext, MediaRecorder and cleanup. The [microphone hook tests](../../ui/src/features/conversation/speech/useMicRecorder.test.ts) provide useful conversation/recording identity and stale-result checks, but use mocked native calls.

Native capture tests cover PCM encoding/bounds; [transcription tests](../../native/src/speech/recording/transcription.rs) cover durable receipts; playback tests cover URL disposal, suspension, late results and explicit replay. Keep all of these. They do not prove the mobile capture implementation releases streams on partial startup failure or correctly handles real MediaRecorder error/stop events.

**Recommendation:** add deterministic lifecycle tests for start/stop/cancel, permission refusal, failure after stream acquisition, recorder error, size/duration limits and late callbacks. Add one real-browser/device software-path recording check. Maintain explicit device QA for permission prompts, interruption/backgrounding, physical microphone and audible playback.

### F7 · P2 · Some passing tests are reports or weaker than their names imply

- Three cases in [dead-code.test.ts](../../ui/tests/architecture/dead-code.test.ts) only emit warnings about unreachable modules, unused exports and CSS. Findings never fail those cases. These are useful reports but should not inflate the behavioral pass count. Move reporting to the existing tooling/CI artifact path; keep the actual graph assertions as tests. Do not make all historical candidates fatal or auto-delete them.
- [App.navigation.test.tsx](../../ui/src/app/App.navigation.test.tsx) substitutes ConversationPage with a small draft input and a sign-in button. It proves shell mounting/state wiring, not preservation of the real composer or the actual sign-in control. Keep it as a shell test and qualify its claim; cover the genuine flow elsewhere.
- [playback-lifecycle.browser.test.ts](../../ui/src/platform/audio/playback-lifecycle.dom.test.ts) runs in jsdom. Its event/state checks are useful, but “browser” in the filename is not evidence of a real browser engine.
- [TargetText.test.tsx](../../ui/src/components/reading/TargetText.test.tsx)'s many-fragment/reopen case asserts no IPC but never verifies the fragments rendered. Add a positive content assertion so an empty renderer cannot pass that scenario.

### F8 · P2 · Incidental structure and duplicated setup make refactoring unnecessarily expensive

Static scan: **44 of 107 UI test files use `vi.mock`; 24 use `querySelector` or class assertions; none use Vitest snapshots.** This is not snapshot sprawl and those counts do not identify bad tests by themselves.

Concrete cleanup candidates:

- [RewardPresentation tests](../../ui/src/features/conversation/progress/RewardPresentation.test.tsx) repeat mocked geometry, animation arrays and cleanup, and hard-code duration/easing/callback positions. Keep required arrival/hold/dismissal, reduced-motion, no-replay, sound and meter-timing behavior. Where exact timing is an approved presentation contract, assert it once at its owner; avoid making unrelated workflow tests depend on animation array indexes and easing strings.
- [Execution fixtures](../../native/src/conversations/execution/tests/fixtures.rs) use positional dispatch expectations, and lifecycle tests index operations/attempts. Prefer selecting by operation identity/kind where order is not itself the contract. Keep dedicated ordering tests where it matters.
- [ConversationPage tests](../../ui/src/features/conversation/ConversationPage.conversation.test.tsx) are 553 lines with repeated native snapshots and unrelated workflow scenarios. Split by concrete responsibility—send/draft, revision, opening, selection/recovery—without replacing them with isolated mock-only component tests. Use typed, fail-on-unexpected-command fixture builders; avoid a second implementation of the backend.
- Server suites import `ledger`, `FakeDb`, `proxy`, `upstream` and schema fixtures from other `test_*.py` files. Extract shared fixtures into `server/tests/` support owners in a deliberate pass, as the repository agreement already anticipates. Preserve the distinction between immediate-write and rollback-capable fakes.
- The close-listener prohibition is checked repository-wide in [window-close.test.ts](../../ui/tests/architecture/window-close.test.ts) and locally by a source regex in [playback-lifecycle.test.ts](../../ui/src/platform/audio/playback-lifecycle.test.ts). Keep the global policy and behavioral listener wiring; the extra local source regex is a consolidation candidate.
- [Contrast tests](../../ui/src/domain/learning/catalog/contrast.test.ts) test meaningful numeric properties, but duplicate `card` entries and implement a limited CSS selector/color resolver. Remove duplicate cases. Treat this as token-pair validation; add real computed-style checks for actual controls instead of claiming it proves rendered contrast across the cascade, opacity, gradients and all appearance settings. The current appearance work is uncommitted, so this is a review item, not an attribution of a settled regression.

### F9 · P2 · Statistics and model quality need explicit acceptance coverage

Usage assertions exist in native conversation, transcription and generation tests, and [practice-statistics.test.ts](../../ui/src/domain/learning/statistics/practice-statistics.test.ts) checks totals, empty data, language mismatches and quiz credit. [LearnerModel tests](../../ui/src/features/skills/learner/LearnerModel.test.tsx) handle language/partner races, exclusions and exports. These are useful.

However, [native statistics](../../native/src/statistics/mod.rs) has no dedicated suite. Current checks are scattered and mostly assert global totals. Add a single cross-scope ledger fixture that reconciles global, language and partner views across successful/failed/unknown work, private coaching, partner-first openings, revised messages, deletion, generation attempts and transcription. Explicitly settle expected counting semantics first; a gap is not proof the current SQL is wrong.

Native linguistic validation and the Unicode fixture protect source boundaries and accepted structure. They cannot establish whether a translation is useful, feedback invents an error, or the learner estimate is calibrated. The single ignored [live cooking regression](../../native/src/conversations/execution/tests/live_provider.rs) is narrow and changes a prompt before sending it. It is not a representative end-to-end quality evaluation.

**Recommendation:** repair F1, then maintain a small reviewed multilingual corpus of correct/errorful/ambiguous/assisted inputs, unsupported evidence, Arabic shaping and Chinese segmentation, silence and noisy transcription. Separate deterministic schema/source invariants from scored model quality and expert review. Track quality per task/model/prompt version rather than requiring one exact prose response. Do not infer learning effectiveness from unit-test success. Planned report visualizations or garden views are not implemented coverage obligations until adopted for implementation.

### F10 · P2 · There is no consistent evidence for assertion strength or suite health

No configured coverage report, mutation-testing gate, property-testing framework or real-browser runner was found in the audited manifests/CI. The suite does include hand-written boundary matrices, adversarial inputs, Unicode conformance data and concurrency tests; those should not be discounted because they lack a particular framework.

The capacity test [queue_budget_counts_chat_coach_and_paused_work_transactionally](../../native/src/conversations/execution/tests/work_budgets.rs) triggered Rust's over-60-seconds warning. It fills the production outstanding-work limit of 512 by creating conversations and repeatedly reading snapshots. Its invariant is valuable; its setup is a likely runtime cost to measure and improve. This observation is not proof of a hang or flakiness.

**Recommendation:** retain per-suite timing, skipped-case reasons and test artifacts; report coverage by owner as diagnostic information before imposing thresholds. Pilot mutation checks on duplicate publication, revocation, source ownership and billing bounds. Require those tests to fail when the guard is removed. Add bounded generated operation sequences/Unicode cases where invariant combinations exceed hand-written cases. Improve slow setup without abandoning a real transactional boundary test. Avoid arbitrary global coverage percentages and avoid repeatedly rerunning flaky tests until green.

## Workflow coverage matrix

“Partial” means meaningful pieces exist; it does not mean the assembled user journey is verified.

| User promise | Existing evidence | Missing or weaker evidence |
| --- | --- | --- |
| Open a fresh workspace, resume later | Native creation, lock/schema/refusal/restart tests; UI startup refusal tests | Real startup → shell → resumed data across desktop/mobile |
| Sign in or configure own key/custom server | Token/PKCE, native credential I/O, provider authentication and SettingsAccess tests | Actual UI → browser/deep link → keychain → authenticated inference; mobile interruption/cancellation |
| Send text without losing or duplicating it | Strong UI page/draft tests and native atomic/idempotent send tests | Full scheduler/server integration and persisted result observed from UI |
| Let partner start without a fabricated user turn | Native openings, real-page mocked-native tests, Android harness | Verified live harness run and restart behavior |
| Read saved translations/glosses without new inference | Strong source/reading/retry/state tests; native usage assertions | Browser shaping/layout; correct disclosure assertions; full-app no-new-request proof |
| Edit earlier text safely | Native revision, revoked late publication/credit; real-page revision handlers | UI confirmation through native persistence and restart with complete graph enabled |
| Record, review/auto-send, hear and stop reply | Hook/player tests, PCM/receipt/analysis tests, optional injected Android audio | Browser capture lifecycle, actual playback and device permission/background behavior |
| Get honest coaching and one-time rewards | Evidence rejection, support provenance, captured-policy credit and durable claims | Complete path to visible/sounding reward; reviewed linguistic quality |
| Generate lesson, quiz, practice, reopen | Native lifecycle/quiz/review tests and LessonDialog behavior | One complete persisted journey with provider failure, duplicate click and restart |
| Switch language/partner while work completes | Useful late-result UI and native ownership tests | Real app with settings/scheduler/server concurrently active |
| Report/export retained usage and evidence | Native/UI export cases, scattered usage and reconciliation tests | One cross-scope accounting fixture and full-app export inspection |
| Reset safely and update safely | Native ownership/symlink/deferred-cleanup tests; UI typed confirmation; updater tamper test | Real reset/relaunch and signed update install on supported platforms |
| Install/download and operate hosted service | Website installer filtering, image-security tests, release verifier, server deploy/emulator gates | Actual release installation and live-service checks remain separate verification |

## What to keep, improve, consolidate or remove

| Action | Scope |
| --- | --- |
| **Keep** | SQLite atomicity/replay/restart; late-result rejection; source-bound gloss/evidence; one-time XP and quiz credit; unknown-cost reservation; redaction; request limits; Unicode fixtures; cancellation and resource disposal; reduced-motion/sound behavior |
| **Strengthen** | Android feedback/disclosure predicates; browser capture lifecycle; real scheduler/native-server integration; cross-scope statistics; positive rendering assertions |
| **Consolidate** | Duplicated fixture construction, incidental animation assertions, redundant local source scan, repeated CSS token pairs; shared Python fixtures currently imported from test modules |
| **Move out of pass totals** | Three warning-only dead-code/CSS reporting cases; retain reports and actionable candidate lists |
| **Repair, then retain** | Model-routing benchmark and native-schema server regression; move the iOS verifier test into a platform where it executes |
| **Do not mass-delete** | Tests because they use mocks, assert exact command payloads, touch SQL or repeat a behavior at another boundary. Ask what unique failure each catches first |

Exactness is desirable when it protects a contract: one inference request, correct conversation/revision, no secret fields, one award, zero writes after rejection, correct UTF-16/source span, correct PCM encoding. It is expensive without much protection when it freezes incidental class names, harmless reads, callback positions or arbitrary fixture totals unrelated to the behavior under test.

## Finite improvement sequence

### 1. Restore trustworthy checks

Fix the two fixture consumers and establish reviewed fixtures; wire the benchmark-validator test into CI; run the iOS test on macOS; fix Android success predicates and test their negative cases. Record suite/platform/skip outcomes. Keep the Node 24 requirement explicit—an engines/version preflight would make local failure clearer.

Acceptance: all existing deterministic suites execute successfully on their intended runtimes; benchmark tests cannot silently disappear; the Android assertion helpers reject missing feedback and unchanged disclosure.

### 2. Prove one complete conversation

Create one deterministic native/local-server scenario with real authentication validation, emulator persistence, actual scheduler and scripted provider responses. Exercise normal completion, one delayed ancillary response and one upstream failure. Then drive it through the actual application UI and restart.

Acceptance: exact durable turn ownership, reply/assistance results and learning/usage totals match visible UI; restart/reopen causes no extra inference; failed help does not erase a valid reply; late results cannot publish into a deleted/revised source.

### 3. Expand to a small critical journey set

Add these individually, preserving failure artifacts:

1. Fresh/resumed workspace, send, switch conversation, return without losing the draft.
2. Arabic and Chinese reading, exact clicked-word disclosure and no inference on reopen.
3. Revision while ancillary work is delayed; old result/credit cannot reappear.
4. Lesson generation → quiz → practice → saved recap/reopen; no duplicate credit.
5. Record → review/auto-send → speech playback → stop/background, with explicit permission-denial coverage.
6. Access revocation/provider refusal and explicit recovery without automatic retry.

The first deterministic journey should run per relevant PR. Additional route/platform matrices and small live-provider semantic checks can run on a deliberate release/scheduled cadence with separate cost and failure reporting. Keep Google OAuth/device hardware/signing verification explicit; a simulated provider journey cannot replace them.

### 4. Reduce maintenance cost without losing protection

Extract shared test support, separate the large UI workflow suite, move warning reports out of tests, profile the queue setup, add the cross-scope statistics fixture and pilot targeted mutations. Follow repository policy for any production large-file split: one original file at a time, verify and check in before the next. This audit does not authorize an unrelated production decomposition.

### Completion standard for cleanup

For each removed or merged test, record the behavior it protected and the retained replacement, or explain why the behavior is obsolete. For each new workflow test, name the real boundaries it crosses, substitutes, expected failure signals and restart semantics. A smaller suite is only an improvement if it catches at least the same meaningful failures with less maintenance.

## Remaining uncertainty

- Local results are a snapshot of an already modified working tree, not a clean commit or a remote CI run.
- No repeat-run flakiness study, mutation campaign, coverage baseline or physical-device run was performed.
- Historical manual QA exists in README references; it was not reproduced here.
- The current coaching plans retain old paths and historical implementation claims. Current code/tests were used to assess implemented coverage; pending product ideas were not treated as shipped features.
- No broad deletion recommendation is justified by this audit. The highest-return work is repairing drift and proving the connections between existing tested parts.
