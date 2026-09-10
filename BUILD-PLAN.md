# Build plan and architecture review

## Current AI deployment checkpoint

Hosted deployment is verified for commit e05a870 by successful workflow
34497425319. All eight TTL policies are ACTIVE. Revision
skellyspeak-api-b4efc379d49694213a7a5d56efadf2228 is ready and receives 100% of
traffic; health and unauthenticated endpoint checks pass. The user verified hosted
chat, and the local attempt receipt records success at 2026-09-10T17:09:33.808Z
(302 input tokens, 14 output tokens). Direct API keys and local self-hosted chat
are also user-verified. This completes the AI transport/deployment checkpoint,
not the complete application feature plan. Next: RELEASE-RECOVERY-PLAN.md.

## Intention

Build a beautiful, convivial language-learning tool around durable partners,
resumable conversations, useful private assistance and inspectable learning evidence.
Mathematical visuals and dense scientific reports expose the same underlying data.
Help encourages practice without manufacturing proficiency or emotional obligations.

Build complete vertical slices: domain rules, persistence, execution, UI, verification
and documentation together. Keep one authoritative implementation per responsibility.
No imports, compatibility layers, backup subsystem or wholesale reference-code reuse.
An incomplete product must not be presented as complete because one slice works.

## Scope and contract ownership

| Contract | Owning document |
| --- | --- |
| Product intent and learner journey | [DESIGN.md](./DESIGN.md) |
| Identity, ownership, evidence and deletion | [DATA-MODEL.md](./DATA-MODEL.md) |
| Graph execution and publication | [EXECUTION.md](./EXECUTION.md) |
| Access routes, model roles and prompt permissions | [AI-STRATEGY.md](./AI-STRATEGY.md) |
| Persistence, typed commands and hydration | [STATE-AND-STORAGE.md](./STATE-AND-STORAGE.md) |
| Model candidates and evaluation gates | [AI-EVALUATION.md](./AI-EVALUATION.md) |
| Implementation sequence and checkpoints | This document |

This plan orders those contracts; it does not silently approve unresolved proposals.
Change a decision in its owning document and update the plan for sequencing effects.

Complete product scope includes one local learner, multiple language profiles,
single-language partners, multiple independently configured conversations, editable
persona/background and authored Vibe, source-bound relationship memory, private
coaching, consistent language assistance, per-operation Standard/Fast routing and
all three access routes. Progress separates participation, practice and demonstrated
ability. Gardens and scientific reports consume the same underlying evidence.
Deletion, archiving, exclusions, onboarding and accessible desktop/mobile interaction
are part of completion, not optional cleanup.

Richer familiarity stages, partner-language editing and additional visualization
families are deferred. Exact layouts, scoring calibration and persona controls are
focused phase work. No synchronization or mixed-target-language conversation mode
is introduced. The supported platform scope remains Windows, macOS, Linux, Android
and iOS; each requires its own verification evidence.

## Consolidated decision slate

The following consolidated defaults were approved for implementation. Concrete
model eligibility still depends on evaluation; release and platform claims require evidence.

| Decision | Recommended initial contract | Consequence |
| --- | --- | --- |
| Generation models | Standard Gemini 2.5 Flash; evaluate Flash-Lite for Fast | Per-operation routing, with measured task/language eligibility |
| Provider scope | Hosted or self-hosted SkellySpeak server; direct OpenRouter/Groq keys | Custom URL selects our server location, not an arbitrary provider protocol |
| Text display | Validate complete generated prose before display | No progressive reply text initially; assistance still arrives independently |
| Send concurrency | One outstanding partner reply per conversation | Drafting and other conversations remain usable |
| Step | One eligible operation attempt per permit | No hidden paid retry under one Step |
| Submitted settings | Captured for the turn; revocation overrides | Difficulty edits affect subsequent turns |
| Sent-message editing | Explicit edit-and-regenerate with dependent suffix removal | Show removal scope before applying |
| Conversation defaults | Copy the partner's most recently used conversation settings | No linked relationship-default bundle |
| Memory removal | Remove unsupported claims and exclude removed supporting passages from extraction | Independent support or standalone user notes can remain |
| Assessment exclusions | Remove skill/proficiency credit; retain valid practice/participation | Excluding evidence differs from declaring an observation invalid |
| Local reports | Report retained records; keep hosted incurred metering separate | Conversation deletion removes local statistical contributions |
| Drafts | Retain per thread during the session | Unsent drafts do not survive restart initially |
| Reset | Local-data reset with credential/sign-out scope separately selected | The reset control states precisely what is removed |
| Vibe | Evaluate local multilingual E5-small first | No silent network destination or generative substitute |

