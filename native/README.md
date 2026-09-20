# Native — Rust and Tauri

The application code running on the user's device: persistence, credentials,
AI execution, recording, and native integration. This is separate from the
remote [Python server](../server/).

## Source folder map

| Folder | Responsibility |
| --- | --- |
| [src/application/](src/application/) | Startup, runtime state, native command registration and background scheduling |
| [src/conversations/](src/conversations/) | Conversation turns and execution, prompts, opening choices, revisions, reading results and conversation export |
| [src/partners/](src/partners/) | Persona definitions and prompts, generation and its receipts, and reactions |
| [src/learning/](src/learning/) | Coaching, learner evidence/state, progression, rewards and reward settings |
| [src/speech/](src/speech/) | Capture, recording commands, transcription receipts, audio inspection, fluency timing and speech cache |
| [src/ai/](src/ai/) | Access, credentials, routing, admission, holds, refusals, hosted connections and provider transports |
| [src/storage/](src/storage/) | Workspace ownership, database initialization and schemas, reset and workspace-copy export |
| [src/language/](src/language/) | Language lookup, Unicode/emoji handling, existing linguistics code and its fixtures |
| [src/configuration/](src/configuration/) | Configuration loading, validation, types, citations and schema checks |
| [src/statistics/](src/statistics/) | Mechanical usage summaries, formerly in `profile.rs` |
| [src/diagnostics/](src/diagnostics/) | Logging and diagnostic records |
| [src/updates/](src/updates/) | Application update discovery |
| [src/bin/](src/bin/) | Contract exporter and offline gloss benchmark entry points |

`src/main.rs` is the executable entry point. `src/lib.rs` declares the native
modules and exports `application::run`. Application composition lives in
`src/application/startup.rs`, runtime state in `state.rs`, the dispatch loop in
`scheduler.rs`, and command handlers in `commands/`. `application/mod.rs` provides
their shared imports and application entry points.
`src/model.rs` retains mixed types pending a separate ownership-based split.

Language- and script-specific rules belong in `language/` or editable language
configuration. Feature and transport code consume generic language capabilities;
they must not branch on individual language or script identities. `language/script_text.rs`
owns configured-script validation, and `language/text_diagnostics.rs` owns
content-free script/Unicode comparison metadata. Its serialized diagnostic fields
remain stable when called by audio transport. Language-specific test examples,
localized messages and font asset declarations are data, not exceptions for
embedding language behavior in feature code.

### Subfolder groups

| Area | Current groups |
| --- | --- |
| `application/` | Startup/command registration, shared state and scheduler; `commands/` groups workspace, connection, hosted and persona-generation handlers; existing suites live in `tests/` |
| `learning/` | `coaching/` (requests, observations, policy), `learner/` (state, progression), `rewards/` (rewards, settings) |
| `partners/` | `persona/` (definitions, prompts), `generation/` (registry, receipts), and reactions |
| `speech/` | `recording/` (capture, commands, transcription), `analysis/` (inspection, fluency); playback cache stays in `cache.rs` |
| `ai/` | `connections/` (access, credentials, routing), `hosted/` (hosted integration, mobile sign-in), `transport/` (text, speech, grouped responses), `policy/` (admission, holds, refusals) |
| `storage/` | `schemas/` holds database SQL; `store/` groups locking, schema validation, startup, snapshots and transactional commands; reset remains in factory_reset.rs |
| `conversations/execution/` | Admission, holds, connections, turns, snapshots, dispatch, publication, reading retries, speech and recovery; behavior-based tests in `tests/` |
| `ai/transport/provider/` | `keys.rs` verifies credentials; `payload.rs` builds prose/structured requests and enforces input limits; `request.rs` owns HTTP and dispatch routing; `response.rs` decodes completions and validates prose; matching suites and local HTTP fixtures live in `tests/` |

The first folder passes moved whole files. Large-file cleanup has now started with
conversation execution; its implementation and test files are each under 500 lines.
Other large modules await individual cleanup. Some `mod.rs` files still contain
existing implementations. See the source-size policy in root `AGENTS.md`.

The store command coordinator retains session/replay checks and a single receipt
transaction. Domain handlers under `store/commands/` borrow its transaction; they
do not commit independently. Tests under `store/tests/` cover workspace/schema,
preferences, command rollback/replay and record lifecycle. File-size bands are
review guidelines: prefer cohesive code over splitting solely to satisfy a count.

