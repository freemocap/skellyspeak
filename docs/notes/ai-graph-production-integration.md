# AI graph production integration

Updated 2026-10-10. This note records connected application behavior, current
implementation work and verification limits. Formal semantics belong to the
[foundations](ai-graph-foundations.md), [core profile](ai-graph-core-semantics.md),
[durability contract](ai-graph-durability.md) and
[inspection contract](ai-graph-inspection.md).

## Delivery status

| Stage | Status |
| --- | --- |
| 1. Result publication | Implemented and connected; migration regressions remain part of every change. |
| 2. Speech integration | Connected synthesis, delivery, playback, inspection and bounded cache. |
| 3. Partner application host | Connected reply, opening, assessment and requested helpers. |
| 4. Conversation controls | Connected activation, pause, cancellation, stepping, retry and revision. |
| 5. AI entry points | Conversation, reading, transcription, speech and proposals use graph hosts. |
| 6. Workflow inventory | Command, scheduler and provider routes audited; see inventory below. |
| 7. Functional build | Prepared and exercised by the user. |
| 8. Functional acceptance | Accepted by the user with performance issues noted. |
| 9. Unified activity | Connected artifact graph, run timeline, controls and attempt inspection. Usability/performance needs further work. |
| 10. Source cleanup | Complete; final automated gates passed. |
| 11. Efficiency | Pending: measure repeated work, contention, rendering and result hydration. |
| 12. Final verification and acceptance | Pending complete regression gates and user app check. |

Changes remain uncommitted. Builds and controlled-provider tests establish their
specific checked behavior; they do not establish live-provider speed or rendering
responsiveness. No release or deployment is authorized.

## Application ownership

The command transaction owns admission and domain mutations. The scheduler polls
executable graph state. Local work and provider work have distinct capacities;
provider transport enforces network admission and credential/source authority.
Operations consume captured typed inputs. Domain owners recheck authority when
adopting results into product state.

Conversation/catalog and workspace/catalog partitions retain executable artifacts,
runs, attempts, producing executions, observations and adoption facts. Sharing is
an explicit operation policy scoped by captured inputs and authority. Provider wire
identity belongs to the producing execution. Cancellation of one consumer does not
cancel another consumer's authority to adopt an available result.

Provisional reply text belongs to an identified attempt and producing execution.
It can appear before publication, but cannot satisfy graph output ports. The UI
reads the graph preview and adopted message through native snapshots. Terminal
publication and learner credit commit atomically with adoption. Stable domain
effect identities prevent duplicate credit across retries.

Speech outputs carry validated receipt references. Evictable audio, bounded playback
delivery and execution evidence have separate lifetimes. A cache miss starts no
work unless a playback/synthesis request authorizes it. Original and normalized
alignment remain independently inspectable.

Activity rendering consumes the artifact exported by execution and overlays
recorded dispositions. Every defined node and binding belongs to that artifact.
Timeline selection reads history; it does not dispatch work. Generic layout,
serialization and presentation preserve native identities and facts.

## Connected workflow inventory

| AI entry or control | Native route to verify | Product owner |
|---|---|---|
| execute_command: StartConversation, SendMessage, ReviseTurn | graph_runtime admission | Partner turn |
| execute_command: StartGuideConversation, StartSkillConversation, StartPhraseConversation | graph_runtime partner admission | Seeded/new partner turn |
| execute_command: AskCoach, AskGuideCoach | graph_runtime coach admission | Coach turn |
| execute_command: RequestMessageHelp, RequestExplanations, RequestSuggestions, RetryReplyHelp | graph_runtime help demand/retry | Exact message |
| execute_command: RetryGloss, ReassessFeedback | native helper run / native retry | Exact source and feedback note |
| execute_command: RequestMessageSpeech, CancelMessageSpeech | graph_runtime speech commands | Exact message/audio request |
| execute_command: ControlTurn, CoachControl, SetPaused | native controls / dispatch authority | Native run or global pause |
| begin_reading, run_reading, cancel_reading | native_reading or native_speech | Reading request; five ReadingAid variants |
| mic_transcribe, mic_retry_transcription, mic_cancel | native_transcription | Conversation/Drill recording |
| mic_listen_start/push/stop/discard | continuous capture → voice::transcribe → native_transcription | Continuous Drill capture |
| get_skill_guide | native guide translation; authored editions are local | Authored edition, variety and requested explanation language |
| begin_persona_generation, run_persona_generation, cancel_persona_generation | proposal_execution native graph | Persona proposal |
| begin_drill_preview, preview_drill_items, cancel_drill_preview, discard_drill_preview | proposal_execution native graph | Drill proposal |