Routine tool choices do not require another product questionnaire. At the relevant
phase, check current primary documentation, choose concrete versions and record
platform constraints and rationale before use. Return for a decision only when a
choice materially changes behavior, data scope or platform support.

## Phase 1: Durable local product foundation

- [x] Select transactional storage, Rust bindings, typed IPC generation and the
  minimal frontend snapshot mechanism; document dependency rationale.
- [x] Establish Tauri/React/Rust and hosted-service boundaries with relevant checks.
  Probe native build viability early, including one phone target.
- [x] Implement learner, language registry, partner, relationship, conversation,
  settings and preferences through Rust commands and persisted scoped snapshots.
- [x] Include revision validation, create/archive/delete, session drafts, tutorial
  status and procedural-avatar parameters in the first local slice.
- [x] Verify restart persistence, independent settings, conflicts and ownership.

Exit: a verified local build creates partners and distinct conversations, preserves
accepted state across restart and restores each conversation's settings. No AI
conversation claim at this checkpoint. Test doubles stay in tests, not a pretend
production AI mode.

**Verification:** local checks and native macOS create/edit/settings/restart flow
passed. Narrow-window layout inspected. iOS prerequisite probe found no full Xcode;
iOS/device and other-platform builds remain unverified. See README.md for commands.

**User check:** create two conversations with different settings, switch between
them and restart. Review navigation and partner identity controls.

## Phase 2: Graph execution and a real conversation path

- [x] Implement declarations driving scheduling, durable work intents, attempt
  identity, pause/step/cancellation and coherent output publication.
- [x] Implement own-key OpenRouter access, secure credential handling and capabilities.
- [x] Implement Send, permitted context, Standard replies, deterministic validation
  and accepted-message persistence through the real graph.
- [x] Expose operations/model targets and partial/error states in inspection.
- [x] Verify duplicate Send delivery, unknown provider outcomes, scoped hydration,
  paused dispatch and deletion racing with publication.

**Verification pending:** system-keychain save/retrieval and a live
OpenRouter exchange. Phase 2 is not declared complete until those checks run.

Exit: one complete AI route works. Gates control actual dispatch. Hosted and custom
routes are not claimed ready merely because own-key access works.

**User check:** pause/step an exchange, cancel, switch conversations during work
and inspect the actual model target. Review full-response presentation.

## Phase 3: Assistance, coaching and evaluated model routing

- [ ] Define passage offsets, structured contracts, templates and source validation;
  implement independently arriving understanding/expression help.
- [ ] Implement private coaching, suggestion attribution and explicit settings changes.
- [ ] Build conformance checks and reviewed fixtures; price and cap paid evaluation
  before running it. Record results as measurements, not inferred capabilities.
- [ ] Assign Fast only to task/language scopes passing the frozen evaluation plan.
- [ ] Implement titles, reactions and sourced memory with correction, removal,
  extraction exclusions and invalidation of dependent unpublished work.

Exit: assistance retries never regenerate a reply or duplicate evidence. Private
coach content cannot reach partner prompts. Fast assignments have measured support.

**User check:** mix an explanation-language fragment into target-language text,
use a suggestion without autosending, inspect coach privacy, and correct/remove memory.

## Phase 4: All access routes and hosted accounting

- [ ] Specify and implement hosted sign-in/session lifecycle, validation, model/provider
  allowlists, quota, attempt receipts and metering reconciliation.
