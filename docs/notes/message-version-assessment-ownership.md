# Message versions and assessment ownership

Status: implemented in source; verification recorded below. No live application
restart, workspace reset, commit or deployment was performed for this change.

## Agreed behavior

Each accepted wording is its own immutable message version. Applying a fix
creates fresh content-derived work. An earlier assessment must not become an
input to the new correction assessment. Fix history is a relationship between
versions, independent of whether any particular fix resolves an issue.

## Implemented structure

- Retained the existing `turns.replaces_turn_id` chain and the completed frontend
  fix counter. No new stable identity table is necessary: the root message ID
  identifies a history, and each version has its own message ID and turn ID.
- Added database guards against mutating message text, role or ownership,
  changing operation/attempt ownership, or publishing a result for another
  source message. Message insertion must match its turn's conversation.
- Added `message_assessments(attempt_id, message_id, kind, result)` for successful
  coaching, numeric ratings and skill assessments. Rows are immutable and retain
  earlier successes after reassessment. Learning projections remain with their
  existing owners; this table does not award additional credit.
- Correction observations now load from the result table rather than persisted
  `turns.context.coachObservation`. `assessment_disclosures` owns mutable disclosure through a foreign key to the
  producing result. A fresh assessment cannot inherit old disclosure.
- Removed the unused help ladder and revision-limit configuration alongside
  its Rust contracts and generated authoring schema.
- Removed `coachRetry`, `coach_retry_check`, repair-status output and the related
  display branches. Revisions schedule the ordinary assessment. Its request
  excludes private coaching dialogue and predecessor feedback. Conversation
  context and current clarification remain valid inputs.
- Identical replacements are unusable assessment items. Partial usable results
  disclose omissions; wholly unusable output fails the operation and makes the
  existing failed-help retry available. Original responses and failure metadata
  remain attached to their attempts. No automatic retry was added.
- Added `Store::message_history`, registered `get_message_history`, exported
  Rust-generated contracts, and added `readMessageHistory` at the UI IPC boundary.
  History is ordered oldest first, accepts any version in the chain, validates
  conversation scope, and is independent of the loaded conversation page.

## Limits and follow-up

- History browsing controls are not implemented. The native API and typed IPC
  adapter are ready for that focused frontend work.
- This remains a linear fix history. Editing an earlier exchange still deletes
  the dependent conversation suffix. Retaining abandoned branches is a separate
  product decision.
- Ownership prevents cross-version result reuse. It does not guarantee the
  linguistic correctness of a newly generated assessment.
- Workspace format increased from 43 to 44. No migration or silent reset is
  provided. Existing local application data was not modified; use the explicit
  reset flow before running this build against incompatible development data.

## Verification

Regression coverage includes source-independent fix requests, per-version
feedback after reopening, histories beyond the 100-message viewport, immutable
text/ownership, cross-version publication rejection, late old completions,
reassessment without creating a fix, retained earlier results, and identical
replacement failures. Existing speech and Drill corruption fixtures explicitly
remove the immutability trigger to continue testing their deeper source checks;
ordinary writes are independently tested as rejected.

- Conversation regression suite: 181 passed, 4 ignored (live-provider tests).
- Affected UI suites: 193 passed; history IPC, demo, activity-status and Android
  assertion suites: another 42 passed. Fix-counter source files are unchanged.
- Native binary checks and generated contract checks passed. Configuration schema
  export/check passed. Application source and preview TypeScript checks passed.
- Full native suite: 722 passed, 2 failed, 5 ignored. The failures are unchanged
  Arabic-content expectations in `drill/bundled_tests.rs` and
  `language/languages_citation_tests.rs`; the source content includes marks that
  those expected strings omit. Neither fixture nor language data was changed.
- Full UI TypeScript checking reports the existing zero-argument mock tuple error
  at `features/activity/ActivityGraph.test.tsx:24`. Source-only checking passes.
- Strict lint checking reports existing warnings in `ai/transport/speech_stream.rs`,
  the speech branch of `application/commands/workspace.rs`,
  `speech/stream_delivery.rs`, and `learning/effort/tests.rs`. These unrelated
  implementations were not altered to make this change's checks pass.

New modules and tests remain below 500 lines. Existing mixed model/command files
receive only contract registration and one command entry point; their unrelated
responsibilities were not split as part of this feature.

## Follow-up: skill evidence incorrectly displayed as message errors

Observed and implemented, 2026-09-30. Read-only inspection of a reported revised
message found a successful assessment of the current text. Its observation had
`outcome: not_demonstrated`, `error: null`, and no selected correction. The UI
inferred an error directly from the skill outcome, while the coach card correctly
had no correction to display. This recurrence was not cross-version result reuse.

Native `coach_policy::view` now publishes `CoachObservationView.issues` using the
same actionable-item predicate as correction disclosure. `items` remains skill
evidence; issues do not expose the hidden correction text. Bubble counts, inline
marks and the Clean verdict consume issues instead of interpreting skill outcomes
as wording errors. Existing saved observations receive this projection on read;
no database changes, new assessment requests or history changes are needed.
Fix counts and the existing effort-credit qualification policy are unchanged.

Verification: 17 native coaching tests, 169 conversation execution tests and eight
effort qualification tests passed; three live execution tests were ignored. The
affected UI suites passed, including the reported evidence-only shape, matching
badge/dialog behavior, absence of inline marks and retained hidden actual issues.
Generated contracts pass their consistency check. Full TypeScript checking still
reports the existing `ActivityGraph.test.tsx:24` zero-argument mock tuple error.
The running native application was not rebuilt or restarted as part of this check.
