# UI — React and TypeScript

The interface shown inside the native application's webview. Application code
lives in `src/`; tests shared across features, development tools, and static files
have separate homes.

## Folder map

| Folder | Responsibility |
| --- | --- |
| [src/app/](src/app/) | Startup, windows, shell, and application composition |
| [src/features/](src/features/) | Product features and their local components and tests |
| [src/components/](src/components/) | Reusable interface elements and hooks |
| [src/state/](src/state/) | State shared across features |
| [src/domain/](src/domain/) | Product logic independent of React and Tauri |
| [src/platform/](src/platform/) | Native bridge, browser/device integration, and diagnostics |
| [src/styles/](src/styles/) | Shared styles and design tokens |
| [src/generated/](src/generated/) | Rust-generated contracts and construct catalog |
| [tests/](tests/) | Cross-cutting architecture checks, shared setup, and mocks |
| [public/](public/) | Files served directly, including fonts and icons |
| [assets/](assets/) | Authored artwork and source assets |
| [tools/](tools/) | UI style tools and development previews |

Feature-specific tests stay beside their implementation. `tests/setup.ts`
registers shared mocks explicitly. Application modules must not import test
infrastructure.

The existing feature/domain subfolders and component implementations are preserved
in this pass. `src/types.ts` still mixes types from several areas; splitting it by
owner is deferred to internal organization. `src/vite-env.d.ts` provides frontend
type declarations.

## Commands

From the repository root, `npm ci` installs the UI workspace and development tools.
Run `npm test` or `npm run build` there. `npm run dev` starts frontend assets only;
use `npm run macos:dev` on macOS or `npm run tauri -- dev` on other desktop platforms
for the native app. Tests can be selected with `npm test -- tests/architecture`.

`npm run styles:check`, `npm run styles:dead`, and `npm run styles:prune` invoke
this folder's style tools. The repository-wide import graph and move tool remain
under root `tools/` because they resolve references across layers.

Native commands and persistence belong to [native](../native/); the hosted API
belongs to [server](../server/). `src/generated/contracts.ts` and
`src/generated/skill-catalogs/catalog.json` are generated from Rust with
`npm run contracts`; check them with `npm run contracts:check`. Do not edit
these generated files by hand.

Working notes and verification reports belong in [docs/notes/](../docs/notes/).
