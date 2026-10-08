# French reading expansion draft

`french-entries.json` contains compact gloss draft records for the audited French sample surfaces and 111 curated everyday-word candidates. It covers 345 exact sample surfaces for `french-france` and 344 for `french-canada`, plus common candidates after deduplication: 416 and 415 distinct source forms. The file has 2,493 directed records across France French and Canada French into English, Spain Spanish, and Levantine Arabic.

`french-build.mjs` expands a compact gloss tuple map into records. The common candidates are editorial and non-ranked. The draft preserves grammatical gender where the target equivalent marks it and uses compact alternatives for ambiguous forms. `french-root-corrections.json` contains root-review edits; the output records have those edits applied. `french-unresolved.json` reports no unmatched forms, which means every surface has a draft tuple, not that every translation is verified.

All `sources` arrays are empty and the generic sense field awaits contextual editing, so these records are not importable and are not marked `source_checked`. The current audit found review needs for polysemous forms and morphology, including `on`, `a/à`, `avoir`, `faire`, `marcher`, `rendez` (from `rendez-vous`), and person-marked verb forms. Arabic equivalence also needs Levantine review. The compact gloss is the intended learner-facing content; explanatory notes belong in editorial metadata, not cards.

Online references consulted for sense checks: [Larousse: marcher](https://www.larousse.fr/dictionnaires/francais-anglais/marcher/49300) distinguishes walking and broader uses; [Larousse: être](https://www.larousse.fr/dictionnaires/francais-anglais/%C3%AAtre/31483) and [avoir](https://www.larousse.fr/dictionnaires/francais-anglais/avoir/160129) document the core verbs and constructions. [Wiktionary's French frequency references](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/French) point to corpus-based lists; this draft does not copy or claim to follow a ranked list.

`french-sample-coverage.json` records exact sample and candidate coverage. The sample inventory source is `docs/notes/reading-expansion-inventory.json`.

## Root integration review

The worker files above remain unreviewed draft evidence. The separate production
package in `content/reading/` incorporates root corrections from the adjacent
`french-root-corrections.json`. Root reviewed the compact translation table,
checked exact inventory coverage, and corrected the identified morphology,
lexical senses and display clutter. Targeted external checks do not establish
independent verification of every translation; the package therefore records
`editorially_reviewed`, not `source_checked`. See the expansion checkpoint in
[the integration report](../reading-preload-plan.md#expansion-checkpoint-2026-10-07)
for scope, limitations and final verification.

Canadian French meal glosses were separately corrected using OQLF:
`déjeuner` means breakfast [@readingExpansionQuebecBreakfast20261007] and
`dîner` means lunch [@readingExpansionQuebecLunch20261007]. These scoped entries
also retain direct source URLs. Shared guide prose may still need a separate
variety audit; this correction concerns the lexical preload.
