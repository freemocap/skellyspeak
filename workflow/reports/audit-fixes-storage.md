# Storage audit fixes — 12 September 2026

Implemented A01, A02 and A10 in native storage/recovery and the startup refusal UI. No Git writes, deployment, application launch or real-data reset occurred.

## A01: workspace ownership

`Store` now owns a cloneable `WorkspaceOwnership` guard around the existing lock file. Reset retains this guard after SQLite closes, through all deletion, and preserves the lock inode. Reset and export serialize on the store mutex; when startup refused the database, they independently acquire the same exclusive lock before reading credential identifiers or changing data. Mutex failures now fail explicitly. Deferred cleanup also acquires ownership before clearing anything.

Lock refusal uses the existing `conflict` error code with a close-other-instances/restart message. The refusal screen disables Factory Reset and hides export in that case. Schema refusal keeps its recovery actions. Backend ownership remains authoritative even if another process starts after the screen renders.

## A02: bounded deferred cleanup

The record accepts exactly the symbolic kind `logs`, never a filesystem path. Unknown, empty, oversized, nonregular and symlink records fail closed. Its trusted destination is resolved before sink startup by `diagnostics::configured_root`, the same function used by logging initialization. A configured log root encompassing the workspace is rejected so it cannot remove the lock inode. Successful or already-completed cleanup clears the record; failures preserve it. Record writes use a private, exclusively created temporary file, sync it, and rename it into place.

Legacy path records are deliberately rejected rather than interpreted or migrated. If the trusted logging configuration changes between reset and restart, cleanup resolves the current configured root; it does not recover or follow a previous arbitrary destination.

## A10: export publication and consistency

Each export has a UUID-qualified name even at the same timestamp. An exclusively created staging directory receives only the database and recognized SQLite sidecars. Nonregular source files fail. The new folder is published by rename only after every copy succeeds; a failed copy removes staging or reports cleanup failure. Export holds process ownership and the local store write mutex for the entire copy. There is no reuse of earlier backup directories or stale sidecars.

## Verification

- `cargo test --manifest-path src-tauri/Cargo.toml factory_reset::tests`: **9 passed**.
- `cargo test --manifest-path src-tauri/Cargo.toml store::tests`: **17 passed**.
- `npx vitest run src/features/startup/StartupRefusal.test.tsx`: **5 passed**.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- Modified Rust files formatted with rustfmt.

Regressions include a separate child process denied ownership both before and after SQLite close/data deletion, reopening a refused workspace after synthetic reset, hostile and partially completed cleanup records, cleanup refusal with a live store, nested symlinks, failed-copy cleanup, same-timestamp exports, and reopening real SQLite WAL snapshots with expected rows plus `integrity_check`.

All filesystem tests used disposable temporary directories and injected credential deletion. Native webview/keychain behavior, Windows/mobile locking and actual device recovery still require platform checks. Ordinary cooperating application processes honor this lock; an unrelated tool intentionally bypassing it is outside the tested ownership contract. Full-suite integration is coordinated by the parent task.
