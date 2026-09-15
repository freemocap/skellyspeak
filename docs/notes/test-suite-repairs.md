# Test suite repairs

Status: **implemented and locally verified, 2026-09-15**. Follow-up to the
[suite audit](test-suite-audit-2026-09-15.md). The user authorized repairing broken
and misleading checks, with the new deterministic application journey deferred.

## Implemented

### F1: broken fixtures and offline screening

- Replaced the server's retired `workflow/` fixture dependency with four current
  Rust-exported gloss fixtures. Every fixture is exercised, including Arabic with
  combining marks, Chinese and Spanish. Endpoint enums must be present, so a
  fixture that does not exercise the relaxation cannot pass vacuously.
- Added `benchmark_gloss export --write/--check`, exposed through
  `npm run benchmarks:fixtures` and `npm run benchmarks:fixtures:check`. The Rust
  CI job checks freshness against the current native adapter.
- Extracted offline validators into `tools/benchmarks/screening.ts`; imports no
  longer load historical experiment inputs or access credential files. Updated
  the existing experiment consumers to import this owner.
- Moved the five existing validator scenarios to `screening.test.ts`, replaced
  archived-input dependencies with newly authored helper cases and current native
  fixtures, added positive acceptance assertions and a combining-mark/source-ID
  regression. `npm run benchmarks:test` runs six tests and is wired into CI.
- Corrected screening coverage to follow ordered native source IDs. Those encode
  UTF-16 starts; they are not consecutive character or grapheme numbers.
- Fixture provenance and regeneration instructions live beside the generated
  data in [tools/test-fixtures/model-routing/](../../tools/test-fixtures/model-routing/README.md).
  No archived fixtures were copied.

The live experimental benchmark runners remain outside active verification and
still require a separate review of their historical inputs/model assumptions.
This repair restores the offline validators and the server contract regression;
it does not claim to restore a representative model-quality evaluation corpus.

### F3: Android assertions and preconditions

- Added a feedback-state DOM attribute derived from actual feedback/decision,
  pending and failure props. No user-facing label or action behavior changed.
- The runner requires the expected learner-message count, a reply on the newest
  message's own turn and completed feedback on that same turn. Old feedback,
  pending feedback, missing evidence, “Feedback unavailable” and failed feedback
  cannot satisfy the completion predicate.
- Disclosure is bound to the selected message and exact source occurrence. It
  must start closed with no visible meaning, then expand and reveal that word's
  own meaning. A no-op click, another word's gloss or an already-visible gloss
  does not pass.
- The runner requires an English interface explicitly, records the selected AI
  route through Settings, and turns off always-visible translations through the
  ordinary preference control for each newly created test conversation. Previous
  values are recorded; the test conversations retain those preferences. Access
  settings and credentials are not changed.
- Eight jsdom regressions exercise the shared predicates with real
  `MessageFeedback` and `SavedGlossText` components. Geometry is mocked explicitly;
  these checks do not prove real layout. Serialized predicates are also evaluated
  as they are sent to CDP, so module-local dependencies cannot silently break them.
- CI now type-checks the Android runner and runs its device-selection test via
  `npm run e2e:check`. The ordinary UI suite owns the DOM assertion regressions.

### F4: iOS CI platform

Moved `npm run ios:test` from the Windows frontend job to the macOS iOS job.
The actual IPA-verifier execution test now has the platform it requires. Both
cases passed locally, including the valid fixture and the verifier's six rejection
scenarios. This is checked-in CI configuration, not evidence of a remote CI run.

### F7 and narrow F8 cleanup: honest names, reports and assertions

| Removed or changed | Retained protection/replacement |
| --- | --- |
| Three warning-only cases in `dead-code.test.ts` | Reports remain in `npm run test:reports` (graph/export analysis and style candidates), invoked in CI. Actual graph/reachability assertions remain tests; unresolved imports fail. No production code was deleted. |
| Shell tests named as complete draft/sign-in workflows | Names now describe the mounted page stub and session-store wiring; assertions retained. |
| `playback-lifecycle.browser.test.ts` | Renamed to `playback-lifecycle.dom.test.ts`; all event/state assertions retained. |
| Server proxy suite's “End-to-end” docstring | Describes ASGI integration with fake authentication/storage and controlled upstream. |
| TargetText many-fragment/reopen assertion checked only no IPC | Also verifies every rendered fragment before and after reopening, and its absence while unmounted. |
| Duplicate local close-listener source regex | Repository-wide prohibition and behavioral native listener tests retained. |
| Repeated identical contrast matrix entries | Every unique color pair remains checked. |
| Broken `model-routing.test.ts` | Its five scenarios retained under `screening.test.ts`, now with active fixtures, positive cases and one additional source-ID case. |

The historical audit and inventory link to renamed files and clearly retain their
pre-repair counts. Maintained tool/harness READMEs describe the new commands and
verification limits.

## Verification

All JavaScript checks used Node 24.15.0. Existing unrelated UI/style work was
preserved; results are for the current shared working tree.

| Check | Result |
| --- | --- |
| `npm test` | **108 files, 672 tests passed** |
| Shared Android assertion suite after adding CDP serialization checks | **Eight tests passed** |
| `python -m pytest server/tests -q` using `server/.venv` | **275 passed, seven explicitly skipped emulator tests** |
| `npm run benchmarks:test` | **Six passed**; also passed when invoked by absolute path from `/private/tmp` |
| `npm run benchmarks:fixtures:check` | Passed against the current Rust exporter |
| `cargo clippy --locked --manifest-path native/Cargo.toml --bin benchmark_gloss -- -D warnings` | Passed |
| `npm run ios:test` on macOS | **Two passed, zero skipped** |
| `npm run e2e:check` | Type-check and device-selection test passed |
| `npm run build` | TypeScript and production frontend build passed; existing large-chunk warning |
| `npm run test:reports` | Completed separately from test totals; no unresolved imports |

No device run, live provider call, deployment, release or new deterministic
end-to-end application test was performed. The full native behavior suite was not
rerun for this repair: native changes are confined to the offline fixture exporter;
its build/freshness check and targeted Clippy check cover that change.

## Deferred deliberately

The new real-app/native/server deterministic journey is the next pass. Broader
emulator coverage, browser capture lifecycle tests, cross-scope statistics,
representative linguistic evaluations, mutation testing, fixture extraction and
large-suite decomposition remain the audit's separate recommendations. This
bounded repair does not claim those coverage gaps are closed.
