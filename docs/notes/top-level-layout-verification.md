# Top-level layout checkpoint — September 15, 2026

## Implemented

The repository now has peer `ui/`, `native/`, `server/`, `content/`, `docs/`,
`tools/`, and `old/` folders. UI code and configuration moved together; Rust and
its platform files moved together; the server source stayed in place. Editable
configuration and schemas moved into `content/`, with an index of AI behavior
that remains implemented in native/server code.

Root npm commands coordinate the UI workspace and tools. Tauri's launcher selects
`native/`; its frontend build hook builds `ui/dist`. CI, release paths, contract
export, configuration bundling, fixtures and import-boundary checks use the new
locations. Package versions did not change; the root lockfile now records the UI
workspace. The documentation website retains its independent lockfile.

Existing archived notes were not edited. The archive README, active entry points,
and website notice distinguish unverified historical descriptions from the current
repository map. Internal feature/module organization and prompt extraction remain
future work.

## Verification

| Check | Result |
| --- | --- |
| Fresh root npm install from lockfile | Passed offline, with install scripts disabled |
| Frontend tests after fresh install | 105 files, 654 tests passed |
| Native unit and integration-style tests | 353 passed across runs; one existing ignored test |
| Native transport tests | All 14 sandbox-blocked tests passed with localhost binding allowed; no live providers |
| Rust formatting and Clippy with warnings denied | Passed |
| Generated TypeScript contracts and construct catalog | Check passed, no regeneration needed |
| Configuration schemas and bundled defaults | Native configuration tests passed |
| UI production build through the actual Tauri build hook | Passed |
| Native desktop debug build, without bundling | Passed; binary at `native/target/debug/skellyspeak` |
| Documentation site tests | 28 download tests and seven security tests passed |
| Documentation website production build | Passed |
| iOS release verification fixtures | Two tests passed |
| Logging launcher tests | Four tests passed |
| Release version tests | 12 tests passed |
| Android runner tests | One test passed |
| Tool TypeScript, styles, current documentation links | Passed |
| Frontend import graph | Zero unresolved relative imports |
| Android XML files | Ten files parsed successfully |
| Moved tracked-file inventory | Every original file in the moved folders has a destination |

## Limits and observations

- The native app was built, not launched or manually exercised. No application
  data reset, deployment, signing, release, version bump, commit or push was performed.
- iOS, Android, Windows and Linux builds were not run locally. Full Xcode is not
  installed on this machine. Mobile/release workflow paths were updated, iOS shell
  fixtures passed, and Android XML was checked; these do not substitute for device builds.
- The first native rebuild needed stale Tauri plugin build-cache entries cleared
  after the folder move. Later native compilation and checks passed.
- Vite retains its existing large-bundle warning. The import graph still reports
  `ui/src/domain/language/token-spacing.ts` and `ui/src/vite-env.d.ts` as unreachable;
  this pass did not remove source or change the dead-code policy.
- The website's Docusaurus update notification could not access its local config
  store; website compilation succeeded. No permission changes were made for it.
- Existing documentation content needs a separate audit. Experimental benchmark
  scripts retain dependencies on previously archived inputs and are explicitly
  outside active verification.
