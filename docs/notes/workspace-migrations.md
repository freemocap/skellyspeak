# Workspace migrations

Status: implemented; verification results below. Approved direction: preserve
workspace history through consecutive upgrades beginning at format 45. This
supersedes the previous development reset policy for supported workspaces.

Current format: **52**. The 51 → 52 step adopts the bundled v4 Turbo synthesis default while preserving historical receipts and custom model IDs. The preceding format 51 introduced explicit skill/subskill conversation targets. The 50 → 51 step preserves records and expands the closed direction contract. The 49 → 50 step removes only the coaching activation
preference: coaching is required on new turns. Captured turn policy, operations,
learner revision, evidence and awards remain unchanged. The removed preference
is intentionally retired; the three optional-work preferences retain their values.

 The 48 → 49 step adds the four execution preferences to
learner preferences. It preserves learner revision, accepted operations, captured
turn policy and saved results. Defaults match new workspaces; malformed existing
values fail validation and roll back.

The 47 → 48 step cancels unfinished assessment operations
while retaining completed results, source messages, awards and attempt metadata.
Interrupted running attempts retain unknown provider/billing outcomes. New turns
use the combined ten-question assessment. See the
[ownership and verification record](eight-group-learning/content-implementation.md#workspace-format-48-ownership-treatment).

The 46 → 47 step adds an initially empty
`skill_level_events` table. Existing XP, evidence, settings and award claim flags
are unchanged. Explicit runtime initialization derives catch-up from eligible
credits; ordinary reads and the migration do not award or rewrite XP. Receipts
survive source-conversation deletion to prevent repeat celebrations and contain
only identifiers and levels, not message text. Factory Reset removes them with
the workspace. The released 45 → 46 step remains unchanged.

Verified with the full native suite: real skill credits and XP claim flags survive
both supported starting formats, migration failures roll back, repeated startup
does not repeat upgrades, and fresh/migrated schemas match. See the
[native/UI handoff](skill-radar-levels-handoff-2026-09-30.md) for integration details.

## Scope and behavior

The local native SQLite workspace owns learner history. This change does not
migrate the hosted service or change XP formulas, award amounts or level thresholds.
Application release numbers remain independent of database formats.

Format 46 is the first destination. Its 45 → 46 step makes existing optional startup
tables part of the required schema: skill choices, reward preferences, playback rate,
microphone choice, inference results, recording results and audio analysis caches.
Existing values survive; absent tables/default rows are created. Schema validation
accepts source-file LF/CRLF differences while continuing to reject changed table,
index and trigger definitions. Unknown extra objects are retained, as before.

The frozen version-45 contract contains the original core and generation DDL.
An additional frozen script records optional startup tables and their defaults.
Historical validation never executes these scripts against the user's database;
it builds in-memory reference databases. The migration applies only its frozen
optional-table script and reviewed retirement statements. Future steps must freeze
their own SQL/JSON transformations and destination validators. The current fresh
schema is maintained separately and compared against upgraded databases in tests.

Startup retains the workspace lock, verifies the migration chain and source
identity/integrity/schema, and creates a consistent SQLite recovery image before
migration writes. One immediate transaction encompasses every pending step, its
version update and output validation. Current schema and learner-facing snapshot
validation run before commit. Snapshot validation covers preferences, personas,
conversation settings and saved topics; it is not an exhaustive semantic audit of
every historical result JSON. Each future migration must validate the records it
transforms, including any newly required JSON shapes and meaning.

Ordinary interrupted-work recovery, cache pruning and session-receipt cleanup run
after successful migration. They retain their existing behavior, including the
workspace revision increment at startup. Runtime schema creation has been removed
from those recovery paths; small feature bootstrap helpers remain test-only.

Pre-45 files are refused without modification. Newer files ask for a newer app.
Unknown, damaged, failed-to-migrate and unsupported files are never automatically
reset. A missing/duplicate registry step or a format bump without a corresponding
step fails explicitly. Current workspaces skip the migration and backup path.

## Retirement review

The first step moves the existing retirement of `inference_holds`,
`drill_references` and `inference_profiles` out of ordinary startup. These are
retired access lockouts and regenerable discovery/reference caches, not learner
evidence, awards, conversation records, recording ownership or durable execution
receipts. Integrity and foreign-key checks run before and after the step. No
other product records are deleted by this migration. The recovery image also
retains these tables when present in the source.

Historical effort awards retain their source identity, policy, timestamps and
claimed state. This change neither recalculates XP nor issues new awards. Future
formula changes need an explicit product decision about derived level displays
and historical credit; the migration framework does not make that decision.

## Recovery ownership and limitations

Recovery files live in `migration-backups/` beside the database, named with source
and destination versions plus a unique token. SQLite `VACUUM INTO` includes
committed WAL pages. A private staging file is checked for database integrity,
flushed and renamed before any upgrade. Failures report useful typed diagnostics;
partial-copy removal errors are included rather than ignored. On Unix the recovery
directory and files use private permissions and the directory is flushed after
publication. Windows uses the enclosing application's data-directory access policy.

Copies contain private local database records. They are never uploaded or
automatically pruned. Explicit Factory Reset clears them with the other workspace
data. Files and credential stores are outside the migration transaction and are
not modified by migration steps. These database images are not full backups of
audio files or credentials; recovery is manual, with no new restore UI. Stop the
application and retain the original workspace and sidecars before manual recovery;
do not replace a live SQLite database or combine an old image with newer WAL files.

Failed steps explicitly roll back the complete chain and retain step, phase,
source/target versions and nested redacted cause diagnostics. Failed commit or
rollback operations report uncertainty instead of asserting that data is unchanged.
Retry after a rolled-back failure starts from the original persisted version.

## Verification

Automated tests exercise a frozen baseline independently of current schema
creation, populated history/settings preservation, recovery-copy contents and WAL
records, fresh/upgraded schema equivalence, current-version reopening, unsupported
and damaged sources, backup refusal, JSON validation rollback, registry gaps and
duplicates, multi-step upgrades from each source version, failure after earlier DDL
and data changes, and successful retry after rollback. A supplementary application
flow verifies that conversation ownership, original messages and continued reading
survive the first migration.

Verification on 2026-09-30:

- `cargo test --manifest-path native/Cargo.toml --lib --quiet`: 738 passed,
  2 failed, 5 ignored. All ten migration tests and the existing startup/storage
  suites passed. The two failures are unrelated Arabic content fixture mismatches:
  `drill::bundled::tests::previews_preserve_scripts_and_selected_variety_without_writes`
  and `language::languages::citation_tests::arabic_gloss_prompt_snapshot_has_explicit_scheme_and_preserves_source`.
  Neither those tests nor their content sources were changed here.
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`:
  failed on four findings outside this change: `chunks_exact_to_as_chunks` in
  `ai/transport/speech_stream.rs`, `collapsible_if` in
  `application/commands/workspace.rs`, `manual_is_multiple_of` in
  `speech/stream_delivery.rs`, and `cloned_ref_to_slice_refs` in
  `learning/effort/tests.rs`. No migration-file findings were reported.
- `cargo fmt --manifest-path native/Cargo.toml -- --check`: passed.
- `git diff --check`: passed.

After the final startup ordering review,
`cargo test --manifest-path native/Cargo.toml --lib storage:: --quiet` passed all
51 storage tests, including all ten migration tests.
No live learner workspace was opened or upgraded during these tests; no deployment
was performed. All work remains uncommitted.

## Format 51: skill-directed conversations

The conversation direction's closed `topic` union admits a `skill` value with a
main `skillId` and optional `subskillId`. Format 50 → 51 validates the source
contract and expands the permitted values without rewriting any settings,
messages, captured turns, assessment records, receipts or earned awards. No SQL
objects, audio files or credentials change. The migration runner owns the recovery
copy, version write and transaction. A format-50 application rejects a format-51
workspace before attempting to interpret its skill targets.

Guide attachments are optional metadata in new turn contexts; existing contexts
need no backfill. Guide translation cache payloads keep their existing shape;
source action references are derived at retrieval time. Migration tests cover
all supported starting formats, recovery-copy reuse, populated-record preservation,
rollback and repeated startup. No live learner workspace was migrated by the agent.
