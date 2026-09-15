# UI top-level organization — September 15, 2026

Status: agreed structure A implemented and automatically verified. The subsequent folder pass is recorded in
[UI responsibility subfolders](ui-substructure-organization.md); this document
retains the earlier checkpoint.

## Implemented layout

Application code stays under `ui/src/`, grouped into `app/`, `features/`,
`components/`, `state/`, `domain/`, `platform/`, `styles/`, and `generated/`.
Supporting folders are `ui/tests/`, `ui/public/`, `ui/assets/`, and `ui/tools/`.
See the maintained [UI folder map](../../ui/README.md).

- App startup, main application component, separate AI window, and application
  navigation test now live with application composition in `src/app/`.
- The former `src/ui/` is `src/components/`; existing contents stay together.
- Rust-generated contracts and the construct catalog live under `src/generated/`.
  The exporter now writes and checks those paths; generated contents are unchanged.
- Architecture tests, shared setup, and the Zustand reset mock live under `tests/`.
  The combined activity overlay/AI-window test moved there because it spans a
  feature and application composition. Other feature tests remain colocated.
- Zustand mocks are registered explicitly by test setup, retaining real exports
  and overriding store creation to reset state between tests.
- UI-only style tools moved from root `tools/` to `ui/tools/`. Root scripts still
  invoke them; repository-wide graph and move tooling stay under root `tools/`.
- Imports, Vite startup/setup paths, TypeScript test inclusion, and architecture
  rules were updated. The graph/move helper now recognizes side-effect imports
  such as the startup stylesheet; the existing reachability test checks that edge.

The [completed file-move manifest](ui-top-level-moves.json) records 45 moves from
the pre-pass layout. It is a record, not a command to rerun against the new layout.

## Verification

- All 105 UI test files passed: 654 tests, including architecture and mock consumers.
- TypeScript and Vite production build passed; all seven UI language dictionaries
  and their 826 messages passed the prebuild checks.
- Style validation and graph-tool TypeScript checks passed. Dead-style reporting
  still runs from its new location without modifying styles.
- Import graph: zero unresolved references.
- Rust formatting and generated-contract/catalog checks passed.
- Every move destination exists and its original path is absent. Generated file
  contents match the pre-move Git versions byte for byte.
- Current documentation links and Git whitespace checks passed.

The UI was built and tested, not manually exercised in the native application.
No deployment, app data reset, version bump, commit, or push occurred in this pass.
The existing Vite large-chunk warning and dead-code/style reports remain for a
later review; no production code was removed to silence them.

## Deferred

Existing feature, domain, platform, component, state, and style internals remain
as they were. `src/types.ts` still mixes several owners and needs a deliberate
split during internal organization; `src/vite-env.d.ts` remains a frontend type
declaration at the source root. No changes to native internals were made beyond
updating the frontend output paths in the contract exporter.
