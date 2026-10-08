# Arabic reading expansion draft

`arabic-entries.json` contains compact gloss records for the audited Arabic sample surfaces and dialect-specific common-word candidates. It covers 148 exact Levantine sample forms and 161 Modern Standard Arabic sample forms. The seed lists add everyday vocabulary and are curated, not ranked. `arabic-build.mjs` preserves each original surface spelling, including diacritics, while using a local normalization only to select a draft translation tuple; the displayed source form is never normalized.

This remains a draft, not an importable package. Every `sources` array is empty and the generic sense field needs contextual editing, so no entry is marked `source_checked`. `arabic-unresolved.json` currently has no unmatched forms; that only means every surface received a draft gloss. Dialect checks are especially important for the Levantine forms and for distinctions in negation, person, gender, number, and attached clitics. Common seed lists include a few multiword expressions and should be trimmed to word-only entries before integration.

For Levantine ability forms, [theLevanTongue's overview](https://thelevantongue.com/levantine-arabic/ability-inability-levantine-arabic/) documents `بقدر`, dialect differences and `فيني`; this informed the ability glosses. The [Lingualism Levantine glossary](https://resources.lingualism.com/wp-content/uploads/Mido-in-Levantine-Arabic-Glossary-Lingualism.pdf) is a useful lexical cross-check. Neither source was copied as a dataset. Modern Standard Arabic mappings still need dictionary-level review.

`arabic-sample-coverage.json` records exact coverage per variety and the additional seed candidates. The source inventory is `docs/notes/reading-expansion-inventory.json`.

## Root integration review

The worker files above remain unreviewed draft evidence. The separate production
package in `content/reading/` incorporates root corrections from the adjacent
`arabic-root-corrections.json`. Root reviewed the compact translation table,
checked exact inventory coverage, and corrected the identified morphology,
lexical senses and display clutter. Targeted external checks do not establish
independent verification of every translation; the package therefore records
`editorially_reviewed`, not `source_checked`. See the expansion checkpoint in
[the integration report](../reading-preload-plan.md#expansion-checkpoint-2026-10-07)
for scope, limitations and final verification.
