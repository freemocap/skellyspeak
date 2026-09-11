# Domain coordination and integration

This is the working agreement for parallel work on rebuild. Product intent remains
in DESIGN.md; implementation order remains in BUILD-PLAN.md. This folder assigns
work and records integration decisions; it is not a competing product specification.

The user creates the separate domain chats. This integration task coordinates them,
reviews handoffs, resolves contract conflicts and validates combined work. No domain
agent is active merely because its assignment exists. Git remains read-only for
agents unless the user explicitly authorizes a particular mutation in that session.
The release's one-time permission is exhausted. Do not edit AGENTS.md to grant powers.

## Proposal-first approval — user direction

Every domain begins with an independent proposal/design conversation with the user.
Read-only investigation and proposal documents are allowed. Source implementation,
prototype coding, dependency installation and implementation test/build work require
explicit user approval in that domain chat. Assignment existence, earlier general
build authorization and coordinator contract review do not grant that approval.

Present scope, intended behavior, alternatives/tradeoffs, a recommended bounded
slice, cross-domain dependencies and decisions for discussion. Wait for the user's
implementation go-ahead. Integration coordinates consistency; it does not replace
the user's domain design conversations or approve product changes on their behalf.
Preserve and disclose any work started before this correction as unapproved work;
do not silently delete it or treat it as accepted. No integration of that work yet.

## Starting point

The translation foundation is checkpointed on rebuild at 44b9f92. Hosted native QA
confirmed one reply and one translation attempt for each of two exchanges, with no
extra work left active. This is not full route/device/failure-mode verification.
The assignment documents must be checkpointed before spawning worktrees from rebuild;
each handoff records the actual base SHA, rather than assuming it is still 44b9f92.
Main maintains released v0.13.7; it is not a feature integration branch.

## Domains and initial assignments

| Domain | Responsibility | Current assignment | State |
| --- | --- | --- | --- |
| Integration | Shared contracts, dependency order, cross-domain tests, release readiness | Contract review and sequential integration | Active |
| Execution/reliability | Scheduling, admission, authority, attempts, access routes | R1: translation lifecycle verification | Integrated and verified at 260bb23 |
| Language analysis | Source segmentation, annotations, linguistic validation | L1: passage contract and pure analysis core | Integrated and verified at 260bb23 |
| Product/interaction | User workflows, accessible presentation, style consistency | U1: reference-based conversation reading | User approved; implementation active |
| Evidence/progression | Observation eligibility, rubrics, XP and reports | No implementation assignment yet | Queued |
| Visualization | Garden/skill-map renderers and mathematical avatars | No implementation assignment yet | Queued |

Read the matching file in assignments/. Start proposal discussions for R1, L1 and U1 only. Evidence and
visualization can receive finite design assignments later; do not invent production
scores or infer evidence contracts from visual geometry.

## Worktree and file ownership

Use separate user-created branches/worktrees for implementation: suggested names
rebuild-reliability, rebuild-language and rebuild-interaction. No branch creation,
checkout, commit, merge or push is authorized by this document. Do not share one
dirty checkout between chats. Only one native dev app should run at a time: these
builds share app identity, local data and the default dev port. Worktrees isolate
source, not the native application's data or services. Coordinate live QA time.

| Surface | Writer for this round |
| --- | --- |
| src-tauri/src/execution.rs, admission.rs, holds.rs, grouped.rs, access.rs, provider.rs | R1 |
| src-tauri/src/linguistics/ and its pure tests | L1 |
| src/reading/ and its component tests/styles | U1 |
| model.rs, schema*.sql and other storage initialization, turn_plan.rs, lib.rs, contracts.ts | Integration |
| ConversationView.tsx, LearningPanel.tsx, useChat.ts, App.tsx, root styles.css | Integration |
| Root design/architecture docs, dependency manifests/locks, build and release workflows | Integration |
| workflow/reports/R1.md, L1.md or U1.md | Matching domain |

These are proposed new module directories, not claims that they already exist.
An agent may investigate any source read-only. If a fix crosses its write boundary,
provide the exact proposed change and reason in its report; do not silently edit the
other domain's files. Small integration seams are applied by the coordinator after
review. A whole-file reservation is temporary coordination, not permanent architecture.
Do not add dependencies, change storage or make paid evaluations without resolving
scope and the applicable authorization first. Never hand-edit generated contracts.

## Contracts and disagreements

L1 proposes the source/annotation boundary. U1 can propose fixture-based interactions immediately, but must not independently define a production token
schema. R1 can verify existing translation without waiting on either. When L1's
contract is reviewed, integration records the accepted decision in DATA-MODEL.md
and/or EXECUTION.md, regenerates types if necessary, and gives U1 the exact revision.
Until then, fixture components are review artifacts, not features connected to AI.

