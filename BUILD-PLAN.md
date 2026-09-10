# Build plan and architecture review

Status: implementation authorized. Phase 1 is implemented and verified locally
on macOS; mobile/other-platform verification remains explicitly outstanding.
Phase 2 source implementation and automated conformance checks are in place; live-provider and system-keychain verification remain pending. Native macOS setup
and connection controls were inspected. No paid evaluation or deployment has run.

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
| Provider scope | Hosted and own-key OpenRouter; Chat Completions custom adapter | Native Google-key generation is outside the initial adapter set |
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
- [x] Implement custom URL/auth/model configuration and explicit protocol capabilities.
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

The conversation execution checkpoint requires native and live-provider verification. After that
exit, proceed to independently arriving assistance and evaluated task routing.

## Active checkpoint: hosted access and utility panels

Desktop Google sign-in, secure session storage, allowance refresh and hosted reply
routing are implemented. This work advances the desktop client portion of Phase 4;
custom URLs, mobile sign-in and deployment validation remain open. The next native
checkpoint is Google browser sign-in, account status and a persisted hosted reply.
Own-key testing is deferred at the user's request.

Toolbar AI docking/pop-out, Profile usage reports and searchable settings are
implemented. See `UI-SURFACES.md` for the adopted interaction inventory and remaining
feature dependencies. No assessment/XP or voice functionality is implied by these panels.

## Current priority: voice-first chat and coach

The product checkpoint is the reference chat/Record composer alongside Lesson/Analysis
and a docked coach. Immediate startup, title-free creation, desktop capture/hosted
transcription and durable separate coach turns are implemented. Verify the native
flow before expanding report or visualization work. Structured lesson controls,
read-aloud, auto-send, suggestion trays and passage breakdowns remain open.

## Current checkpoint: server-independent AI access

Hosted, API-key and custom routes are implemented for partner/coach chat and
transcription. Read-aloud remains separate future work. Capability, transport and
credential-boundary tests are implemented; live Groq/custom/native visual checks
remain pending. Keep platform credential storage; the session-only suggestion was
withdrawn. See `SECURITY.md` and README for the actual boundaries.
