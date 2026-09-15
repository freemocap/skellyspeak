# Development tools

Repository development, verification, release and cross-layer integration tools.
UI-only style tools and previews live under `ui/tools/`. The import graph and
move tool stay here because they resolve references across application layers.

Run tools from the repository root using the scripts in `package.json`.
`tauri.ts` selects `native/` explicitly and resolves file arguments to `--config`
relative to the repository root. Root npm commands delegate frontend work to `ui/`.
The root lockfile covers that workspace and the tools; the documentation website
retains its separate package and lockfile.

`test-fixtures/` contains fixtures shared by native/UI tests and the device runner.
`e2e/` contains explicit device tests. Live provider runs are not part of layout
verification. `benchmarks/` retains experimental scripts whose `workflow/` inputs
were already archived before this move; they are not part of active verification
and need a separate review before reuse. Do not run them against `old/` in place.
