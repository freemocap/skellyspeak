# Eight-group learning PR readiness

Local verification and source review, 2026-10-04. Branch: `skill-radar-levels`.
The implementation is ready for the focused running-app check below and PR
packaging. No commit, push, PR creation or deployment has been performed.

## Implemented scope

- Eight XP/assessment groups and 42 teaching subskills; no subskill XP.
- One ten-question Jev request for eight groups, grammar and understandability.
  Native code validates and publishes results and one-time credit. The
  partner-understood counter uses understandability; no clean-message counter.
- Fast partner replies/openings and reply briefs. Coaching runs automatically
  and updates message error marks without opening Analysis. Assessment, reading
  support and reply briefs have shared Automatic/On demand preferences.
- Conversation remains mounted behind Practice and Skills. Skill/subskill starts,
  exact phrase starts and scoped guide/example coach questions use the selected
  conversation/partner with native source validation and transaction ownership.
- Required assessment and English source-guide documents for all 20 languages.
  There are zero required coverage gaps. Optional bundled translations have 320
  gaps and can resolve through on-demand translation; source examples are preserved.
- Explicit AI authorship, review state, source provenance and offline assessment
  specimens. Workspace formats 48–51 use consecutive migrations, recovery copies
  and ownership-preserving validation.

## Final wrap-up corrections

- Server assessment tests now use the exported combined native request fixture
  and retain size/accounting/semantic-ownership assertions. They no longer load a
  separate ratings document. The file is `server/tests/inference/test_turn_assessment.py`.
- The speech catalog test reads `content/speech/speech-routing.yaml` and still
  checks both LF and CRLF digest normalization.
- The Rust CI job now runs required-content readiness and generated authoring
  schema freshness checks. Both commands passed locally.
- The workbench README points to `content/rust-schemas/`. Completion notes and
  source-coverage counts are reconciled with the actual catalog.

## Verified locally

| Check | Result |
| --- | --- |
| Final `npm run check:fast` after wrap-up corrections | Passed |
| `npm run docs:links` and diff whitespace check | Passed |
| `npm test` (includes fast gate) | 1,779 tests passed in 268 files |
| `npm run build` | TypeScript and production Vite build passed |
| `npm run contracts:check` | Passed |
| Native library tests, authoring completion checkpoint | 822 passed, 5 ignored |
| Final configuration regression rerun | 66 passed |
| Native Clippy `--lib --tests -- -D warnings` | Passed |
| `cargo test --locked --manifest-path native/Cargo.toml --bin export-contracts` | 1 passed |
| Server suite through installed virtualenv | 577 passed, 7 skipped |
| `npm run content:workbench:check` | TypeScript and 9 tests passed |
| `audit-content --ready` and `--check-schemas` | Passed |
| `npm run benchmarks:fixtures:check` | Passed |
| `npm run docs:test` | Documentation tests and 7 dependency security tests passed |

The UI build/test config bundler needed execution outside the filesystem sandbox;
the ordinary commands passed with that access. The uv launcher could not read its
cache, so the server suite used `server/.venv/Scripts/python.exe -m pytest server
-q -p no:cacheprovider`. No dependencies or lockfiles were changed.

Non-failing output: Vite reports a large bundle; jsdom reports missing canvas
rendering support; Starlette reports an httpx deprecation. The skipped server
tests require the Firestore emulator. Hosted CI, platform builds and provider
execution were not run here. Automated passes do not certify linguistic accuracy.

## Diff ownership and packaging

The checkout contains staged moves, unstaged edits and untracked authored sources.
Do not commit only the tracked diff: that would omit required content and native/UI
modules. The source inventory includes content, source modules, tests and notes;
no untracked file exceeded 1 MB at review. The user's `old-content/` reference
directory is not read by the application bundler. It was left untouched.

The checkout also contains the independently prepared friendly-error UI work
documented in `../friendly-errors-2026-10-04.md`. It passed the same full UI suite,
but this task did not rewrite or stage it. Select its inclusion deliberately when
packaging; do not silently absorb it into an eight-group-only commit.

Targeted source review covered prompt/model routing, content inventory and source
selection, guide translation/cache ownership, phrase/skill starts, coach context,
transaction boundaries, migrations and UI action wiring. Research-only frozen
prompt studies are not runtime inputs; adapting their 45-criterion sweep generator
to a new experiment is follow-up work, not a current assessment path. No paid study
was launched and no frozen study fixture was rewritten.

## Focused running-app acceptance

1. Set assessment to On demand. Send a message: partner text appears, a quiet
   coaching underline resolves into error marks or no marks without opening
   Analysis. Open Analysis once, then reopen it; saved results should be reused.
2. Select a newly authored language. Open Skills, a group and a subskill. Ask the
   coach about an example and follow up; its attachment must retain the right
   language, variety and source scope.
3. Start from a skill and then from a bubble selection. Confirm the partner,
   difficulty and target are correct; the selected whole-word phrase appears
   unchanged in the opening, with surrounding words allowed.
4. Use Spanish or Arabic explanations on an unbundled guide. Check the translated
   prose, preserved examples and cache reuse. Check both Arabic target varieties;
   the comparative guides display clearly labeled examples for both varieties.
5. Return between chat and Skills: confirm draft/coach state remains. Check skill
   hover stability and label readability at a narrow width; inspect RTL layout.

Independent linguistic review, additional bundled translations, systematic model
evaluation, exhaustive device/accessibility acceptance and a dedicated offline
start/coach-context preview command remain follow-ups. The title in the Back to
conversation strip is also an open UI detail (W3); the return action is implemented.

## Git gate

After acceptance, an explicit instruction to commit is required by AGENTS.md.
Review the exact staged scope, commit once, push and open a PR using
`pr-description.md`. The draft does not represent an already-created PR.
