# Application runtime split

Status: implemented, 2026-09-15. Third original file in the size-review backlog.

Split the former 1,501-line application/mod.rs by existing responsibility:

- mod.rs: shared imports, application entry points and common error/secret-read helpers.
- state.rs: Application state, StoreGuard and credential/store synchronization.
- startup.rs: Tauri builder, menu/window startup and ordered command registration.
- scheduler.rs: the existing bounded dispatch loop.
- commands/workspace.rs: startup/snapshot/command/profile access, speech-cache reads,
  conversation observation and the AI activity window.
- commands/connections.rs: connection settings, credential verification and routing.
- commands/hosted.rs: hosted sign-in, cancellation, diagnostics and sign-out.
- commands/partners.rs: persona-generation command orchestration and validation.
- tests/credential_io.rs and tests/generation.rs: existing suites, registered by
  their owning state and partner-command modules.

There are 11 files; the largest is the existing generation test suite at 221 lines.
The boundaries follow runtime ownership rather than enforcing a hard line limit.

## Preserved behavior

All 57 functions and 11 tests remain. Compared function contents against the
original, normalizing visibility, handler qualification, whitespace and trailing
commas; no other differences were found. All 49 registered command names retain
their order. The mobile entry-point attribute is preserved. State fields and
methods needed by siblings use application-scoped visibility; existing externally
used crate-level state/secret/generation entry points remain available.

The store guard now belongs to state.rs; no caller used its old explicit type
path. Lock boundaries, sign-in epochs, credential cleanup, scheduler behavior and
generation receipt handling remain unchanged. The UI architecture test now reads
registration from startup.rs.

## Verification

- Clippy with warnings denied passed.
- Generated-contract check and desktop executable build passed.
- All 18 UI architecture tests passed.
- Current documentation link checks passed.
- Full native suite: 354 passed, 1 ignored, no failures.
- Rust formatting and diff whitespace checks passed.

Updated AGENTS.md, native/README.md and the size inventory. No mobile build,
manual app launch, live provider call, commit, push or deployment was performed.
Next candidate: native/src/learning/lessons.rs (1,437 lines).
