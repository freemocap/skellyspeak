# Domain coordination and integration

This is the working agreement for parallel work on rebuild. Product intent remains
in DESIGN.md; implementation order remains in BUILD-PLAN.md. This folder assigns
work and records integration decisions; it is not a competing product specification.

The user creates the separate domain chats. This integration task coordinates them,
reviews handoffs, resolves contract conflicts and validates combined work. No domain
agent is active merely because its assignment exists. Git remains read-only for
agents unless the user explicitly authorizes a particular mutation in that session.
The release's one-time permission is exhausted. Do not edit AGENTS.md to grant powers.

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
| Integration | Shared contracts, dependency order, cross-domain tests, release readiness | This coordination pass | Preparing assignments |
| Execution/reliability | Scheduling, admission, authority, attempts, access routes | R1: translation lifecycle verification | Ready after checkpoint |
| Language analysis | Source segmentation, annotations, linguistic validation | L1: passage contract and pure analysis core | Ready after checkpoint |
| Product/interaction | User workflows, accessible presentation, style consistency | U1: source-linked reading interaction | Ready after checkpoint |
| Evidence/progression | Observation eligibility, rubrics, XP and reports | No implementation assignment yet | Queued |
| Visualization | Garden/skill-map renderers and mathematical avatars | No implementation assignment yet | Queued |

Read the matching file in assignments/. Start with R1, L1 and U1 only. Evidence and
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

L1 proposes the source/annotation boundary. U1 can design with explicitly labeled
fixture data immediately, but must not independently define a production token
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
