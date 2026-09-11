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

Rebuild 002afd4 integrates translation lifecycle fixes, deterministic source validation,
the pure gloss prompt/decoder and the conversation UI. Combined checks passed:
342 frontend tests, 121 native tests, frontend build, generated contracts and Clippy.
Recording metadata formatting is corrected in the integration working tree. CSS has
71 audited checker violations awaiting the scoped Interaction contribution.
User native QA confirmed the UI candidate's basic chat/translation/private-coach path;
this does not establish all-route, microphone or combined-build runtime coverage.
Main maintains released v0.13.7 and is not a feature integration branch.

| Domain | Current finite assignment | State |
| --- | --- | --- |
| Integration | Combined verification, server structured contract tests, next execution/storage seams | Active |
| Reliability | G1a: typed structured request construction and direct/grouped transport tests | Reviewed; awaiting user checkpoint |
| Language | Transport review and G1b pure completion termination validation | Reviewed; awaiting user checkpoint |
| Interaction | CSS rule ownership cleanup preserving current appearance | Reviewed; awaiting user checkpoint |
| Evidence/progression | Observation eligibility, XP and dense reports | Unassigned |
| Visualization | Garden/skill-map and static mathematical avatars | Unassigned |

## File ownership for this round

Use the existing separate user-created worktrees. No agent Git writes. Only one
native dev app may run: worktrees share app identity, data and port. Coordinate runtime
QA with integration before launch; source isolation does not isolate application data.

| Surface | Writer |
| --- | --- |
| Reliability worktree provider.rs/grouped.rs and colocated transport tests | Reliability G1a |
| Language worktree linguistics/adapter.rs, adapter_tests.rs and owned reports | Language |
| Interaction worktree styles.css and scoped graph CSS-variable presentation changes, verification/report | Interaction |
| Root native model/storage/execution/commands/contracts and server tests | Integration |
| Root docs, manifests/locks and shared UI controllers | Integration |

G1a may define a transport-local Rust output-contract type in provider.rs. It does
not need an IPC model or generated declaration. Existing prose requests remain
unchanged; no production gloss operation, new scheduler, fallback, retry or UI trigger
is enabled in this slice. Direct and grouped payloads share construction, preserve
route authority, and preflight the complete bounded request. Decoder selection and
durable publication are separately reviewed execution work.

Interaction resolves cascade ownership, not checker suppression or layers of overrides.
Preserve density, responsive layouts, reduced motion and the accepted presentation.
Measure style/geometry comparisons and state verification limits explicitly.

## Next dependency boundary

Language's strict decoder is integrated but has not been tested against live model
output. Server schema envelope acceptance is not evidence of model keyword support.
Review G1a and the Language transport report before activating a gloss operation.
The intended next slice is one whole-message gloss child, independent of translation,
with immutable source binding, retained usage on invalid output and durable partial
results. Reading/revealing/reopening never starts inference. No per-word fan-out.
Operation-scoped retry and source/authority checks must be reviewed before exposing
retry controls. No broader contextual-detail storage model is needed for this singleton.

## Integration procedure

1. Domain finishes a bounded diff and local handoff, including its base revision.
2. Integration reviews exact code, ownership, contracts and independent checks.
3. User checkpoints the domain and integrates the reviewed contribution into rebuild.
4. Integration runs relevant README checks and cross-domain regressions. Isolated
   success is not combined verification. Never describe failing gates as passed.
5. Request native QA only for a runnable artifact, with build/worktree, actions and
   expected requests. Record source tests and real-provider/device checks separately.
6. Update current docs and assignments. Notify the user only for meaningful progress,
   product choices, Git steps, blockers or specific runnable QA.

The ten-minute coordination follow-up remains quiet when nothing actionable changes.
No acknowledgement loops: continue independent work while another domain is active.

Latest isolated reviews: Reliability93native tests passed; Language15focused adapter
tests passed; Interaction style checker/build passed with342frontend tests reported.
Root read-aloud availability fix passes343frontend tests/build; server fixtures209pass,
7emulator skips. These contributions are not yet combined. Next action is the user
checkpoint/integration block; domain source is frozen for that boundary.
