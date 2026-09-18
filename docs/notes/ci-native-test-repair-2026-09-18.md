# Native CI test repair — September 18, 2026

Status: focused test changes under verification; production behavior and CI
timeouts are unchanged.

## Observed failures

[CI on d231fa9](https://github.com/freemocap/skellyspeak/actions/runs/35386745872)
passed every job except Windows Rust. The starter-persona test failed, then the
library test step reached its 15-minute timeout with the queue-budget test still
running. Server deployment is a separate, successful workflow.

The persona test assumed every starter has exactly three vibe emojis. Domain
validation allows two through four; Italian, Irish and Scottish Gaelic starters
have two. The test now checks the domain bounds while retaining full persona and
romanized-name validation.

The queue test filled the 512-operation limit with hundreds of separate coach
conversations. Each command also constructs a full workspace snapshot and runs
the existing lesson-suspension scan. Setup cost grows with workspace size.
The test now fills most capacity with real multi-operation chat turns and uses
single-operation coach turns for the remaining slots. It preserves the production
limit, mixed chat/coach admission, restart, retry refusal, no rejected-message
publication, no dispatched attempts, and cancellation freeing capacity.

## Scope and verification

These two candidate edits already existed among the ongoing workspace changes.
They were copied alone into `/private/tmp/skellyspeak-ci-repair`, based on committed
`d231fa9`, so verification does not depend on the larger in-progress refactor.
No runtime code, language content, workflow timeout, or ignored-test list changed.

- Rust formatting check: passed.
- Starter-persona validation test: passed (5.97 seconds).
- Queue-budget test: passed (167.09 seconds) on the local Mac.
- Full native suite: 392 passed, 0 failed, 16 existing ignored tests, in 151.41 seconds.
- GitHub Windows verification: pending.

The local queue test remains substantial; its timing is not a Windows timing
guarantee. A local stack sample identified the lesson-suspension scan as setup
work. Removing that subsystem belongs to the separate refactor already in
progress and is not bundled into this CI repair.
