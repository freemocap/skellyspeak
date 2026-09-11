# Domain coordination and integration

Product intent lives in DESIGN.md; implementation order lives in BUILD-PLAN.md.
This document assigns current work and integration ownership. Plans are not working
features. The integration task coordinates domain tasks, reviews handoffs, resolves
technical dependencies and validates combined work.

## Authorization and communication

The user approved Language and Reliability implementation and the reference-based
conversation UI. Continue finite work within those domains without repeated approval
loops. Material product changes and visible departures from the approved UI still
require direct user design review. Evidence and visualization have no implementation
assignment yet. No paid model evaluation or deployment is authorized.

Git is read-only for agents. The user performs checkpoints, merges and pushes;
implementation approval is not Git permission. Never change AGENTS.md to grant powers.
Send completed handoffs or exact blockers to integration. Save every handoff locally
in workflow/reports as well: task-message delivery is not guaranteed. Integration
resolves routine dependencies; do not wait for the user to relay acknowledgements.

## Current baseline and work

The rebuild checkout integrates the desktop voice loop, translation, inline gloss
reading and durable local diagnostics. BUILD-PLAN.md owns the current checkpoint
and next-slice exit criteria; workflow/reports/integration-logging.md records evidence.
The five domain handoffs are complete. No agent is blocked waiting for user QA.

| Domain | Checkpoint responsibility | Next bounded responsibility |
| --- | --- | --- |
| Integration | Consolidate docs, review findings, prepare user commit | Assign reading slice files and verify combined work |
| Reliability/security | Logging/concurrency handoff complete | Reading retry and voice lifecycle regressions |
| Language | Source-bound validation handoff complete | Partial coverage and invalid-span analysis |
| Interaction | Inline reading, voice and diagnostics handoff complete | Compact reading states using established styles |
| AI Operations | Provider/prompt handoff complete | Evidence-based gloss contract/prompt corrections |
| Code Quality | Independent checkpoint hygiene review | Handoff reviews and finite style-guide consolidation |
| Evidence/progression | Unassigned | Rubric/eligibility design after assistance/coaching |
| Visualization | Unassigned | Render approved underlying evidence |

Language and AI Operations first review declarative language configuration and
shared prompts together, per DESIGN.md. Their proposal work may proceed during the
checkpoint; no new language implementation or paid evaluation is implied.

Next-slice implementation starts after the checkpoint with explicit disjoint file
ownership. No new agents, paid benchmark or deployment are needed for this checkpoint.
Only one native app runs: worktrees share app identity, data and development port.
All agents use the integration checkout's absolute log path rather than substituting
their own worktree path.

## Reading-assistance round status

The user authorized continuation. The three bounded source handoffs below are
integrated and independently reviewed by Code Quality.
The prior checkpoint is still uncommitted; agents do not perform Git writes.

| Owner | Owned proposal artifact | Required result |
| --- | --- | --- |
| Language | reports/L1-language-config-contract.md | Minimal current-language config/resolver, provenance and proposed source ownership |
| AI Operations | reports/A1-reading-coverage-plan.md | Small shared-prompt correction and synthetic coverage/grouping cases |
| Reliability | reports/R1-reading-assistance-gates.md | Exact retry, invalidation and independent speech regression gaps |
| Interaction | reports/U1-reading-acceptance.md | Compact inline acceptance checklist; no speculative UI |
| Integration | This coordination section | Review boundaries, reconcile proposals and assign source files |
| Code Quality | Independent handoff review | Check accepted contract and completed diffs before integration |

Latest retained results have complete structural coverage on three replies; one
required an additional gloss request. The first result on that operation is no
longer available after replacement, so do not claim exact replay of its payload.
Structural coverage, contextual word meanings and a future separate phrase layer are distinct
criteria. Use authored synthetic fixtures for missing raw failure payloads; do not
label constructed cases as captured provider output. No paid evaluation, new catalog,
provider change, UI editor or automatic repair loop belongs to this round.

