# CI ownership

`ci.yml` is the branch/PR entry point and the reusable release gate. It runs
`check:fast` before calling the domain workflows. Only the coordinator has push
and pull-request triggers, avoiding duplicate runs. All domains run on every
validated commit; there are no path-based omissions.

| Workflow | Responsibility |
| --- | --- |
| `ci-ui.yml` | UI tests, reports and application build |
| `ci-native.yml` | Clippy, native domain tests, updater verifier and Linux compatibility |
| `ci-server.yml` | Hosted server tests and deployment upload manifest validation |
| `ci-content.yml` | Generated contracts, content readiness/schemas and benchmark export consistency |
| `ci-docs.yml` | Documentation links, tests and site build |
| `ci-tooling.yml` | Benchmark, E2E, release, iOS and logging tooling checks |
| `ci-mobile.yml` | iOS build/tests, Android resources and Android build |

## Native test domains

The compile job builds the library test executable once. `tools/ci/native-tests.ts`
inventories its tests and groups them by the root module declared in
`native/src/lib.rs`. Storage migrations have their own subgroup. New modules with
tests automatically join the matrix; unrecognized owners fail preparation.
Configuration module unit tests stay with native; authored content validation has
its own workflow.

Matrix jobs download the executable and check out the same revision at the same
absolute path. Rust embeds the source path for fixtures, so the runner verifies
that path, commit, executable digest and test inventory before running anything.
Each test belongs to exactly one domain. Exact-name filters prevent substring
overlap; bounded argument batches support Windows. Existing ignored tests remain
ignored. Four threads run within each job; failure in one domain does not cancel
the other domains, but still fails CI.

Local reproduction from the repository root (Node 24 and Rust required):

```powershell
node tools/ci/native-tests.ts prepare
node tools/ci/native-tests.ts run storage-migrations
node tools/ci/native-tests.ts run all
```

Preparation prints available domains. Re-prepare after changing native source.
The artifact is short-lived and tied to its checkout; it is not a release binary.

Parallel execution reduces the serial test chain, subject to runner availability.
Content executables and cross-platform builds still compile separately. Checkout,
dependency installation and artifact transfers add overhead, so hosted runtime
must be measured rather than inferred from the number of jobs. Required check
names in branch rules, if configured, must match the new nested job names.

Release validation still calls the coordinator and waits for every domain. The
existing explicit development-release bypass is preserved. This split does not
change publishing or deployment authorization.