For a disputed contract, report: observed problem, affected consumer, proposed
shape/behavior, alternatives, and tests. Continue independent work while waiting.
Integration resolves implementation choices; the user decides material product
changes. Do not reopen settled routes, no-fallback behavior, local storage, or the
separation of data from garden visuals through generic design questionnaires.

Reports are not automatically delivered between chats. Send the coordinator the
report/commit through available task messaging, or ask the user to relay the handoff.
The coordinator publishes decisions and informs affected chats; agents must not
assume another chat has seen their local edits or a changed plan.

## Integration procedure

1. Domain produces a bounded diff and the handoff report; user checkpoints its branch.
2. Integration reads the exact diff and tests, checks ownership and contract fit,
   and records any change requests. A successful isolated test is not integration.
3. Integrate one reviewed contribution at a time into rebuild through user-operated
   Git commands. Do not merge main's recovered application into rebuild.
4. Run affected tests, contracts:check and the relevant README checks. Exercise
   interactions between changes: source revision/deletion, cancellation/refusal,
   reopen/hydration request counts and independent result arrival.
5. Request native QA only for an actual runnable feature, identifying the worktree,
   build, scenario and expected requests. Record measured results separately.
6. Update the owning design/implementation docs and assignment status. A domain is
   complete only when its accepted deliverable is integrated and verified, or its
   explicitly design-only artifact has been reviewed. No automatic deployment.

## Handoff report

Use HANDOFF.md. State code implemented, isolated tests, integration status and native
QA separately. Include open risks and cross-domain effects. Do not claim all tests
passed if only focused checks ran; do not put secrets or conversation text in reports.

## Current integration decisions — 2026-09-10

Language and Reliability have explicit user approval to continue scoped work.
Language temporarily owns its worktree Cargo.toml/Cargo.lock dependency declaration
and lib.rs module registration for the grapheme validator; all other shared seams
remain integration-owned. DATA-MODEL.md records accepted source-boundary requirements.
No paid format pilot is authorized or running.

R1 execution changes have passed coordinator source review and an independent native
test run (88 passed). They remain uncommitted in rebuild-reliability and are not
integrated. User checkpoint is the next Git step. R2 is a proposal, not implemented;
its passage-wide lifetime detail limit was rejected in favor of separating logical
request retry bounds from global concurrent capacity. UI implementation remains
subject to its direct design conversation; its standalone prototype is excluded.

Language core review: coordinator inspected the validator, shared dependency/module
diff and conformance test, then independently ran `cargo test --manifest-path
src-tauri/Cargo.toml --lib --locked linguistics::` in rebuild-language: 21 passed,
including all 766 Unicode corpus cases; 79 unrelated tests filtered out. No blocking
finding for this bounded deterministic component. This does not validate linguistic
quality, provider decoding, live source authority or production publication. Those
remain separate work. Contribution remains uncommitted and unintegrated.

## Combined verification — 2026-09-10

User merged Reliability and Language into rebuild at 260bb23. Combined native tests:
109 passed; frontend tests: 31 passed. Clippy with warnings denied, Rust formatting,
generated contracts, frontend typecheck/build and stylesheet checks all passed.
No native GUI was launched, no provider calls were made, and no release/deployment
is implied. Earlier pending checkpoint statements above describe completed review
steps; both contributions are now integrated.

Next Language slice: isolated strict word-gloss prompt builder and JSON decoder under
linguistics/, using existing serde and validated source boundaries. No provider,
execution, storage or UI wiring in this slice; its boundary-ID format remains an
evaluation candidate. Reliability detail-execution proposal awaits storage/command
seams; UI continues direct parity design review.

## Active follow-through

The coordinator checks domain progress and resolves routine technical dependencies
without requiring the user to repeat continuation instructions. Domains report a
completed handoff or precise blocker directly to integration with a recommended
next action. Assignments must have finite outcomes and retain file ownership.
Do not send acknowledgement loops in place of work. Escalate material product
choices, user-operated Git steps and runnable QA clearly; UI design approval remains
a direct user conversation. A ten-minute thread follow-up checks this integration
round and stays quiet when no actionable state changes occur.

## UI first-slice approval

The user approved the concrete reference-based conversation-reading slice in the
integration task: preserve bubble presentation, typography, inline assistance and
reading gestures within the chat screen. U1 implements reading components/tests;
integration owns shared rendering and root styles. Real messages/translations may
connect now; unavailable gloss/detail/sentence-analysis contracts remain explicit
dependencies, not fabricated features. No repeated approval is required within this
scope. Material visible departures return to the user; routine seams go to integration.