Completed source ownership: Language edits only `src-tauri/src/languages.rs`
for a behavior-preserving declarative table of the existing five languages;
Reliability edits only tests in `src-tauri/src/execution.rs` for one combined
retry-with-speech-running regression. No prompt bytes, public IPC types or provider
choices change in that extraction. Config-version dispatch/provenance rules are
separate pending design work, not an implicit gate added to current conversations.
Interaction also owns `src/lib/conversation-view.ts`, `src/components/chat/TurnView.tsx`,
their tests and `src/types.ts` only if needed to retain the authoritative translation
state in compact presentation (U1-READ-001). No new retry command or CSS system.
AI's recommendation is to retain prompt-v3 in this extraction; semantic evaluation
and any prompt revision remain separate from these behavior/coverage fixes.


## Integration procedure

1. Domain finishes a bounded diff and local handoff, including its base revision.
2. Code Quality reviews the completed diff against the shared guide and established
   CSS/component strategy. Integration reviews ownership, contracts and independent
   checks, and resolves findings with the owning domain before accepting the handoff.
3. User checkpoints the domain and integrates the reviewed contribution into rebuild.
4. Integration runs relevant README checks and cross-domain regressions. Isolated
   success is not combined verification. Never describe failing gates as passed.
5. Request native QA only for a runnable artifact, with build/worktree, actions and
   expected requests. Record source tests and real-provider/device checks separately.
6. Update current docs and assignments. Notify the user only for meaningful progress,
   product choices, Git steps, blockers or specific runnable QA.

The daily coordination follow-up remains quiet when nothing actionable changes.
No acknowledgement loops: continue independent work while another domain is active.

## AI Operations and security ownership

AI Operations owns model/provider capability research and bounded evaluation design.
Its task is 01a0905c-3c58-7fd0-8f67-ae84e6b1c14c. Initial artifacts live in that
projectless task; the root checkout is read-only to it until file ownership is agreed.
Read [A1](assignments/A1-ai-operations.md) for its initial scope.

Reliability owns security review alongside scheduling, admission, duplicate protection
and accounting. All domains remain responsible for secure implementations. This is
not a new approval step for every edit. Integration retains the active gloss failure
repair; AI Operations must not duplicate it or delay it behind model exploration.

Reading-assistance ownership follows the table above. Integration must not absorb
UI work; Interaction owns presentation and Code Quality independently reviews it.
Local model exploration must not delay the reading-assistance milestone.

## Repository maintenance ownership

Code Quality task 01a0908b-d66d-7c93-a205-7a3a89cddfd2 begins with a read-only
inventory and target organization proposal in its task outputs. It owns evidence-based
recommendations for documentation consolidation, dead code, cohesive modules and a
canonical, concrete style guide that externalizes agreed preferences and supplies
a shared implementation/review baseline. Draft rules distinguish settled decisions
from proposals and consolidate existing agreements rather than duplicate them.
Integration assigns bounded cleanup files after review
of references and current writers. Do not move active voice implementation files
under their owners or introduce duplicate documentation/policy. Review remains
proportionate: actionable defects and cleanup, not an approval gate for every edit.


## Continuous quality review

Code Quality owns independent review of every completed change, including UI/CSS
consistency and reuse of established styles. Interaction remains responsible for
implementing UI changes and following its detailed design/styling rules; quality
review does not transfer that ownership to Integration.

An daily task follow-up checks content changes, including uncommitted and
untracked source. Unchanged runs stay quiet. Files still being edited are deferred
until stable or handed off; only the reviewed snapshot is covered. Each completed
domain handoff also requests Code Quality review, so the timer is supplementary.
Findings cite files and applicable settled rules, go to the domain owner and
Integration, and remain tracked until resolved. Draft guide proposals are not
silently treated as adopted requirements. No direct edits to another domain's
active files, Git mutations, deployments or secret inspection are authorized by
this review process.


## Daily domain reviews

Integration, Reliability & Security, Language, Interaction, AI Operations and Code
Quality each have an daily review in their own task. Each checks changed content
across the repository, including uncommitted/untracked source, then evaluates the
parts relevant to its domain against adopted architecture and style guidance.
Unchanged runs are quiet. Review checkpoints track file content, not merely Git
status; active edits are deferred until stable and reviewed scope is explicit.

