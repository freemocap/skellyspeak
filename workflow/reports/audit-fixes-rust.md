# Rust audit fixes — 2026-09-14

## Implemented

- **A02 — Operation preparation failures:** network-operation preparation now has a common error boundary. Expected validation/provider preparation failures persist a failed local attempt with the error, fail only the affected operation, and refresh its turn. Storage/internal/configuration corruption remains a propagated failure. Lesson review selects recent whole exchanges against the serialized 96 KB prompt budget, including its instruction. If the current exchange itself cannot fit, that review fails explicitly; learner quotes are not truncated and unrelated work continues.
- **A08 — Conversation watching:** the native long poll checks the metadata revision before hydration. It performs the full projection on a revision change or its existing 20-second deadline. Lesson choice construction reuses its language evidence projection for focus selection, and conversation hydration reuses its base snapshot for mystery/lesson views.
- **A05 — Startup keychain cleanup:** a stale-credential deletion denied by the keychain is reported in additive `StartupState.credentialCleanup`; a healthy workspace still loads. `retry_credential_cleanup` runs on a blocking worker, serializes credential operations, preserves unsuccessful cleanup obligations and clears the state only after successful cleanup. Expected credential errors are returned in StartupState; storage/internal failures still reject the command. Parent owns the corresponding startup UI.
- **A07 integration support:** older message pages now include their owning TurnViews, attempts and errors alongside the latest 50 turns, bounded by at most 100 page owners plus those 50 turns. This lets the frontend render older terminal failures accurately. No pagination contract changed.

## Contracts and ownership

Changed native files: `execution.rs`, `lessons.rs`, `lib.rs`, `model.rs`, `openers.rs`, `progression.rs` under `src-tauri/src/`. Regenerated `src/contracts.ts` through `export-contracts` for the additive startup field. No schema version change or data migration/reset. The startup retry command is registered in the Tauri invoke handler.

No app launch, credential access, paid provider request, deployment, Git commit or push was performed. Existing parallel server/frontend/documentation changes were preserved.

## Verification

Five focused regressions passed:

1. Oversized current lesson exchange produces a durable local failure while unrelated work still dispatches.
2. Review budgeting removes older exchanges while preserving the complete current source and reply.
3. Unchanged revision polling does not execute the heavyweight projection; force/changed revision does.
4. Older message pages retain a failed reply's operation and attempt error beyond the latest 50 turns.
5. Simulated keychain denial preserves the cleanup row and healthy workspace; explicit retry clears both row and reported error without repeating deletion.

`cargo run --manifest-path src-tauri/Cargo.toml --bin export-contracts` succeeded. Full-suite/Clippy final results follow below. Native tests use disposable test workspaces and loopback fixtures; no real OS keychain denial or native-window interaction was induced.

### Final native results

- `cargo test --manifest-path src-tauri/Cargo.toml`: **353 passed, 0 failed, 1 ignored**, plus binary/doc-test targets passed (108.65 seconds for the library suite). The ignored test requires explicit live-provider credentials and was not run.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: **passed**.
- `cargo fmt --manifest-path src-tauri/Cargo.toml`: completed.

The pagination fixture initially lacked the required context graph dependency; the fixture was corrected to carry the complete declared graph before the successful focused/full runs. No baseline tests were removed or weakened.
- Final `export-contracts --check` and repository `git diff --check`: **passed**. A non-documenting Rust field comment avoids introducing ts-rs multiline trailing whitespace in the generated startup declaration; the field semantics are unchanged.
