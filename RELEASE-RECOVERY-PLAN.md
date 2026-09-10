# Release recovery outcome and branch ownership

Status: complete. The user reports v0.13.7 is published and functional.

## Working branches

- main: released application, v0.13.7 at eaa94bb. Use its separate worktree for
  release maintenance. Server deployment is gated to main.
- rebuild: active next-generation application and design in the original skellyspeak
  folder. The user has pushed this branch. Resume work from BUILD-PLAN.md here.
- release-recovery: completed recovery branch, merged through PR #29. Its worktree
  can be retired separately; no deletion is required for development to resume.

Git mutations remain user-operated. The one-time authorization to commit/push the
Android fix and patch tag was completed; it is not ongoing authorization.

## Delivered and verified

Recovery preserved the secured server while restoring the released UI and applying
bounded inference admission, refusal holds, no automatic HTTP 429 retry and one
in-flight guided turn per conversation. Its standalone server transport is distinct
from rebuild's grouped transport; do not transfer guarantees between them.

The coach annotation patch removes inference from reading-component rendering.
Saved glosses remain local; unannotated words use explicit inspection. Source reply
validation tolerates whitespace layout changes while rejecting changed content.
Local checks passed: 393 frontend tests, 190 Rust tests and Clippy, plus the native
bundle. Recovery PR CI passed. The user verified hosted access and coach behavior,
then reported the published v0.13.7 functional. This does not claim exhaustive
phone-device QA or prove the initiating cause of the original incident.

Android packaging required the tracked platform project, omitted during recovery.
The fix restores it and makes CI reject missing required source files instead of
passing an empty resource scan. v0.13.6 was not rewritten; v0.13.7 carries the fix.

## Lessons for rebuild

A QA session recorded 61 distinct annotation operations and 77 attempts across four
reply operations. Exact-request caching would not remove that fan-out. After the
patch, the inspected session contained zero annotate_text operations. Rendering
must not schedule paid work. Define operation ownership, bounded expansion and
source-derived identity before adding assistance. Preserve concurrency and partial
results while eliminating unintended requests.

Do not require generative output to reproduce deterministic source formatting.
Test semantic source correspondence separately from presentation whitespace.
Keep traces attributable to source/operation and measure actual request counts.
The original crash trigger remains unproven; see INCIDENT-POSTMORTEM.md.

Recovery runtime changes are not automatically rebuild code. Review shared server,
CI and packaging fixes individually; avoid merging main's application into rebuild.