Proposal acceptance, local curated practice previews, cache reads/audio inspection,
activity/history reads, microphone capture/tuning and saved learning views do not
initiate inference. Access checks, credential verification, hosted sign-in/account
and update discovery are network administration, not AI inference. Conversation
creation/opening and persona/settings changes require inspection for implicit
admission in 6.2; background creation/recovery is covered in 6.4.

## Current source owners

| Responsibility | Owner |
| --- | --- |
| Graph validation, execution and evidence | `native/src/ai/graph/` |
| Transactional graph persistence | `native/src/ai/graph_store/` |
| Workspace run host | `native/src/ai/workspace_graph.rs` |
| Conversation host and authority | `native/src/conversations/execution/graph_runtime/` |
| Domain result publication | `native/src/conversations/execution/graph_publication/` |
| Application dispatch | `native/src/application/graph_execution.rs` and `scheduler.rs` |
| Structured/prose transport | `native/src/ai/transport/` |
| Speech receipts and cache | `native/src/speech/graph_audio.rs` |
| Standalone reading host | `native/src/application/native_reading.rs` |
| Synthesis/recognition hosts | `native/src/application/native_speech.rs` and `native_transcription.rs` |
| Proposal host | `native/src/application/commands/proposal_execution/native.rs` |
| Activity and interrogation | `ui/src/features/activity/` |
| Generated executable tour specimen | `native/src/bin/export-contracts.rs` |

## Required regression coverage

- Success, failure and bounded response diagnostics through actual application commands.
- Independent branch completion, on-demand activation and explicit retry.
- Exact Unicode source identity and source invalidation before adoption.
- Shared execution, consumer cancellation and useful evidence after failed publication.
- Disclosure ownership, revision evidence and one-time learning credit.
- Playback, cache eviction, requested regeneration and restart.
- Transaction rollback, consecutive schema changes and repeated startup.
- Static topology, live overlays, selected history and controls using the same identities.

## Stage 10 checklist

- [x] 1. Inspect the reported freeze; fix any clear, bounded defect.
- [x] 2. Inventory the execution and viewer code to remove, identifying the current owners that must remain.
- [x] 3. Remove superseded execution routes and orchestration.
- [x] 4. Remove superseded viewer components, adapters, and contracts.
- [x] 5. Remove compatibility-only code and update active documentation to describe only the current architecture.
- [x] 6. Run regression checks and the application build; report the remaining performance work.

### Implemented cleanup

Activity snapshot, history, run-catalog and attempt-evidence IPC use blocking
workers, keeping store locking and history reads off the window event thread.
Recent logs did not establish the reported freeze's exact duration or root cause.
This fixes a concrete blocking mechanism; it is not measured responsiveness evidence.

The scheduler dispatches graph work. Commands, publication, reading, proposals,
speech, transcription and generation inspection use native ownership. Product
message status and revision history use one source-bound graph projection. Turn
snapshots expose graph previews, playback request identity and declared award
sources. Activity renders the executable artifact; its tour specimen is generated
by the executable compiler.

Learner progression reads accepted observations and credit ledgers directly. Live
pending/failure status comes from the assessment node independently of reply state.
Deliberate inspection credit uses engine/attempt identity and captured conversation
ownership; UI evidence renders before its separate credit command. Credit is
idempotent, and failed credit writes remain visible for their selected attempt. The
credit IPC sends selection identity only. Native command code has no
queries against the conversation operations/attempts tables.

Graph producing executions own usage attribution. Shared cache blobs, bounded
reading/transcription results, graph audio receipts and playback delivery retain
their separate lifetimes. Interrupted recording receipts recover as unknown, with
response metadata retained and no automatic submission.

