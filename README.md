# SkellySpeak

A convivial tool for learning languages through welcoming conversations,
useful assistance and understandable progress.

**Current implementation: the durable local foundation.** Create and edit partners,
start multiple conversations, save independent practice settings, archive/restore
items, and keep separate unsent drafts during the application session. Local
preferences include explanation language, text size, contrast and introduction status.
Avatars are static procedural SVGs with editable mathematical parameters.

AI replies, assistance, provider connections, assessment, XP and garden rendering
are scheduled in subsequent [build phases](./BUILD-PLAN.md). The Send control is
explicitly unavailable; there are no simulated replies or sample learning scores.

## Run locally

Use Node.js 24, npm, Rust and the platform's Tauri prerequisites. Install and run:

```sh
npm ci
npm run tauri dev
```

Run this from the repository root. `npm run dev` alone starts frontend assets;
local storage requires the native Tauri application. Quit an already-running
SkellySpeak workspace before launching another instance of the same database.
The app fails explicitly if the workspace is locked, invalid or incompatible.

The authoritative application version is in `src-tauri/Cargo.toml`. Dependencies
are locked in `package-lock.json` and `src-tauri/Cargo.lock`.

Build an unsigned local macOS inspection bundle:

```sh
npm run tauri -- build --debug --bundles app --config '{"productName":"SkellySpeak Workspace","bundle":{"active":true}}'
open 'src-tauri/target/debug/bundle/macos/SkellySpeak Workspace.app'
```

The distinct inspection bundle name makes the running workspace identifiable.
This is a local debug build, not a signed release or deployment.

## Check this slice

1. Choose a language and create a partner. Edit the name, background or avatar.
2. Create two conversations. Change difficulty and Translation in the first.
   The next conversation starts with a copy; subsequent edits are independent.
3. Switch between the conversations and restart the app. Accepted settings persist;
   unsent drafts are intentionally session-only.
4. Archive and restore a conversation or partner. Deletion identifies its permanent
   scope before confirmation and removes dependent local records.

The app stores `practice.sqlite3` in its platform application-data directory under
identifier `org.skellyspeak.practice`. On macOS this is
`~/Library/Application Support/org.skellyspeak.practice/`. No application data is
synchronized or sent to an AI provider by this foundation.

## Verification

```sh
npm test
npm run build
npm run contracts:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --lib --tests -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Rust integration-style tests use disposable SQLite files for persistence, revision
conflicts, settings copying, deletion, archives, duplicate actions and session rules.
Frontend tests cover snapshot ordering and draft scope. Test discovery is restricted
to the active `src/` tree. `npm run contracts` regenerates TypeScript declarations
from Rust; the check command detects drift without changing files.

Verified on this macOS host: frontend build, local Rust/TypeScript checks, native
app-bundle build, partner editing, independently configured conversations, restart
persistence, session drafts and a narrow native window. A separate archived
“Verification partner” contains the UI-check conversations; existing partners were
not modified. Narrow desktop inspection is not an iPhone-device test.

The iOS prerequisite probe found command-line tools but no full Xcode installation;
iOS compilation/device validation remains blocked. Windows, Linux and Android
builds are unverified. Hosted and live-provider checks belong to their implementation
phases and have not run.

## Architecture and roadmap

[Implemented architecture](./architecture.md) records ownership and tooling.
[The build plan](./BUILD-PLAN.md) tracks phases and user checkpoints.
[The design brief](./DESIGN.md), [data model](./DATA-MODEL.md),
[execution contract](./EXECUTION.md), [AI strategy](./AI-STRATEGY.md),
[state/storage contract](./STATE-AND-STORAGE.md) and
[model evaluation plan](./AI-EVALUATION.md) define the approved direction and
remaining work. Design intent does not imply implemented behavior.

[Working rules](./AGENTS.md) and [UI rules](./ui-guidelines.md) govern development.
`old/` is reference-only and is excluded from active tests and builds.
