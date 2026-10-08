# Spanish reading expansion draft

`spanish-common-entries.json` contains 362 Spanish surface forms for each of Spain Spanish and Mexican Spanish, with directed glosses into United States English, Levantine Arabic and France French (2,172 records total). The 301 exact surfaces used by the eight English-explained skill guides are covered in both varieties. The additional 61 forms are a small common-vocabulary seed; this is not a ranked or complete 1,000-word list.

The two guide varieties currently declare `use_core`, so they share the same sample surfaces. The inventory uses the app's `Intl.Segmenter(undefined, { granularity: 'word' })` with `isWordLike=true`, and preserves exact capitalization, accents and spelling. No matching normalization has been applied to display text. `spanish-sample-coverage.json` records exact-form coverage; `spanish-unresolved.json` records any missing mapping and is empty after the current build.

All glosses are model-authored drafts. Their `sense` fields explicitly require review and do not form learner-facing labels or explanations; glosses are kept compact. The records do not claim `source_checked`. I consulted the Spanish frequency references below for vocabulary selection and Levantine learning references for a subset of Arabic equivalents. Those references do not verify each English, Arabic or French tuple. Before package integration, review source-specific meanings, verb person and tense, contractions, agreement, polysemy, and naturalness in both Spanish varieties and each destination variety. In particular, `cara`, `fue`/`fui`, `iba`, `cenamos`, `lo`, `ser`/`estar`, `mañana`, and short function words need contextual review. Arabic equivalents favor Levantine where a clear colloquial form was known, but some remain broadly shared or standard; French gender and agreement can depend on omitted context.

No dictionary definitions or frequency dataset have been bundled. The reference pages are research notes only; the package license does not relicense their content.

References consulted:

- Wiktionary, [Frequency lists/Spanish1000](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish1000): frequency-ranking reference, not translation evidence.
- OpenSLR, [Spanish Word list (SLR21)](https://www.openslr.org/21/): Spanish Gigaword frequency resource; its page states CC BY-SA 3.0 US. The 22 MB dataset was not downloaded or incorporated.
- Parallel Arabic, [Levantine “thank you”](https://www.parallel-arabic.com/levantine/phrases/thank-you): consulted for the common expression `شكراً`.
- OpenArabic, [common Arabic phrases](https://www.openarabic.org/common-arabic-phrases/): consulted for cross-variety common expressions including Levantine `هون`.
- Wikibooks, [Levantine Arabic verbs](https://en.wikibooks.org/wiki/Levantine_Arabic/Verbs): consulted for colloquial verb patterns such as `بيعمل`.

## Root integration review

The worker files above remain unreviewed draft evidence. The separate production
package in `content/reading/` incorporates root corrections from the adjacent
`spanish-root-corrections.json`. Root reviewed the compact translation table,
checked exact inventory coverage, and corrected the identified morphology,
lexical senses and display clutter. Targeted external checks do not establish
independent verification of every translation; the package therefore records
`editorially_reviewed`, not `source_checked`. See the expansion checkpoint in
[the integration report](../reading-preload-plan.md#expansion-checkpoint-2026-10-07)
for scope, limitations and final verification.
