# Conversation execution split

Status: implemented, 2026-09-15. First file in the descending size cleanup;
other oversized implementations have not been changed.

Replaced the 6,828-line conversations/execution.rs with execution/ containing
33 Rust files, all below 500 lines. The largest is tests/reading_gloss.rs at
432 lines; turns.rs is the largest implementation at 429 lines.

## Responsibility map

| Module | Responsibility |
| --- | --- |
| mod.rs | Stable public interface, Dispatch record and small common helpers |
| admission.rs | Outstanding work and attempt budgets |
| holds.rs | Refusal-related queue holds and release |
| connections.rs | Connection settings, credential lifecycle and invalidation |
| turns.rs | Accepting sends/openings/coaching, suggestions and turn controls |
| snapshots.rs | Conversation projections and pagination |
| dispatch.rs | Selecting and capturing work for dispatch |
| publication.rs | Attempt authority, completion publication and turn state |
| reading.rs | Reading-result paths and explicit gloss retry |
| speech.rs | Speech source authority, requests, publication and cache reads |
| recovery.rs | Reconciliation after restart |

Tests are grouped by behavior: speech requests/publication, gloss, translation,
connections, language context, refusal holds, turn lifecycle, work budgets,
grouped transport, snapshots, lesson context, coaching, revision history/publication,
practice openings/feedback, rewards and partner feedback. Shared fixtures remain
in one 247-line test-only module. Live-provider coverage remains separately ignored.

The existing execution entry points and Store methods remain available. Helpers
shared across sibling files use module-scoped visibility. Transaction boundaries,
SQL, state transitions, provider contracts and test bodies are preserved; rustfmt
only reformatted moved code. This does not disentangle every cross-domain call.

## Verification

- All 164 function names, 94 execution test attributes and the ignored-test count
  preserved. Compared extracted functions against the original; differences were
  formatting (including a match-arm block simplified by rustfmt).
- Every resulting file is below 500 lines.
- Clippy with warnings denied, generated-contract check and desktop build passed.
- UI architecture suite: 18 tests passed across 5 files.
- Current documentation links passed.
- Full native suite: 353 passed, 1 ignored, no failures (132 seconds).
- Rust formatting and diff whitespace checks passed.

Updated AGENTS.md, native/README.md, content index and the repository size inventory.
The next oversized file is native/src/storage/store.rs (1,717 lines). No commit,
push, deployment or manual application launch was performed.
