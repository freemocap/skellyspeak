# Preloaded reading content plan

Status: gloss pilot implemented in source, 2026-10-07. Validation results below.
Whole-text translation and analysis imports remain proposed follow-ups.

Import reviewed content into workspace storage once per package version. Hover and
tap should use the existing saved-reading request, without opening bundled files
or checking package versions on each interaction. Imported content belongs to the
application's reading assistance, not learner evidence or provider execution history.

## Existing implementation

- [ReadingHelp](../../ui/src/components/reading/ReadingHelp.tsx) consults saved
  reading before requesting live generation.
- [The IPC adapter](../../ui/src/platform/ipc/saved-reading.ts) currently supports
  saved word glosses only. Translations and analyses need an extension of this
  contract; they are not already covered by the proposed import.
- [The native command](../../native/src/application/commands/reading.rs) combines
  retained generated glosses with accepted conversation annotations. Accepted
  exact passages take precedence.
- [Generated source lookup](../../native/src/language/reading/text_sources.rs)
  is scoped to current AI access and scans stored JSON. It is not an indexed
  portable vocabulary dictionary.
- [Inference cache storage](../../native/src/storage/schemas/inference_results.sql)
  ties results to execution records. Request keys also include provider and
  installation context. Cache eviction can remove payloads. Inserting fabricated
  successful executions would give imported content false provenance.

Consequently, this is an extension of saved reading storage and its existing
lookup, not a drop-in population of the current inference-result table.

## Proposed implementation

1. **Define reviewed content packages.** Keep source forms, language and variety
   identifiers, sense, morphology, romanization and pronunciation separate from
   translations into each explanation language and variety. Every package needs
   a version, digest, schema version, provenance, license and review status.
   Exact example sentences additionally need the existing source-text and token
   boundary validation. Preserve exact Unicode text; do not invent normalization
   or language-specific matching rules.
2. **Import under workspace ownership.** Add indexed imported-reading records and
   installed-package metadata through the next consecutive database migration.
   After migration and validation, startup checks package versions and imports
   changed packages transactionally before serving reading requests. Initially
   install all shipped pilot packages. Evaluate selective package installation
   only if measured full-scale size requires it.
3. **Use the existing saved-reading request.** Its native implementation queries
   imported records alongside eligible existing sources. No additional frontend
   route, bundle read or version check occurs during hover or tap. Imported
   content remains available without configured AI credentials. Preserve existing
   access rules for generated results.
4. **Preserve meaning and precedence.** Exact contextual annotations outrank
   generic dictionary senses. Generic entries retain dictionary provenance internally and must not be treated
   as verified analysis of the current sentence. Multiple senses and
   inflections must remain distinguishable. A dictionary match must not suppress
   an explicit request for contextual analysis. Extend the result contract to
   describe source provenance and contextual versus dictionary coverage before
   treating imported tokens as complete saved results.
5. **Retain imported content independently.** AI cache eviction and provider
   changes do not remove shipped content. Updating a package replaces only that
   package's records, leaving conversations, generated results and learner
   evidence untouched. Import creates no inference charges, executions or XP.
   Factory Reset recreates imports during ordinary workspace initialization.
   Failed imports roll back and report the failure without partially installing
   content or silently claiming the new version is available.
6. **Add translations after gloss integration.** Generalize the saved-result
   contract to return exact-text translations. Treat explanations as a subsequent
   content type with their own schema and review requirements. Written
   pronunciation is separate from audio; this plan does not preload TTS audio.

## Verification before expansion

Implement one small reviewed package first. Test a fresh workspace without AI
credentials, an existing workspace migration, repeated startup, package updates,
corrupt-package rollback, provider changes, ordinary cache eviction and reset.
Check preservation of conversation history, learner credit and inference receipts.
Verify exact language/variety scope, Unicode boundaries, contextual precedence,
ambiguous senses, partial coverage and explicit contextual requests.

