# Rust backend audit — 2026-09-14

Baseline: `91856a0` (clean source tree when this review started). Audit only; no application-source changes, native application launch, app-data changes, credential operations, paid requests, deployment, or Git writes.

## Findings

### R1 — P1: A lesson input-budget rejection stops the entire native application service

- **Code:** `src-tauri/src/execution.rs:1122–1123`, `src-tauri/src/lessons.rs:543–569`, `src-tauri/src/lib.rs:970–974` and `123–124`.
- **Trigger:** An active lesson's review exchange becomes larger than 96,000 serialized bytes. User messages allow 20,000 Unicode characters, replies allow 12,000; the review includes up to 20 messages plus lesson and language context. One accepted multibyte user message and one valid multibyte reply can already exceed the review budget.
- **Effect:** `lessons::prompt` returns a normal Validation error, but `dispatch` propagates it rather than failing the individual operation. The scheduler sets the global fatal error and exits. Every subsequent normal Store command returns that error, including unrelated conversations. The failing operation's transaction rolls back, leaving no durable operation failure. Restart pauses the backlog, but resuming the same operation reaches the same problem.
- **Fix:** Handle anticipated prompt/preparation failures uniformly per operation (as the adjacent coaching preparation branch already does), persist the error and refresh the turn. Reserve global shutdown for broken storage/internal invariants. Select review history by the actual serialized budget before dispatch.
- **Evidence:** Static call chain is direct. Offline reproduction in a temporary source copy uses a fresh temporary SQLite workspace, an accepted 20,000-character message, a valid 12,000-character completion, and the active-lesson review shape; final execution result is recorded below.

### R2 — P2: Idle conversation watching repeatedly rebuilds all language evidence under the global mutex

- **Code:** `src-tauri/src/lib.rs:502–511`; `src-tauri/src/execution.rs:969–980`; `src-tauri/src/lessons.rs:436–459`; `src-tauri/src/progression.rs:36–56,224–230`; `src-tauri/src/openers.rs:68–73`.
- **Trigger:** Keep a conversation open with a `watch_conversation` long poll while the revision remains unchanged.
- **Effect:** The native poll hydrates the complete conversation before comparing revisions, then repeats after 150 ms. Hydration unconditionally computes lesson choices: it loads/parses every retained coaching turn for the language and folds learner state. The choices path calls `capture_focus`, which builds that evidence projection again. This occurs while holding the same Store mutex used for sends, completions, settings, and other windows. Work therefore grows with total retained language history even when no data changed. Per-message/per-turn hydration adds many individual queries.
- **Fix:** Check the scalar revision first and hydrate only on change or the long-poll deadline. Cache/reuse a projection within one hydration; make starter/lesson choices explicit or revision-cached reads. Consider an event/notification wakeup instead of repeated database polling.
- **Evidence:** Confirmed source behavior, approximately 6.7 poll passes/second before accounting for computation time, with at least two language evidence projections per pass. No claimed device latency or CPU percentage: this review did not benchmark a production-sized user database.

### R3 — P2: Retried stale-credential cleanup can prevent application startup

- **Code:** `src-tauri/src/lib.rs:138–148,1209–1215,1273–1274`; `src-tauri/src/execution.rs:692–712`; `src-tauri/src/credentials.rs:160`.
- **Trigger:** A pending `credential_cleanup` entry survives a prior replacement/disconnect or interrupted credential write, and the system keychain refuses deletion on the next launch (for example access denial/unavailability).
- **Effect:** Cleanup returns the credential error through Tauri setup, before managed application state and the scheduler are installed. `.run(...).expect(...)` aborts startup. The database can be healthy, yet the user cannot reach settings or the existing recovery UI. The stale row is deliberately retained on deletion failure, so a subsequent launch repeats the attempt.
- **Fix:** Represent cleanup failure in the existing startup cleanup state, retain the durable cleanup obligation, and expose an explicit retry/recovery action. Do not silently forget the stale credential or turn a recoverable keychain failure into application termination.
- **Evidence:** Confirmed control-flow path. No real keychain denial was induced and no credential was read or modified during this audit.

## Architectural debt / further investigation

- `execution.rs` combines action admission, snapshots, SQL projections, dispatch preparation, output validation/publication, speech, retries, and a very large test module; `lib.rs` mixes IPC, credentials, generation orchestration and scheduler lifecycle. Extract along these existing seams after regression cases protect behavior. File length alone is not a correctness finding.
- Several dispatch preparation branches handle validation failures differently; R1 is one concrete result. Audit all operation-kind preparation/publication boundaries using a shared error classification, retaining fatal storage errors.
- Conversation/export/profile commands perform synchronous database and serialization work through one mutex. The immediate fix is R2; broader actor/thread changes should follow measured contention rather than a framework rewrite.
- Native scheduler task futures are detached and their join results are not observed. A panic could leave an operation running until restart reconciliation. No reachable panic was demonstrated; this is a coverage target, not a confirmed production defect.
- `workflow/README.md` contains obsolete stage/authorization statements (Git read-only, no new agents, coaching still proposals). The supplied current working agreement and explicit audit request take precedence; reconcile these documents to avoid future contradictory agent guidance.

## Coverage and verification limits

Reviewed active native lifecycle and IPC, durable store/schema/ownership, scheduler admission and grouping, provider/output boundaries, credentials and startup cleanup, microphone/transcription flow, speech cache, lesson review, progression/learner-state projections, and conversation export. Read current working agreement, README, relevant coaching contracts and active design references. Deprecated `old/` was not used as a specification.

The previously reported full native suite (348 passed, 1 ignored) and Clippy result belong to the earlier baseline verification, not a newly executed full audit run. This audit uses a focused offline regression in a copied source tree only; it does not establish macOS keychain failure behavior, mobile-device behavior, provider acceptance, deployed service behavior, or large-history interactive latency. No source fixes are included.

### Focused reproduction result

`execution::audit_regressions::oversized_lesson_review_escapes_dispatch_as_global_error`: **passed** (1 passed, 349 filtered out, 0.20 seconds). The assertion confirmed that an otherwise accepted 20,000-character source and valid 12,000-character reply produce `AppError { code: Validation, message: "Lesson context exceeds the input budget." }` from `Store::dispatch`. The scheduler's global-stop reaction is established by the cited production call chain.

The test lived only in `/var/folders/nf/2g_d0lb94t784_22q00cr5ww0000gn/T/skelly-rust-audit-7iccnl1s/src-tauri/src/execution.rs`, using a new temporary SQLite workspace and an injected active-lesson shape. Cargo reused the repository target cache; no checked-in Rust files changed. Two earlier harness assertions were corrected (the first assumed review would be the next dispatched operation; the second treated a local-planning `None` as queue exhaustion). Those were harness sequencing errors, not production-suite failures. The final test iterates the local preparation passes and verifies the specific propagated error.
