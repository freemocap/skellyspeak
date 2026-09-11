# Build plan and architecture review

## Current checkpoint — rebuild, 2026-09-10

Release recovery is complete: main carries v0.13.7, and the user reports the
published application is functional. This document governs rebuild, not the
released application. See RELEASE-RECOVERY-PLAN.md for branch ownership and results.

The AI access foundation is implemented: hosted and self-hosted grouped chat,
direct-key execution, durable attempts, refusal holds and bounded concurrency.
The user verified hosted, direct-key and local Custom URL exchanges before the
recovery work. Seven local Firestore emulator tests passed. These are completed
checks, not a fresh verification of a newly launched rebuild session.

Current slice: scheduled partner-reply translation is implemented and locally tested;
basic hosted native QA is verified. Next, parallel domain assignments close lifecycle
gaps and establish the source-linked reading contract. Do not merge the recovered application
into rebuild or treat released-app tests as rebuild verification.

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

**Verification:** native sign-in and own-key exchanges were user-verified.
Repeat a short native smoke check when resuming the rebuild development session.

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

- [x] Specify and implement hosted sign-in/session lifecycle, validation, model/provider
  allowlists, quota, attempt receipts and metering reconciliation.
- [x] Correct Custom URL to target a self-hosted instance of our server through the
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

## Current implementation and remaining boundaries

- Local ownership, SQLite persistence, typed IPC, partner/conversation creation,
  chat and a private coach thread are implemented. Partner-reply translation is implemented. Token-level learning assistance,
  assessment, earned XP and geometric Vibe are not implemented.
- Hosted and Custom URL use version-1 grouped `/v1/operations` with independently
  committed NDJSON results. Direct-key execution runs locally. Custom URL means
  our self-hosted server contract; credentials and destinations do not fall back.
- Native chat/coach/audio share bounded capacity. Chat/coach outstanding work is
  capped at 64; four native execution permits remain provisional. Server envelope
  size and execution limits are separate policies, not reasons to serialize work.
- Distributed server attempts/leases and duplicate claims have emulator coverage.
  Unknown outcomes do not silently retry. Status calls use server control capacity.
- Private coaching text exists; structured coaching, source attribution, inference
  about skills, and evaluated Fast-model assignments remain separate phase work.
- Desktop recording exists. Mobile audio, phone credentials/lifecycle and rebuild
  platform packaging require their own verification. Recovery's platform results
  do not establish rebuild platform readiness.

## Assistance implementation sequence

1. Inventory current graph declarations, execution tests and assistance output slots.
   Freeze one small partner-reply assistance contract with immutable passage identity,
   source revision and deterministic text offsets. Do not ask a model to recopy known
   source text merely to attach metadata.
2. Specify the finite operations launched by a submitted turn and their attempt
   budgets, including any structured repair. Preserve independent completion and
   partial hydration; no batch-fill delay or global serial execution.
3. Implement that assistance through the existing scheduler and durable results.
   Rendering reads results only. Panel mount, reopen, preference changes and report
   hydration must cause zero inference. Explicit word help remains explicit work.
4. Test exact duplicate delivery, source edits/deletion, cancellation, refusal,
   pause/resume and repeated panel interaction. Assert request counts and publication
   ownership, not just the appearance of a spinner. Add originating operation/source
   metadata to diagnostics without logging secrets.
5. Run relevant README checks, then request a native QA pass on this specific slice.
   Inspect request counts and first-useful-result latency before expanding operations.

Use Standard initially. Assign Fast only after the bounded evaluation in
AI-EVALUATION.md. Semantic annotation batching and persistent caching are separate
optimizations; neither is required to establish correct work ownership.

## Remaining focused follow-ups

- Review bounded native status/verification admission and coalescing separately
  from inference capacity. Confirm audio Step semantics before putting it in the graph.
- Verify both model roles only when actual task assignments exist; no claim of Fast
  conformance follows from a successful Standard reply.
- Carry Android packaging lessons into rebuild's platform phase: keep required native
  sources tracked, ignore generated/local secrets, and fail checks on missing input.
- Review shared fixes individually. The 100-installation ceiling is already present.
  Do not merge main wholesale; its application is the recovery implementation.
- Defer unrelated dependency upgrades to reviewed maintenance. The recovery docs-only
  image-size finding is not proof of an affected rebuild dependency graph.
- A stricter client protocol gate remains a proposal. Client semver and installation
  headers are not authentication or abuse-control boundaries.

No new implementation or fresh runtime verification is claimed by this docs update.

## Translation slice verification

Implemented reply_translation as a Standard dependency of partner_reply, captured
only when Translation is enabled at Send. Results persist against the immutable
source message's turn and hydrate independently. An assisting turn leaves the next
Send available. Explicit assistance retries cannot regenerate the saved reply.

Translation regressions cover duplicate result delivery,
restart, concurrent next Send, cancellation, source deletion and zero scheduling
from repeated snapshots or preference changes. Runtime evidence is recorded below;
the current UI graph remains unconnected.

Live hosted translation check, 2026-09-10: the user confirmed two exchanges work.
Read-only inspection of durable receipts found one successful reply attempt and
one successful translation attempt per exchange, one saved assistant message and
one saved translation each, no errors in these exchanges and zero active operations
at inspection. This verifies the basic hosted path; other routes and interactive
cancellation/restart scenarios are not established by this session.

## Current parallel implementation round

[workflow/README.md](workflow/README.md) records exact ownership and authorization.
The user approved Language/Reliability implementation and the reference-based UI.
Material product or visual changes still return to the user; routine technical
integration proceeds without acknowledgement loops. Agents never mutate Git.

Rebuild 002afd4 contains translation lifecycle fixes, deterministic source validation,
the strict gloss prompt/decoder and the connected conversation UI. Combined checks:
342 frontend tests, 121 native tests, build, generated contracts and Clippy passed.
Recording initializer formatting is corrected. CSS cleanup remains a separate gate;
Interaction is resolving its 71 audited violations while preserving appearance.
The basic UI candidate's chat/translation/coach path has user runtime verification.
No live gloss feature, evidence/XP or connected diagnostic graph is claimed.

Next work, in dependency order:

1. Finish and independently review Interaction CSS cleanup and its visual checks.
2. Reliability G1a adds typed structured request construction to direct/grouped
   transport, with exact size checks and unchanged prose requests. No new operation
   or request trigger. Language reviews candidate schema/size compatibility.
3. Integrate reviewed contributions through user-run Git and run combined checks.
4. Wire operation-selected completion validation, retaining usage on invalid output.
5. Define one whole-message gloss child with source-owned durable results, independent
   translation completion, explicit operation retry and zero inference from reading.
   Resolve activation policy and route capability evidence before enabling it.
6. Connect saved validated word spans to existing reading presentation, then request
   a focused real-app check with expected operation counts and partial-result behavior.

G1a server conformance tests verify strict-schema forwarding, routing authority,
request size and pre-inference rejection. Full server fixtures: 209 passed, seven
Firestore-emulator cases skipped because no emulator was running. No production
server changes, live model conformance calls or deployment are implied.

Selected-word detail families remain a separate slice. Their lifetime budget must
not make a passage permanently uninspectable after sixteen distinct word requests;
bound retries per logical request separately from shared concurrent capacity.