Exercise the actual skill-example hover and mobile tap flow. Confirm saved content
returns without dispatching inference. Benchmark indexed lookups with synthetic
data at 420,000 cross-language glosses before generating that much real content.
This count assumes 21 languages with 1,000 source entries each and 20 destination
languages; additional senses and varieties increase it.

## Small model experiment

[The raw draft](reading-preload-pilot-2026-10-07.json) was generated by one
`gpt-6-luna` subagent in this chat, without separate API calls. It contains eight
specified source forms each for English, Spanish, Levantine Arabic and French:
32 records and 96 directed glosses. These are deliberately selected examples,
not a frequency list. Pronunciation is null throughout; Arabic romanization is
explicitly approximate. This experiment does not validate pronunciation quality.

The draft is retained unchanged as evidence of generation quality. Root review
found the following blockers before import:

- Variety IDs omit their language prefix and therefore do not follow the supplied
  application identifiers. The generator should receive a schema with enumerated
  identifiers, followed by deterministic validation.
- Destination glosses identify a language but not its variety. Arabic output is
  intended to be Levantine, but that scope must be stored explicitly.
- `en-can` maps uninflected English `can` to first-person Spanish `puedo` without
  identifying that narrowing. `fr-can` acknowledges first/second-person ambiguity
  but provides only the Arabic form described elsewhere in the draft as first
  person. Shared sense IDs alone do not preserve grammatical information.
- First-person Spanish and Arabic entries return French `peux` with a
  first/second-person note instead of preserving their known first-person meaning.
  Generation must distinguish ambiguity in the source from ambiguity in an
  isolated destination form.
- Review citations, licensing and pronunciation evidence are absent. Nothing in
  this file is approved for shipping. External lexical checks remain necessary,
  especially for dialect forms and pronunciation.

The next content iteration should add explicit morphology and destination scope,
then regenerate this same small set and verify it against authored references.
Mechanical checks should reject invalid identifiers and missing scope before
linguistic review. Reserve stronger-model review for ambiguity, disagreement and
sampled entries; do not equate agreement between models with source verification.
Do not expand to thousands of entries until the import and review contracts pass
this small end-to-end test.

## Implemented gloss pilot

The [shipped package](../../content/reading/preload-pilot.json) contains 96 records,
with [review scope and references](../../content/reading/READING_README.md).
It corrects the raw draft's variety identities and grammatical-person assumptions.
The source review selected attested `ميّة` for Arabic water and withheld unverified
romanization and pronunciation. These are editorial glosses checked against
references, not independently certified translations for every pair.

| Target variety | Exact supported source forms |
| --- | --- |
| United States English | water, house, book, tomorrow, here, big, can, bank |
| Spain Spanish | agua, casa, libro, mañana, aquí, grande, puedo, banco |
| Levantine Arabic | ميّة, بيت, كتاب, بكرا, هون, كبير, بقدر, بنك |
| France French | eau, maison, livre, demain, ici, grand, peux, banque |

Each target is explained in the other three listed varieties. Matching preserves
case, accents and marks; capitalization or spelling variants are not implicitly
covered. Source forms represent selected senses, not a full dictionary entry.

Workspace migration 55 adds imported-reading tables and a scope/surface index.
Startup installs the package transactionally after schema migration and validation.
An unchanged parsed package performs no import writes; data changes require a new
package version. Imported records have no provider execution or learner evidence.
The existing `get_saved_gloss_sources` command includes imported dictionary rows.

Word-help cards show the translation without a dictionary label or extra contextual
action. The earlier label/action design was rejected and removed. Contextual
annotations still take precedence; dictionary coverage cannot satisfy whole-passage analysis. Diagnostic
receipts retain package identity, version and review status without copying sense
text or reference URLs into diagnostics.

This pilot does not preload whole-sentence translations, grammatical analyses,
audio, pronunciation or romanization. Those require subsequent reviewed content
and, for sentence translations/analysis, an extension of the saved-reading contract.
Only this pilot package is registered for bundling. Before a 1,000-word expansion,
add an explicit package manifest and bounded files per language pair; the current
content inventory limits individual files to 2 MiB. The indexed storage supports
multiple package owners, but a general multi-package bundling workflow is not yet
implemented. The synthetic row-count test does not measure large-package startup
time, import duration or realistic storage size.

