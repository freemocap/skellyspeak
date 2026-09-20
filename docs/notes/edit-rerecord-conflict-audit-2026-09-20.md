# Edit/re-record false conflicts and related action audit

Status: edit/re-record fix implemented; broader action changes proposed, not
implemented. September 20, 2026. Changes uncommitted.

## Reported failure and implemented correction

`conversations/revision.rs` compared the workspace revision captured when editing
started with the current workspace revision whenever any later turn existed.
Private coach turns counted as a suffix; unrelated analysis/reward publication
changed that revision. The UI also asked for suffix confirmation for coach-only
history. Thus the reported case could show zero later conversation exchanges,
ask for confirmation, then reject the confirmed edit anyway.

The native revision action now uses the actual source identity: the requested
exchange must belong to this conversation and still be its current version.
An explicit revision replaces that source and invalidates its dependent suffix
inside the existing transaction. Workspace revision changes do not reject it.
Pending response work is invalidated as part of replacement, not a reason to
make the learner wait. Existing late-publication guards prevent obsolete results
from appearing. Failed validation/admission rolls the transaction back.

The UI allows editing and sending a replacement while the partner response is
pending, including auto-send of a re-recorded transcript. Duplicate local command
submission remains locked. Coach-only suffixes no longer cause a confirmation;
actual later learner exchanges still show their removal scope. Genuine errors
preserve the edited draft. Already-replaced sources and wrong-conversation sources
still fail explicitly rather than silently targeting another message.

## Broader audit: actionable false-conflict candidates

These three remain unchanged after automatic approval review rejected broad guard
removal. The proposed changes below specify exactly what would change:

| Owner | Current false-conflict trigger | Proposed behavior and retained boundary |
| --- | --- | --- |
| `conversations/openers.rs::accept` | Any workspace revision change rejects starting an empty conversation | Check current conversation existence, archive/access/config validity and atomically enforce “not already started”; do not compare unrelated global revision |
| `conversations/saved_topics.rs::update` | Any workspace revision change claims saved topics changed | Apply validated additions and deletions by topic ID transactionally; an already-present identical topic or already-absent deletion is a completed operation, not an error; retain actual conversation-settings revision checks for settings replacement |
| `learning/coaching/coach_policy.rs::control` | Any workspace revision change rejects a source-bound disclosure/control | Resolve the requested current unreplaced turn and its current validated decision in the transaction; retain the existing per-control preconditions; do not compare unrelated global revision |

Approval-review concern: stale concurrent operations might overwrite/delete newer
state if checks were broadly removed. The candidate fixes need approval as this
concrete scope before continuing; no workaround execution was used. Initial draft
changes to those three files were withdrawn. A later tests-only escalation was
requested after narrowing the source changes to edit/re-record.

## Checks intentionally retained

The audit also examined execution turn admission and store command checks.
Ordinary send/coach-send compare the conversation revision, rather than the global
workspace revision. Settings, persona/contact changes and connection configuration
use the owning record's revision. Those checks protect concurrent writes to the
same object and were not removed. Workspace session ownership, command replay,
wrong-target rejection, source replacement, credential/access, output validation,
queue capacity and late-result guards remain. This audit does not claim every
error across the app is unnecessary or exhaustively covered.

## Verification

- UI: 997 tests passed across 152 files, including direct edit with coach-only
  suffix, sending while a response is pending and retaining drafts on failure.
- Focused native revision tests: 9 passed, including pending-response replacement,
  obsolete-result rejection, suffix cleanup, wrong targets and revision history.
- UI production build and `git diff --check`: passed.
- The first broader native run passed 121 tests and failed three local HTTP tests
  only because the sandbox denied listener binding; rerun with listener permission
  is recorded below when complete.
- No native GUI interaction, live provider request, deployment or commit performed.

Final verification: tests-only execution with local HTTP listeners permitted passed
461 native tests (2 ignored, no failures). Clippy `--lib --tests -- -D warnings`
passed. This supersedes the sandbox-only listener failures above.