### Migration policy and retained data

The complete chain from workspace format 45 remains supported. Released migration
steps, frozen SQL contracts and checkpoint encodings remain required persistence
support. Current checkpoint writers use multiple encodings according to retained
state; those decoders are not disposable execution implementations.

Format 71 retires inference execution/result/consumer cache tables. Their metadata
and payload associations are intentionally retired under the approved cleanup;
current graph records, messages, accepted learning evidence, earned awards, shared
blobs and settings remain. Normal cache maintenance owns blob reclamation.

Conversation relational history tables and ownership discriminator values remain
frozen data contracts required by the retained chain. Active execution does not use
them. No local workspace data was opened, reset or deleted during this cleanup;
verification uses temporary databases. Release versions remain unchanged.

### Final stage-10 verification — 2026-10-10

| Gate | Result |
| --- | --- |
| `cargo test --manifest-path native/Cargo.toml --lib` | 934 passed, 0 failed, 2 intentionally ignored; includes all supported-start migration sweeps, rollback, repeated startup and preservation tests. |
| `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings` | Passed. |
| `cargo check --manifest-path native/Cargo.toml --bins` | Passed. |
| `npm run contracts:check` | Passed. |
| Full UI suite, `vitest run --maxWorkers 2` | 1,952 tests across 288 suites passed. |
| `npm run check:fast` | Passed on final code/test state. |
| `npm run build` | TypeScript and production UI build passed. |
| `npm run docs:links`, `npm run docs:demos:test` | Links passed; four documentation demo tests passed. |
| `git diff --check` | Passed. |

Focused regressions establish that partner graph publication produces learner
records and XP, revision history exposes assessment attempts, inspection reads
remain revision-bound and read-only, deliberate inspection awards once, and
rendering does not wait for credit. IPC tests verify that response content is not
sent back with inspection credit and repeated credit reads do not refresh effort.

The full native suite preceded comment-only source edits; Clippy and binary checks
covered those comments. All executable native changes were included in the full
suite. No running-app session was restarted or controlled in this batch. These
checks establish automated behavior and a production frontend build, not measured
live responsiveness or final user acceptance. The build reports a large-bundle
warning; jsdom reports unavailable canvas methods during tests. Neither was hidden
or used as evidence of browser rendering performance. Changes remain uncommitted.

## Stage 11 — efficiency and workflow replay

- [x] **11.1** Audit reads, writes, locks, polling, scheduling and rendering; produce a ranked inventory.
- [x] **11.2** Agree on interaction budgets and a finite set of representative workflows.
- [ ] **11.3** Prove desktop automation can attach to and drive the actual application.
- [ ] **11.4** Add correlated timing measurements across the UI/native boundary.
- [ ] **11.5** Implement explicit session capture, including workspace state, interactions, provider output and audio.
- [ ] **11.6** Verify capture completeness and measure recording overhead.
- [ ] **11.7** Have you record the representative workflows.
- [ ] **11.8** Implement isolated replay of those recordings and verify the expected outputs.
- [ ] **11.9** Establish latency, repeated-work and concurrency baselines.
- [ ] **11.10** Fix the ranked problems one at a time, replaying after each change.
- [ ] **11.11** Run regression checks and prepare your responsiveness acceptance check.

The [source audit](ai-graph-efficiency-audit.md) records confirmed mechanisms,
provisional priorities and measurements needed before claiming improvements.
The user approved next-frame loaded-content response, 50 ms p95 small local reads
and 50 ms p95 provider completion-to-display, with provider wait measured separately.
The audit lists the agreed workflow set. No measured performance pass is claimed.

A secondary agent implemented bounded recording/replay tooling, reviewed by the
primary agent. The [recording note](workflow-recording-replay.md) distinguishes
tested primitives from application integration. Synthetic tooling tests do not
complete desktop attachment or real-session capture. Startup currently selects
the standard application directory; stage 11.3 needs an explicit isolated desktop
workspace/profile launch before exercising the application. Stage 12 remains
final verification and user acceptance after this efficiency work.
