# Domain CI workflows — October 7, 2026

## Requested decision and implementation

Split CI by source ownership rather than duration-based shards. The coordinator
retains the fast gate and calls reusable UI, native, server, content, docs, tooling
and mobile workflows. Native library tests run in module-owned matrix jobs, with
storage migrations separated from other storage tests. Compilation produces one
shared test executable rather than rebuilding it per domain.

See the maintained [workflow guide](../../.github/workflows/README.md) for ownership
and local reproduction. All previous commands are retained except the native
compile/run pair replaced by the inventory runner; Clippy now includes tests.
Release gating and its existing explicit development bypass remain intact.

## Verification

- All eight CI workflow files pass actionlint 1.7.12; shellcheck/pyflakes were
  disabled because those optional analyzers are unavailable locally.
- Fast gate passes, including 16 validation regression tests and TypeScript checks.
- Clippy with `--lib --tests -- -D warnings` passes.
- The copied executable runs all 14 domains locally: 845 tests pass, five retain
  their existing ignored status, and none fail. Exact-filter preflights pass for
  every batch. Final artifact preparation also passes with compiler diagnostics
  retained on stderr.
- Content readiness, schemas, contract check/exporter test and benchmark export
  consistency pass. Updater verification passes (one test); release tooling passes
  (16 tests). Documentation links and diff whitespace checks pass.
- A command inventory comparison confirms no old run steps were lost: only the
  intentionally replaced native compile/run commands and expanded Clippy differ.

Hosted scheduling, artifact transfer and runtime improvement require a run after
these changes are committed and pushed. Linux and mobile jobs were preserved but
cannot be executed on this Windows host. This is local verification, not a green
hosted CI run.
No commit, push, release version change or deployment is part of this change.

## Separate existing finding

Running actionlint across all workflows also flags the existing
`../../docs/docs-site/**` push filter in `deploy-docs.yml`: GitHub path filters
cannot contain `..`. That deployment workflow is unchanged by this CI split.
