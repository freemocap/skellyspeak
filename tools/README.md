# Development tools

Repository development, verification, release and cross-layer integration tools.
The existing script layout is retained for this top-level move; layer-specific
helpers can move alongside their owners during the subsequent internal organization.

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
