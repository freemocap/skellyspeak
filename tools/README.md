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
verification. `npm run benchmarks:test` runs offline screening and schema-portability checks.
Its native gloss fixture is generated and checked with `npm run benchmarks:fixtures`
and `npm run benchmarks:fixtures:check`; see
[test fixture provenance](test-fixtures/model-routing/README.md). These checks make
no provider calls. The remaining live experiments in `benchmarks/` still depend on
archived `workflow/` inputs and require a separate review before reuse. Do not run
them against `old/` in place. Screening helpers are isolated from their file and
credential reads.

`npm run test:reports` prints unreachable-module, unused-export and unused-style
candidates separately from passing test totals. Candidates require source review;
the command does not delete code. Broken import resolution remains an error.
CI runs the reports alongside the tests.

`npm run ios:test` includes a macOS-only execution check of the IPA verifier. CI
runs it in its macOS job; other systems skip that case explicitly.