- [ ] Correct Custom URL to target a self-hosted instance of our server through the
  same versioned SkellySpeak protocol as hosted access. Remove generic Chat
  Completions configuration and model-list probing from this route. Specify server
  authentication/bootstrap, configuration validation and conformance tests first.
- [ ] Verify both model roles on each supported route without secret substitution.
- [ ] Verify credential redaction, sign-out revocation, route changes, quota errors,
  interrupted requests and duplicate-dispatch prevention.

Exit: all three routes have verified request and failure paths. Hosted claims require
the corresponding service environment. Missing test accounts or endpoints remain
unverified; local unit tests are not substitutes for live integration evidence.

**User check:** select each available route, inspect connection diagnostics, change
model assignments and confirm failures identify the affected work.

## Phase 5: Evidence, metrics and scientific reports

- [ ] Freeze seven-domain definitions, rubric, source eligibility, known-assistance
  treatment and explicit participation/XP rules before scoring evidence.
- [ ] Implement observations, exclusions, uncertain/insufficient-evidence assessments
  and deterministic projections with rule versions and source coverage.
- [ ] Implement measured activity and attempt usage with explicit token/time units.
- [ ] Build dense global, language and partner reports: distributions, time series,
  filters, denominators and source drill-down.
- [ ] Verify source deletion/exclusion invalidates backend and frontend caches;
  opening reports makes no new inference requests.

Exit: numbers trace to eligible sources. XP is not converted into CEFR. Assessments
state limitations; general reports contain no conversational statistical narration.

**User check:** inspect a number's sources, exclude evidence and delete a conversation.
Check recomputed results and review report density and terminology.

## Phase 6: Geometric Vibe and the visual conversation experience

- [ ] Evaluate encoder/runtime deployment including phone memory and latency; build
  the matching emoji table, preprocessing and explicit long-text policy.
- [ ] Implement sourced Vibe and distributions separately from authored persona Vibe.
- [ ] Implement static mathematical avatars and the rounded garden renderer over
  view-independent metrics; no second editable flower-health truth.
- [ ] Build conversation grid/sorting/creation, selected flower and short title,
  analysis blurb and assistance/commentary tabs.
- [ ] Add expanding petal labels and detail navigation with touch/keyboard equivalents.
- [ ] Verify switching metric representations changes neither evidence nor AI usage.

Exit: visuals identify their metric/source scope. Vibe is a playful geometric
association, not certification of literal content or emotion.

**User check:** compare garden aesthetics, select petals on desktop and phone,
configure avatars and inspect authored versus observed Vibe. Focused visual studies
may happen earlier; this is the main integrated aesthetic checkpoint.

## Phase 7: Onboarding, platforms and release review

- [ ] Complete automatic first-visit tutorial, skip/dismiss and Settings replay.
- [ ] Complete accessibility, touch/keyboard behavior and actionable pending/error states.
- [ ] Verify persistence, credentials, suspension/restart, managed-file deletion and
  packaging on each target platform; identify missing environments explicitly.
- [ ] Complete active setup/product/architecture/privacy/hosted/platform documentation
  from verified behavior, with reproducible relevant checks.
- [ ] Remove temporary production paths, dead configuration and unused dependencies;
  reconcile proposal wording with the actual implementation.
- [ ] Review the final candidate and remaining gaps before publishing or deployment.

Exit: required checks have actual evidence. Publishing/deployment are explicit
actions. Git writes remain the user's responsibility.

**User check:** complete a fresh first-use journey, skip/replay onboarding, resume
practice after restart and inspect the release candidate on available devices.

## Completion discipline and authorization boundary

Report each phase's actual changes, verification, runnable behavior and ready user
check. Never ask the user to test a proposal or unverified build. Work autonomously
between meaningful checkpoints once implementation is authorized.

Each exit includes persistence, errors, deletion, documentation and appropriate
checks. Placeholder services, sample scores, silent fallbacks and parallel editable
truths cannot satisfy completion. Synthetic fixtures remain separate from production.
Useful sourced evidence and evaluation results are not disposable scaffolding.