## Verification checkpoint

Completed automated verification:

- `npm run build` passed, including application TypeScript. Vite retains its
  existing large-chunk advisory.
- `npm run check:fast` passed, including localization, styles and diagnostic policy.
- `npm run contracts` passed. The source contract is exported from Rust.
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`
  passed after the migration fixture corrections.
- 46 focused UI tests passed across the saved index/result, reading help, saved
  IPC integration and conversation header suites. These cover hover, tap, no
  inference on dictionary hits, explicit contextual requests, precedence,
  multiple senses, exact Unicode matching and receipt redaction.
- All five native preload tests passed, including every shipped entry, import
  idempotence/update/rollback, cache independence, exact scope/Unicode and indexed
  lookup with 420,000 synthetic rows. The all-supported-starting-version migration
  test passed, along with the corrected historical migration fixtures.
- `npm run docs:links` and `git diff --check` passed.

The final full native run, `cargo test --manifest-path native/Cargo.toml --lib --
--test-threads=4`, finished with **851 passed, 6 failed and 6 ignored**. Lower
concurrency avoided the mock-transcription-server deadline failures seen in the
earlier run. The new-table migration regressions were fixed in test fixtures and
historical validators, without weakening production startup validation.

The six remaining failures are in concurrent guide-authoring work:

- `english_with_spanish_interface_and_explanations_opens_without_inference`
- `english_has_all_source_guides_and_assessments_for_both_varieties`
- `primary_language_grid_has_authored_guides_for_every_selected_variety`
- `readable_specimen_preserves_examples_and_separates_assessment`
- `inspector_composes_the_same_authored_sections_as_the_readable_report`
- `bundled_and_disk_language_content_match`

The failures concern missing English-to-Spanish guides, expected edition counts,
an assertion that Spanish-to-French is unavailable despite its new authored
edition, and a bundled/disk hash mismatch while content was being edited. The
repository-wide native suite is therefore not green. No guide content or those
assertions were changed as part of this preload work.

The package is version 3: display glosses contain compact translations, with
explanatory qualifiers removed. Sense and reference metadata remain internal. No application release version was
changed by this work, no external inference generation was called, and no commit
was created. A duplicate header CSS rule from concurrent work was consolidated
without changing its declarations to restore the fast style gate.

For an application check, rebuild the native application and reopen it so startup
imports the package. Select the exact target and explanation varieties above,
then hover or tap one of the listed words in a reading surface. A dictionary
fallback should appear without inference; a previously saved contextual meaning
may take precedence. Cards should show the translation without added boilerplate.
This manual check has not yet been performed in a running native application.

A concrete example is Spanish (Spain), explained in United States English:
open **People, things, and places**, find **El libro está en la mesa.**, and hover
or tap **libro**. An uncached contextual word should show the dictionary gloss
**book** without an inference request.

## Compact-card correction

Removed the added dictionary label and contextual-action button from reading help.
Package version 3 keeps glosses to translations without explanatory qualifiers.
The 41 focused reading UI tests, application build and fast gate passed after this
correction. Hover and tap tests verify saved translations need no inference and
show no added label or retry action. The native package-test rerun was blocked by Windows linker LNK1104: the shared
test executable could not be opened while another test run held it. No native
source changed in this correction; package version 3 remains unverified by that rerun.

## Expansion checkpoint, 2026-10-07

Implemented: five registered packages contain 8,790 compact directed glossary
records for English, Spanish, Arabic and French. Source varieties are US/UK,
Spain/Mexico, Levantine/MSA and France/Canada. Explanation varieties remain US
English, Spain Spanish, Levantine Arabic and France French, excluding same-language
pairs. No other language pairs were added.

The exact-token inventory covers every principal and inline target sample in all
available explanation editions of these four languages' skill guides. Coverage is
392/392 per English variety, 301/301 per Spanish variety, 148/148 Levantine,
161/161 MSA, and 345/345 France French and 344/344 Canada French. This means a
lexical fallback exists for each exact surface, not that sentence-level translation
or grammatical analysis has been precomputed. Corpus-ranked top-1,000 lists remain
future work; the extra everyday vocabulary is an editorial selection.

Authoring used two gpt-6-luna workers in a rolling queue (the chat rejected a third
new worker). The integration agent read the compact translation tables, applied
explicit corrections in `*-root-corrections.json`, and used another worker for
read-only English/French QA. Corrections include finite verb forms, auxiliary
meanings, Levantine register, Arabic vowel-sensitive person distinctions, and
compound-word senses. Worker drafts and rejected assumptions remain under
`reading-expansion/`; production data are separate. Draft records are not imported
directly. The first English worker pass and first Spanish handoff were incomplete;
both were sent back to finish sample coverage.

Review is explicitly `editorially_reviewed` for expansion packages. This means
AI drafting plus integration-agent review with targeted external checks; it is
not independent native-speaker certification or term-by-term external verification.
The pilot retains its separate `source_checked` status. Per-entry provenance links
to the authoring/review record. Frequency-resource links do not substantiate the
translations. Sources checked for selected corrections include RAE gustar
[@readingExpansionGustar20261007], British Council modals
[@readingExpansionModals20261007], UT Austin's French modal tables [@tex_modals2026], the existing
Lingualism glossary [@readingPreloadReference220261007] and LevanTongue ability
reference [@levantongueAbilityTeaching20261007]. No third-party dictionary
or frequency dataset was bulk imported or relicensed.

No hover/tap UI was added. Cards retain compact glosses; grammatical particles
without standalone equivalents sometimes use a short functional gloss. Generic
lexical alternatives cannot resolve every idiom or sentence-specific sense.
In particular, exact contextual annotations for compounds such as `rendez-vous`,
`nerve-racking`, and auxiliary constructions would improve selection over the
current compact alternatives. Existing saved contextual annotations still win.
Romanization, pronunciation, audio, sentence translations and analyses are not
preloaded by this expansion.

Startup validates the registered package catalog, then imports changed packages
through the existing database importer. No bundled-file lookup was added to the
reading path. Files are partitioned below the existing 2 MiB content limit.
Workspace migration 56 preserves both imported tables and widens only the review
status constraint. No application release version was changed. Its rollback and
history-preservation tests are separate from linguistic quality assessment.

Reproduce the inventory with `node docs/notes/reading-expansion-inventory.ts` and
save its stdout as the adjacent JSON. Run
`node docs/notes/reading-expansion/audit.ts` for strict exact-surface/direction,
duplicate identity, compactness and provenance checks. The stored coverage report
is `reading-expansion/coverage.json`. Automated verification is recorded after the
final checks below; no manual native-app check has yet been performed.

Common seed expressions spanning multiple segmented words were excluded from the
shipped expansion: they require contextual span support rather than token-dictionary
matching. The final 8,790-record audit still reports zero missing sample forms.
Startup validation now resolves each distinct scope once per package, avoiding
repeated construction of identical language guidance for thousands of entries.

### Expansion verification

- Full native library suite: 858 passed, zero failed, six ignored. This covers
  migration rollback and history preservation as well as reading integration.
- After the last Spanish and Canadian French lexical corrections, all five
  preload tests passed again on the final embedded packages, including lookup
  of every bundled entry without provider execution.
- Final coverage audit: 8,790 records, zero missing inventoried sample forms
  across the eight target varieties and their three included gloss directions.
- Final `npm run check:fast` and `git diff --check` passed.
- Native Clippy with warnings denied and binary checks passed. Application build
  and 41 focused UI reading tests passed; no card UI changes were needed for this
  expansion. Documentation links passed.

Rebuild and reopen the native app to import updated packages. No manual native
GUI check was performed for this expansion. Automated coverage establishes
availability, not independent linguistic certification. All changes remain
uncommitted.
