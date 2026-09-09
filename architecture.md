# Implemented foundation and boundaries

Implementation target: Phase 1 of [the build plan](./BUILD-PLAN.md). Verification
status is recorded in README.md. Later execution, AI and evidence contracts remain
in the design documents; this foundation does not make AI calls.

The selected stack is Tauri 2, React 19, TypeScript and Vite. Rust owns the SQLite
store via rusqlite with bundled SQLite; mutations use explicit transactions,
foreign keys and optimistic revisions. No ORM or frontend database API is exposed.
Rust serde contracts generate TypeScript through ts-rs. React owns transient drafts,
selection and forms; durable state comes from Rust snapshots. No additional state
library is needed for the local directory slice.

Sources: [Tauri commands](https://v2.tauri.app/develop/calling-rust/),
[rusqlite](https://docs.rs/rusqlite/latest/rusqlite/) and
[ts-rs](https://docs.rs/ts-rs/latest/ts_rs/). Exact resolved versions are in the locks.

`src-tauri/src/model.rs` owns serialized domain contracts. `languages.rs` owns the
explicit language/variety registry. `store.rs` owns validated transactions and
snapshot reads. `lib.rs` exposes local commands; `src/` presents them. Hosted
authentication, proxying and metering will have their own `server/` implementation
in the corresponding phase; no dummy server is introduced here.

The local database lives in the application's data directory as `practice.sqlite3`.
It is initialized only when empty; incompatible or invalid databases fail explicitly.
There are no migrations or imports. Source-owned records cascade on deletion.
Settings are one independently editable record per conversation. Opening a
conversation records use ordering for copying settings on explicit creation.

Foundation snapshots contain the local directory and settings, with a monotonic
revision. No transcripts are loaded through this directory contract. A single
main window refreshes after mutations and focus; background result subscriptions
belong to the execution phase. This is not an implementation of graph hydration.

A workspace file lock enforces a single local writer. Opening another process fails
instead of clearing its active session receipts. Each mutation carries a session
and action ID; transaction receipts deduplicate replay, and a changed payload under
an existing ID is rejected. Receipts are removed on session initialization, and
source-bound receipts cascade on deletion. Unconfirmed UI actions retain their
identity and expose Recover action rather than creating another mutation silently.

Settings payloads are typed JSON within a one-to-one relational settings row. Serde
rejects unknown fields; language/variety and ownership validation run in Rust.
`ts-rs` exports the supported wire shape; its warning for the runtime-only serde
`deny_unknown_fields` annotation is disabled, while rejection itself is tested.

Persisted preference changes apply to subsequent defaults, not existing conversation
settings. Form revisions are captured so a refresh cannot silently authorize a stale
edit. The UI preserves drafts across navigation, deletes them when their conversation
is removed, and intentionally does not write unsent drafts to disk.