Implementation of the reviewed plan is authorized.
Routine technical selections proceed within that scope; material deviations
return for a concrete decision. Paid evaluation ceilings, deployment and unavailable
verification environments remain separately identified.

Complete the request-load resilience checkpoint below before expanding automatic
assistance and evaluated task routing. Native/live checks remain capability-specific.

## Active checkpoint: hosted access and utility panels

Desktop Google sign-in, secure session storage, allowance refresh and hosted reply
routing are implemented. Custom URLs and verified hosted deployment are also
implemented; mobile sign-in remains open. User-confirmed hosted and OpenRouter chat
success does not establish live Groq/custom or all-platform conformance.

Toolbar AI docking/pop-out, Profile usage reports and searchable settings are
implemented. See `UI-SURFACES.md` for the adopted interaction inventory and remaining
feature dependencies. No assessment/XP or voice functionality is implied by these panels.

## Current priority: voice-first chat and coach

### Focused interaction fidelity pass

The hosted microphone/send smoke check has passed. Restore these interactions now,
without treating the broader request-load checkpoint as complete:

Composer/settings source pass: removed broad composer button styling and unused
textarea rules; Record and Send share a 48px height, Send has explicit centering,
and Discard has its own subordinate destructive style. Settings use an 820×620px
maximum desktop panel, a distinct surface/shadow and compact fields. Duplicate
heading, scrolling-area and fieldset spacing overrides were removed. Frontend build,
31 frontend tests and whitespace checks pass. Native visual inspection is pending:
the computer-use tool could not attach to the development application. Audio
preferences, auto-send and graph restoration are not implemented by this pass.

- [ ] Match the reference composer geometry, button alignment and Discard styling;
  verify idle, recording, transcription, error and narrow-window states.
- [ ] Restore compact settings density and distinct panel/backdrop surfaces while
  preserving autosave, pending-write handling and backdrop dismissal.
- [ ] Add persisted Audio settings for auto-send and waveform history duration.
  Verify one submission, draft retention on failure, existing typed drafts,
  conversation changes and admission holds. Do not implement auto-send as an effect
  triggered by draft changes.
- [ ] Restore the selectable AI graph using current operation IDs/dependencies and
  attempt states; evaluate reference renderer reuse against these contracts. Keep
  transcript receipts distinct until audio has actual graph ownership.
- [ ] Inspect the running composer/settings/graph at desktop and narrow widths,
  then request one concrete native audio/settings check from the user.

This pass restores interaction fidelity; automatic analysis fan-out remains gated
on the outstanding request-load work. Hosted/self-hosted batching and protocol
replacement stay on the implementation checklist.

The product checkpoint is the reference chat/Record composer alongside Lesson/Analysis
and a docked coach. Immediate startup, title-free creation, desktop capture/hosted
transcription and durable separate coach turns are implemented. Verify the native
flow before expanding report or visualization work. Structured lesson controls,
read-aloud, auto-send, suggestion trays and passage breakdowns remain open.

## Current checkpoint: server-independent AI access

Custom URL uses the shared grouped server protocol and an authenticated capability
probe. Local server/emulator and native custom-route verification remain open.

Hosted, API-key and custom routes are implemented for partner/coach chat and
transcription. Read-aloud remains separate future work. Capability, transport and
credential-boundary tests are implemented; live Groq/custom/native visual checks
remain pending. Keep platform credential storage; the session-only suggestion was
withdrawn. See `SECURITY.md` and README for the actual boundaries.

## Next checkpoint: request-load resilience

