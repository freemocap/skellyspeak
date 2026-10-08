# Seven-language guide grid: French explanation column — 2026-10-07

Status: implemented; independent cross-review complete, native-speaker review pending. Scope is eight shared French skill explanations and 56 target guides for English, Spanish, French, Arabic, Mandarin, Cantonese and Portuguese. Existing English guides are the content source; assessments, definitions, runtime and bibliography remain outside this pass.

## Implemented checkpoint

All eight shared French files now translate the current English titles, introductions and 42 subskill concepts. Skill and subskill identities, order and scoped source keys are retained. Their provenance marks AI translation and `needs_review`; no native review is implied.

The English target is complete: all eight French explanation guides cover 42 core subskills and 11 United States variety sections. Each translates the concrete context, form explanation, worked meaning and full practice answer with its reason. A local writer checked each field’s exact multiset of backticked target fragments against its current English source before saving; a later YAML comparison confirmed all 53 core/variety sections retain the source IDs, order and principal examples.

The Spanish target is complete in eight French explanation guides, adding 42 core sections. A local YAML/source comparison across English and Spanish verifies 95 core/variety sections: every principal sentence, ID, order and per-field marked-fragment multiset matches its current English guide, while all three learner-facing prose fields are translated. Each guide retains scoped source keys and `needs_review` provenance.

The French target is complete in eight French explanation guides, adding 42 core sections and 17 Canada branch sections. The Canada branch teaches `déjeuner` as breakfast and `dîner` as the midday meal where these differ from the France core. The same source/marked-fragment check now covers 154 sections across the first three targets.

The Arabic target is complete in eight French explanation guides, adding 42 Modern Standard Arabic core sections and 42 Levantine branch sections. Both branches teach the actual forms in their principal examples; the per-field marked-fragment writer validated all 84 sections before saving.

The Mandarin target is complete in eight French explanation guides, adding 42 core sections. The lessons retain distinctions in time, aspect, classifiers, roles and question structure from the current English guides. The writer checked each marked target fragment before saving.

The Cantonese target is complete in eight French explanation guides, adding 42 core sections. The French text retains the source’s role and classifier contrasts, conversational functions, aspect distinctions and full worked practice. Exact marked-fragment checks passed for every field.

The Portuguese target is complete in eight French explanation guides, adding 42 core sections and 43 principal examples. The second example in `event_phase` has its own translated meaning and practice note; both original example sentences and all marked target fragments are preserved.

Across the seven targets, all 56 guides cover 294 core sections and 70 variety sections. The French editions retain the current English source’s principal target sentences, exact per-field backticked-fragment multisets, IDs, order, varieties and scoped sources.

## Verification and limits

The shared grid audit (`node docs/notes/seven-language-grid-audit.ts --partial`) passed after the French column was completed. It parsed the YAML and checked every French edition’s 42-ID group coverage, varieties, principal text, marked fragments, review revision and shared explanation link. `git diff --check` and `npm run check:fast` passed. Other columns remain incomplete, so the audit was intentionally partial; final integrated gates belong to the root integration pass. All French translations remain marked `needs_review`; this work is not a native-speaker certification.

## Independent cross-review

A second worker compared all eight shared titles, introductions and 42 concepts with the English shared edition, then reviewed the explanation, meaning and practice-note fields across all 56 target guides: 294 core sections, 11 English US replacements, 17 French Canada replacements and 42 Arabic Levantine replacements. The review included each worked answer and reason, Portuguese `event_phase`'s second example, the English US spelling branches, and the three French Canada meal meanings where `déjeuner` or `dîner` changes by variety. A field-level scan found no empty, unusually shortened or plainly untranslated French teaching fields. The separate Levantine pass checked the spoken-form and b-prefix explanations and their practice answers against the English guide.

No concrete semantic omission or mistranslation requiring a prose edit was found. This independent comparison checks fidelity to the existing English guides; it does not validate every target-language construction with a native speaker or newly verify every source citation. The `needs_review` statuses therefore remain appropriate. The root integration pass owns final grid and application gates.
