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

The active [conversation prompt experiments](benchmarks/conversation-prompts/README.md)
use synthetic current-source fixtures, offline plans, bounded paid OpenRouter runs
and saved comparisons. They do not depend on archived workflows or alter app prompts.

`npm run test:reports` prints unreachable-module, unused-export and unused-style
candidates separately from passing test totals. Candidates require source review;
the command does not delete code. Broken import resolution remains an error.
CI runs the reports alongside the tests.

`npm run ios:test` includes a macOS-only execution check of the IPA verifier. CI
runs it in its macOS job; other systems skip that case explicitly.

## Release tooling

The former `scripts/release.ts` moved here in the repository cleanup; it was not
removed. Use Node 24 and `npm run release -- patch --dry-run` to inspect a bump,
then `npm run release -- patch` only when publishing is authorized and CI is green.
`current` tags a version already committed on `origin/main`; `--no-push` keeps
Git writes local. Existing tags must not be reused. Stable versions only are
supported by the desktop/Android publication workflow.

`npm run release:test` checks version arithmetic and release argument refusals.
The script requires a clean checkout at `origin/main` and pushes branch/tag
atomically to that remote. It does not verify GitHub CI or signing credentials.
See [the September release review](../docs/notes/release-readiness-2026-09-17.md)
for outstanding release blockers.

Development releases may use `npm run release -- patch --skip-tests` (combine with
`--dry-run` first). The annotated tag opts out of the reusable CI suite while
preserving required release builds, signatures and artifact checks. Normal tags
keep full checks. This still publishes Latest and updates installed desktop apps;
it is not a prerelease channel. See the root release guide for manual dispatch
and the limits of this mode. `release-mode.ts` resolves tag metadata or explicit
manual input; release tests exercise both paths using disposable local Git tags.


## Size report

Run `npm run build`, then `npm run size:report`. This read-only command inventories
shared font binaries/notices, language YAMLs, interface translation JSONs, other
public assets, and the existing `ui/dist` output. It prints exact bytes, file counts
and the largest files. Build categories are disjoint; source and build views
overlap and must not be added together.

`npm run --silent size:report -- --json` produces the same inventory as JSON,
including individual file sizes, for comparisons or saving outside the repository.
The command requires a frontend build and never rebuilds implicitly; it reports
the build entry's modification time without claiming that output is current.
Missing inputs, unsupported arguments and symlinks fail explicitly.

These are raw file sizes, not compressed downloads, native package sizes or the
installed app footprint. No network, app data, archived sources or native build
caches are inspected. The command does not change release packaging.

Resume the saved prompt study (offline viewer):
`node tools/benchmarks/conversation-prompts/explorer/explore.ts`.
The [experiment README](benchmarks/conversation-prompts/README.md) records the
selected Relationship prompt at temperature 1.1, runtime ownership, saved results,
and how to design and run the next round.
