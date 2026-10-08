# English reading expansion draft

`english-entries.json` contains compact gloss draft records for the audited English sample forms and the 100 editorial common-word candidates. It covers 388 exact sample surfaces per variety (`english-united-states`, `english-united-kingdom`) plus the common-word candidate set, after deduplication within each variety. The result is 427 distinct source forms per variety and 2,562 directed records across the three requested explanation varieties.

`english-build.mjs` generates the records from a compact translation tuple map. Case variants retain distinct source text and IDs. The draft keeps a lemma gloss for regular inflections and phrase glosses for contractions; finite forms such as `am`, `is`, and `are` retain person/number distinctions where practical. `will` is glossed as a future marker because its meaning is grammatical and context-dependent. Entries for `open` use the adjective sense from the sample context.

This is an editorial draft, not an importable package. Source arrays are empty pending term-by-term source review, and the generic sense notes must be replaced with short contextual senses before integration. The Arabic is intended as Levantine colloquial and needs dialect review; several terms can vary by speaker or context. The 100 common-word candidates are curated, not frequency-ranked. For future frequency ranking, `wordfreq` documentation states that its frequency data are available under CC BY-SA 4.0; review attribution and ShareAlike obligations before using or redistributing any data. See [wordfreq project and data terms](https://github.com/rspeer/wordfreq).

`english-unresolved.json` records any source surfaces without a tuple; the current pass has none. `english-sample-coverage.json` links the inventory to the repository-wide audit output. The generated entries are ready for root review and are not marked `source_checked`.

## Root integration review

The worker files above remain unreviewed draft evidence. The separate production
package in `content/reading/` incorporates root corrections from the adjacent
`english-root-corrections.json`. Root reviewed the compact translation table,
checked exact inventory coverage, and corrected the identified morphology,
lexical senses and display clutter. Targeted external checks do not establish
independent verification of every translation; the package therefore records
`editorially_reviewed`, not `source_checked`. See the expansion checkpoint in
[the integration report](../reading-preload-plan.md#expansion-checkpoint-2026-10-07)
for scope, limitations and final verification.
