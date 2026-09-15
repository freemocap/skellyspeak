# Native subfolder checkpoint

Status: implemented after approval, 2026-09-15.

Applied the [approved whole-file grouping](folder-moves-proposal.md); the
[move inventory](subfolder-moves.json) records 29 files. The maintained map is in
[native/README.md](../../../native/README.md), with placement and source-size rules
in [AGENTS.md](../../../AGENTS.md).

Moved whole implementations and schema files. Updated Rust imports, module
declarations, embedded SQL paths, the microphone diagnostic target and content
index links. Existing hosted mobile module registration remains platform-gated.
Existing function inventories and SQL contents are unchanged. No functions,
types, tests or transactions were extracted; the oversized-file backlog remains
in the deferred decomposition proposal.

## Verification

- Clippy with warnings denied passed for library, tests and binaries.
- Contract export check passed without generated-output changes.
- Desktop executable build passed.
- Current documentation link checks, Rust formatting and diff whitespace checks passed.
- Full native suite: 353 passed, 1 ignored.
- UI architecture suite: 18 tests passed across 5 files.

No manual app launch or mobile build was performed. Existing staged work was
preserved; this pass did not stage, commit, push, change versions or deploy.