Decision: the current native resolver, durable chat attempts and hosted admission
are sufficient foundations to start this work now. Complete shared client admission
before adding automatic analysis fan-out; no full graph, flower or statistics
implementation is needed first. Checked items below are implemented; unchecked
items remain work. The [source audit](./architecture.md#request-load-audit--september-10-2026)
and [post-mortem](./INCIDENT-POSTMORTEM.md) distinguish facts from causal hypotheses.

### First slice: native admission across all three routes

- [x] Centralize the provisional native inference ceiling at four, including the
  Step check; add rate-limited, content-free native saturation diagnostics. Keep
  one waiting transcription as a separate volatile-memory bound. Verify warning
  suppression and full-capacity release in tests. No automatic limit increases.

- [x] Chat attempts are durable; adapters do not silently retry failed requests or
  substitute another route. Transcription attempts are not yet durable.
- [x] Put partner chat, coach chat and desktop transcription behind one app-wide
  network admission owner with a provisional ceiling of four. Retain target/revision capture and
  source checks. Bound waiting audio to one recording; reject excess without
  submission. Recheck validity while queued and after keychain access.
- [x] Represent transcription attempts and unknown outcomes durably without storing
  audio for replay. Record before submission; reconcile interrupted attempts to
  unknown on restart. Duplicate IDs cannot submit again. Persist only metadata;
  usage reports include transcription with unavailable tokens. Refusal holds and
  app-wide pause guard submission; source/connection changes defeat publication.
- [ ] Integrate audio as a graph operation if it needs Step control. Current recording
  submission is explicit; there is no stored recording to replay or silently resume.
- [x] Retain typed refusal reason, affected scope, safe request ID and retry timing
  through adapters, attempts and IPC. Hold related queued work on quota/rate refusal;
  Step, Resume, repeated Send and restart cannot bypass the hold. Unrelated targets
  remain eligible within global capacity. Do not parse error prose for policy.
- [x] First queued-chat boundary: HTTP 429 carries typed refusal metadata. Matching
  pending chat/coach turns pause transactionally without invented network attempts;
  hold reason/timing survives restart and is visible in execution inspection. Resume
  and Retry honor a known earliest retry; Step cannot bypass the hold. Explicit
  recovery releases one turn, never automatically drains the queue. Tests cover
  independent credentials, hosted service scope, restart and expiry without replay.
- [x] Extend holds from submitted chat turns to a shared target admission record
  covering fresh submissions and waiting transcription. Audio HTTP 429 records
  the shared hold; new Send is rejected before acceptance. Holds survive source
  deletion. Recovery is revision-checked, honors timing and dispatches no requests.
  Spending-pause recovery still relies on explicit user correction and server
  enforcement; local Resume does not establish that billing has been reconciled.
- [x] Bound outstanding chat/coach network work to 64 operations, including paused,
  dependency-waiting and running work. Send and Retry reject transactionally before
  new acceptance when full. Count all retained nonlocal attempts against a 16-attempt
  per-turn budget, including failures and unknown outcomes; restart does not reset it.
  These code defaults do not change four-slot concurrency. Rate-limit a metadata-only
  saturation warning to once per minute. Audio retains its separate one-waiter bound.
  Tests cover mixed chat/coach saturation, rejected Send/Retry without mutations,
  cancellation freeing capacity and budgets across restart.
- [ ] Give verification/status commands separate bounded native admission and
  equivalent-request coalescing across windows. Keep checks explicit and non-inference.
- [ ] Test using fake providers: mixed chat/audio never exceeds configured client capacity;
  route switching cannot multiply capacity; a backlog receiving 429 stops related
  dispatch; unrelated work continues; pause/resume/Step and cancellation obey limits;
  restart never replays ambiguous requests or silently clears unresolved holds.
- [ ] Test all three adapters, repeated native command delivery and credential/URL
  changes during waiting and dispatch. Verify no prompt, secret or raw endpoint URL
  is added to diagnostic output. Run relevant README native/frontend/contract checks.

Shared-capacity tests cover mixed chat/audio occupancy, waiting-audio fairness,
queue saturation, invalidation and dropped futures. They do not establish live
microphone behavior. Durable receipt tests cover restart without replay, duplicates,
source deletion, archive/revision invalidation and unavailable usage. Refusal tests cover the
submitted-chat holds, shared fresh-submission/audio admission, stale recovery and
retained hold authority when extending the active schema.
Verification: 68 native tests and 31 frontend tests pass. Clippy, formatting,
contract drift check, frontend build and native executable build pass. Native HTTP tests used loopback fake
providers with localhost permission, not paid production requests.

Exit: demonstrate a controlled refusal and recovery in a local fixture with request
counts visible. No paid production load test. A native UI check is ready only after
implementation and automated checks.

**Live user check (2026-09-10):** user reports the hosted microphone/send flow
succeeded. Read-only inspection of the active schema-7 database confirms one
successful transcription at 13:04:18 UTC (1.994 seconds) and one subsequent
successful hosted Gemini request at 13:04:24 UTC (1.881 seconds; 346 input and
13 output tokens). Neither receipt has an error; no shared refusal holds remain.
The additional local context attempt is not a provider request. These receipts show
no duplicate attempts for this test. Runtime stdout/stderr goes to the development
terminal, whose scrollback was not available to this inspection; this is receipt
verification, not a complete console or server-log audit. Receipt visibility after
a user restart remains unconfirmed. Error/restart-during-request cases are covered
by local tests; no production request storm is needed.

### Second slice: hosted fairness and diagnosis under load

- [x] Separate bounded authenticated status/diagnostic short-window capacity from
  paid-call floods: inference 60/subject and 240/process/minute; control 30/subject
  and 60/process/minute, combined ceiling 300. Both status and diagnostics use the
  separate daily diagnostics allowance. Tests cover multi-account lane saturation,
  repeated rejected requests and expiry. The shared 128-subject storage ceiling and
  infrastructure saturation can still prevent diagnostics. These are process-local
  ingress bounds, not distributed in-flight leases.
- [ ] Integrate and verify distributed per-account in-flight admission before provider
  dispatch. The transactional claim/finish module is implemented with eight leases,
  five-minute expiry, duplicate status without redispatch and ownership-checked
  completion. Four fake-ledger tests pass; cross-process emulator coverage is added
  but not run. The grouped `/v1/operations` endpoint invokes the module; native client integration remains open. Specify atomic lease identity, expiry longer than bounded request work,
  crash handling, duplicate release and uncertain upstream outcomes. Prefer prompt
  refusal to a server queue holding connections; the client owns bounded waiting.
- [ ] Keep daily infrastructure-attempt accounting and spending reservations distinct.
  Confirm noisy clients cannot debit another account's personal quota. Shared limits
  remain shared: test and document their deliberate availability tradeoff, including
  revoked sessions, without removing bounds on authentication/database work.
- [ ] Add bounded allowlisted protocol/build and operation/attempt metadata for hosted
  diagnosis. Treat client fields as untrusted, reject malformed/oversized values and
  keep them out of high-cardinality metric labels. Do not log prompts, keys, arbitrary
  URLs or new persistent device identities. Define retention/access before logging.
- [ ] Test multiple service instances through fake providers and the Firestore emulator;
  verify structured refusals, independent diagnostics capacity and lease recovery.
  Retain exact image/revision rollout checks. Deployment and Git writes stay with user.

### Before dynamic analysis, and deferred choices

- [ ] Complete the hosted/self-hosted grouped-transport contract and implementation:
  versioned envelope, independent streamed results, bounded per-item admission,
  duplicate protection and disconnect recovery. Specify self-hosted authentication
  and replace the generic custom endpoint route against this same server contract.
  Keep direct-key execution local with equivalent accounting/refusal principles.
  Group size and execution concurrency are separate tunable policies; select values
  through fake-provider load/latency tests before deployment.

- [ ] Evaluate semantic grouping of compatible annotations at graph planning, before
  admission, against separate calls. Preserve item/source identity and single-call
  usage accounting; bound grouped work and measure first-useful-result latency.
  Do not batch unrelated queued work or add a server envelope that conceals unbounded
  provider fan-out. See EXECUTION.md's request grouping and batching contract.
- [ ] Before adding child-operation expansion, enforce finite graph/attempt budgets
  including repair attempts, with fake many-node/resume/refusal tests. Opening panels
  or hydrating reports must issue zero inference requests. Tune budgets from measured
  fixtures and evaluation, not a guess about one chat message equaling one request.
- [ ] A hosted protocol gate remains a proposal: define a separate protocol generation,
  missing/unsupported handling and a stable update-required response before enabling
  enforcement. Preserve sign-in/status. Package semver is not chronological here,
  and spoofable client headers cannot be an abuse or authentication boundary.
- [ ] Automatic retries remain disabled. Any future retry policy needs classified
  eligibility, validated Retry-After, bounded delay/jitter and the same admission and
  attempt budgets; daily exhaustion and unknown paid outcomes are not blind retries.

Server limits remain necessary even with native protections. Cloud Run concurrency
is a per-instance capacity setting, not per-account admission; see
[Google's concurrency contract](https://docs.cloud.google.com/run/docs/about-concurrency).

### Request-work budget verification

The native queue/attempt budget slice passes its two focused tests, the 70-test
native suite and Clippy. It adds no schema, provider calls, transport retries or
UI settings. No live load test is needed for these local rejection paths. Grouped
transport, self-hosted protocol replacement, control-plane coalescing and distributed
server admission remain unchecked work; this slice does not implement batching.

### Server ingress verification

Server suite: 171 passed, six Firestore-emulator tests skipped. Fake-ledger and
in-memory tests verify lane separation and daily accounting. No emulator or live
cloud result is claimed. Server deployment remains user-controlled; grouped
transport and distributed duplicate/in-flight admission are not implemented here.

### Grouped server execution

Implemented the authenticated version-1 `/v1/operations` text-chat endpoint with
bounded envelopes, independent NDJSON completion, per-item infrastructure/spending
accounting, attempt claims, and shielded settlement/claim cleanup. Fake-provider tests
cover duplicates, mixed outcomes, completion ordering and cancellation. Native
batch assembly, streamed-result persistence, self-hosted authentication and emulator
verification remain incomplete. Do not deploy this as a completed protocol cutover.

### Native grouped transport checkpoint

The scheduler groups ready hosted operations by captured endpoint, credential,
configuration revision and install identity. It collects available work in a bounded
local pass without a batch-fill timer. Each operation owns one of four shared native
permits, released after its result is committed. Direct-key calls remain independent.
Groups currently contain at most four items because execution capacity is four;
server envelope capacity is separately eight.

NDJSON callbacks commit individual results immediately. A broken stream marks only
unconfirmed items unknown and cannot overwrite committed siblings. Cancelling one
in-flight item revokes its publication while the shared transport continues for
active siblings; cancelling all revokes the shared request. Preflight checks still
reject a group if any captured item loses authority before transmission.

75 native tests and Clippy pass, including a two-item loopback request with a durable
partial result and missing sibling. The server suite includes a Docker context
allowlist check for runtime modules. Custom URL protocol/authentication integration,
local emulator setup, native custom-route QA and deployment remain incomplete.
Neither gcloud nor Docker was available on the inspected shell PATH. No emulator
or live server verification is claimed. A rebuilt hosted client requires the grouped
server endpoint; there is no fallback endpoint.

### Custom server source integration

Hosted and custom chat use the same scheduler grouping and version-1 NDJSON transport.
Custom checks `/protocol`, validates configured capabilities, uses its own stored
session token and omits hosted installation headers. The server exposes this probe
under authenticated control-lane admission. Native loopback tests cover both routes;
74 native, 184 server and 31 frontend tests pass; seven emulator tests skip. Full
local runtime QA requires Java and the Firestore emulator, neither available in the
inspected environment. No unauthenticated server mode was introduced. Live local
server provisioning and validation remain work; no production deployment occurred.

### Local Firestore verification

All seven emulator tests pass locally, including cross-process duplicate claims
and the shared eight-lease limit. Tooling is isolated under `/private/tmp`, uses
Homebrew Java 21 explicitly and binds only loopback. No production credentials or
cloud project were used. Full local HTTP server/fake-provider and native Custom URL
QA remain outstanding. Setup commands and exact versions are in server/README.md.