Findings flow to Integration. Small, clear fixes stay with their domain owner after
ownership coordination and relevant verification; Integration reviews the result
and communicates cross-domain consequences. Unclear intent or architectural/product
conflicts pause the affected fix for a concrete user decision. No simultaneous edits
to another domain's active files, broad unsolicited refactors, or repeated unchanged
findings. Existing Git/deployment/paid-inference boundaries still apply. The daily
checks supplement completed-handoff reviews rather than replace them.

### Shared runtime evidence

All domains read the same private `.local/logs/` run directories. Before diagnosing
an app report, read all streams in every run since the prior checkpoint, including
normal events; correlate app/frontend/native/server/emulator events before
filtering. Use README's Development diagnostic coverage contract. Report missing
sources or delivery failures explicitly. Never infer that no request log means no
UI/capture failure. Keep private logs out of handoffs and version control; report
safe event identifiers, timestamps and conclusions. Code Quality reviews logging
changes for diagnostic usefulness, redaction, failure paths and style adherence.

Current reading repair: the model selects inclusive first/last grapheme IDs under
format v2/template v4; native code maps them into unchanged strict source spans.
Chinese writing guidance is configuration-driven and destination-specific. Arabic
source typography shares one scale across user/assistant text without nested growth.
AI reviewed the new adapter; Reliability verified captured settings and response
lifecycle isolation; Code Quality reviewed Arabic styling. Backend quality review found no actionable issues. Combined native suite: 183 passed. Interaction's current frontend suite:
396 passed, with build/style checks passing. Contract and Clippy checks passed.
No live provider success is claimed for this new prompt revision. No additional model
calls or automatic retries were introduced.

Conversation difficulty/partner navigation proposals are separate design work, not
implemented controls. Word-level speech is an approved on-demand follow-up. The
working tree remains uncommitted.

### Frontend reliability review scope

The user expanded Reliability and Code Quality reviews to frontend resource bounds,
rendering efficiency, cleanup and reused UI code. Prioritize microphone/waveform
profiling and mobile lifecycle checks. Reported choppiness and a white-flash crash
are symptoms, not evidence of a specific cause. Reconcile current source constants
before cost estimates. Coordinate fixes with Interaction after active UI changes
freeze; do not expand the difficulty/Profile delivery with speculative repairs.

### Difficulty and Contact Profile delivery — 2026-09-11

Five-choice conversation difficulty and autosaving Contact Profile are integrated.
Native prompt projection selects one level and excludes presentation/application
controls. Absolute zero is prompt-only, with shared assistance machinery. Current
checks: 188 native tests, 383 frontend tests, build/styles/contracts/Clippy pass.
Interaction checked desktop/narrow layout and keyboard editing; Code Quality cleared
native contracts/prompt and the Profile close-save correction. A focused editor
must save successfully before dialog close; failure keeps the draft visible.

The explicitly approved local development database reset completed at 16:19 UTC,
including its four referenced keychain entries. All logs and the running local
server were preserved. Native app relaunched with fresh data; AI access must be
configured again. Real-app five-level behavior and Profile editing are next QA.
No Git writes, deployment, compatibility decoder or data conversion performed.

### Active correction: toolbar density and fresh AI setup

User rejected the tall difficulty slider and controls blending into the chat canvas.
Interaction is replacing it with the same compact select style immediately beside
Native, with a distinct control-strip surface/boundary and no extra heading or row.
Review full-pane geometry at roughly 590 px, all five options, and narrow layouts;
absence of overflow alone is insufficient.

Fresh AI setup exposed repeated local save_access_settings validation failures and
a dirty-state lock that prevented route/panel recovery. The exact rejected input is
not recoverable from redacted logs. Interaction owns recoverable draft/error handling;
Reliability owns safe rejection codes and removing credential I/O from the shared
Store lock. The Keychain blocking pattern is a separate source finding, not a proven
cause of the recorded validation failures. No new reset is authorized or needed.
