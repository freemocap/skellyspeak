# Repository instructions

Keep answers and changes concise. Fail immediately on errors; do not replace
errors with warnings or silent fallbacks.

## Git

Git is read-only for agents. Never commit, push, tag, branch, stage, reset,
checkout, stash, or change Git configuration. The user performs all Git writes.

## UI

For UI work, read `ui-guidelines.md` and reuse the app’s established interaction patterns and vocabulary.

## Refactor contract

Use a destructive, fresh-data cutover. No backups, data imports, compatibility
adapters, dual schemas or preservation requirements. The user handles application
data deletion. Implement one complete architecture and delete unnecessary code.
Documentation, comments and explanations describe the current design or explicitly
planned behavior only; do not narrate project history or compare code/data versions.

## Code style

- Use TypeScript, never JavaScript, for new Node/frontend code.
- Use type hints everywhere in Python: functions, methods, parameters, returns,
  and variables. Use modern annotations such as `str | None` and
  `dict[str, object]`.
- Keep Python imports at module scope.
- Prefer keyword arguments when the called API supports them.
- Do not add compatibility shims, optional inputs, or fallback behavior unless
  explicitly requested.
- Raise errors for unexpected states. Do not catch an error merely to print a
  warning and continue.
- Do not use `_new`, `_fixed`, or `_updated` in new names.
- Comments describe only the current design. Never narrate previous versions.

## Architecture and sources of truth

- `src/`: React 19/TypeScript presentation and transient UI state.
- `src-tauri/src/`: Rust ownership of credentials, persistence, prompts,
  provider routing, model calls, and Tauri IPC.
- `server/`: FastAPI hosted authentication, request validation, metering, and
  provider proxying.
- `skellyspeak-docs/`: public Docusaurus documentation.
- `src-tauri/Cargo.toml`: application version.
- `src-tauri/src/languages.rs`: supported languages and dialects.
- `src-tauri/src/lib.rs`: registered IPC commands.
- `src-tauri/src/settings.rs`: settings and provider-routing contract.
- `src-tauri/src/turn_plan.rs`: declared guided-turn operations.
- `src-tauri/src/graph.rs`: graph rendering model derived from the turn plan.
- `server/contracts.py` and `server/config.py`: hosted request and deployment
  contracts.

The execution graph describes and reconciles the guided pipeline;
`src-tauri/src/commands/guided/` executes it.

## Documentation discipline

Treat implementation as authoritative for current behavior. Treat explicit
design documents as authoritative only for future intent. Keep documentation
focused on current contracts and actionable planned work; remove historical
narratives and completed roadmap items.

When behavior changes, update the nearest public document in the same task:

- Product surface or setup: `README.md` and `skellyspeak-docs/docs/overview.md`.
- Architecture, persistence, or pipeline: `architecture.md` and `ontology.md`.
- Hosted API or operations: `hosted-api.md` and `privacy.md` when data handling
  changes.
- Platforms, CI, signing, or release flow: `platforms.md`.
- Planned work: `future-work.md`; remove items as soon as they ship.

Do not hard-code volatile counts such as test totals or IPC-command totals in
public docs unless a test or generation step keeps them synchronized.

## Verification

Run the checks relevant to the changed area and stop on any failure:

```powershell
npm test
npm run build

cd src-tauri
cargo clippy --lib -- -D warnings
cargo test --lib

cd ../server
uv run --frozen --group dev pytest -q

cd ../skellyspeak-docs
npm run build
```

Native-device, signing, Firestore-emulator, and live-cloud claims require their
corresponding environment. Never infer those results from desktop unit tests.
