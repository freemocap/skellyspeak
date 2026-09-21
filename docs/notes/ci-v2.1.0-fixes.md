# v2.1.0 CI failures and fixes

## Observed failures

GitHub CI run `35545962196` and Release run `35545962463` tested
`716ecf3` on 2026-09-20. Rust formatting failed in both. CI also failed
the language-browser script-size save test; that test passed in Release,
which then failed TypeScript localization checking because Windows passed
`ui/tools/localization/*.ts` as a literal filename.

## Implemented fixes

- Apply rustfmt to native source, preserving concurrent implementation work.
- Select localization tooling through its own tsconfig, independent of shell
  wildcard expansion. Node 24 handles the remaining test-file glob itself.
- Synchronize script-size drafts in a layout effect. The deferred mount effect
  could overwrite an edit before blur. A deterministic regression test edits
  before passive effects; it fails with the old effect and passes with the fix.
- Review and remove three unused messages from all seven locale dictionaries:
  `or send a message below`, `Frames and starters`, `Inspect selected text`.
  The localization audit exposed these after the earlier check was repaired.

## Verification

Local Node 24/Linux checks passed: frontend suite (1,013 tests), production UI
build, localization tooling and usage audit, benchmarks, Android harness checks,
architecture/style reports, docs links, docs tests (28), docs security tests (7),
styles, release tooling (15), iOS tooling type checking, and launcher type checks
and tests (4). The test glob was also passed literally to Node, without shell
expansion.

Native library tests passed (474 passed, two ignored), as did Clippy with warnings
denied, Rust contract and benchmark export checks, and formatting. Loopback and
subprocess fixtures required execution outside the restricted sandbox.

The checkout contains concurrent speech/diagnostic/retry changes; these counts
describe the combined local checkout. Windows Actions and signed release builds
have not been rerun. No repository commit, version bump, tag, push, or deployment
was performed by this task.