These are responsibility groups, not newly independent crates or a redesigned
layered architecture. Existing cross-domain calls remain. Keep tests with their
module and feature-specific database operations with their feature. General
workspace/schema mechanics belong in storage. Network transport belongs in AI;
conversation execution and speech lifecycle keep their respective domain owners.

## Content and packaging

- [../content/](../content/): app-owned language documents, shared learning goals,
  conversation topics and teaching policy. The [AI behavior index](../content/README.md) links prompt code.
- [../content/schemas/](../content/schemas/): generated configuration schemas,
  verified by Rust tests.
- `capabilities/`, `icons/`, Tauri configuration and platform property lists:
  native permissions and packaging.
- `gen/`: platform projects and generated support files; Android customizations
  are tracked, while other generated output follows `.gitignore`.
- `target/`: ignored Cargo build output.

During `npm run tauri dev`, edits under `content/` trigger a native rebuild and
application relaunch through `build.additionalWatchFolders` in `tauri.conf.json`.
Content is embedded at compile time; refreshing the webview alone does not reload
YAML. Restart an already running dev command once after changing watcher settings.

## Linux build dependencies

The Linux credential-store dependency enables `keyring`'s `vendored` feature.
Cargo compiles the bundled D-Bus library automatically, so `libdbus-1-dev` and
a custom `PKG_CONFIG_PATH` are not needed for this dependency. This still uses
the desktop's running D-Bus session and Secret Service for credential storage.
Other Tauri and audio system build dependencies remain required. On Pop!_OS,
Ubuntu and Debian, interactive `npm run tauri dev` checks GTK 3, WebKitGTK 4.1
and ALSA before starting Vite/Cargo, installs missing development packages through
`sudo apt-get`, then verifies them again. Enter your sudo password when requested.
Failed installation stops startup. CI and noninteractive runs report the required
install command without attempting installation. Other distributions receive a
prerequisite error; explicit cross-target runs and other Tauri commands skip setup.

## Verification

From the repository root:

```sh
npm run tauri -- info
cargo fmt --manifest-path native/Cargo.toml -- --check
cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings
cargo test --manifest-path native/Cargo.toml --lib
cargo check --manifest-path native/Cargo.toml --bins
npm run contracts:check
npm run languages:check
npm test -- tests/architecture
```

Transport tests use local loopback servers; allow localhost binding when running
inside a sandbox. They do not need live AI providers. The UI registration check
reads `src/application/startup.rs`, where the `generate_handler!` list lives.

The root Tauri launcher selects this directory explicitly. Moving the native
project root can invalidate cached build-script paths;
`cargo clean --manifest-path native/Cargo.toml` clears build output without touching
source or application data. Working notes belong in [docs/notes/](../docs/notes/).

### Linux desktop icon

The running GTK/Wayland window identifies as the executable name
(`skellyspeak`), independently of its D-Bus application identifier.
Tauri's standard Linux package launcher already uses the executable name as
`StartupWMClass` and bundles the configured PNG icons.

`npm run tauri dev` registers a user-local `skellyspeak.desktop` launcher and
256px logo through `tools/linux-desktop.ts`. Its filename and StartupWMClass
match the actual window; Icon uses the absolute local PNG path to avoid
desktop-specific theme-cache lookup differences. This makes the logo available
for the unbundled debug executable too.

The launcher points to this checkout's default
`native/target/debug/skellyspeak`; custom Cargo target directories are not
supported by this convenience launcher. It follows `XDG_DATA_HOME`, defaults to
`~/.local/share`, and refuses to overwrite an unrelated launcher. To retire the
development checkout, remove its `applications/skellyspeak.desktop` and
`icons/hicolor/256x256/apps/skellyspeak.png` from that data directory.

### Explicit reading help

`language/reading/` owns bounded, source-captured gloss and token-speech requests
outside conversation turns. `application/commands/reading.rs` registers begin,
run, cancel and receipt-inspection commands. Requests reuse the existing gloss
validator and speech transport, validate captured connection/workspace authority,
and create no learning credit. Source text and audio remain volatile;
`reading_attempts` retains content-free diagnostic receipts. Development schema
25 requires explicit reset of older workspaces.
