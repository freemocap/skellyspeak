# Seven-language authored skill-guide grid

Status: all 49 pairs authored; new editions independently cross-reviewed by AI
agents; integration verification passed. This extends the earlier
English/Cantonese rollout; completion of that rollout did not mean every target
had every explanation language.

## Agreed scope

English, Spanish, French, Arabic, Mandarin, Cantonese and Portuguese are both
target and explanation languages: 49 pairs, each with eight groups and 42 core
subskills, including all declared variety replacements. Runtime AI translations
do not count as authored coverage. Existing English and Cantonese editions and
Spanish explained in Spanish supply 15 pairs. This change adds 34 pairs (272
target guides) and 32 shared explanation files.

Three workers author French, Arabic and Mandarin columns. Portuguese and Spanish
columns follow in the queue; Portuguese is divided into disjoint target batches
between the French and Arabic workers. The integration agent authors shared
Portuguese headings, Portuguese explained in Spanish and Portuguese, and Mandarin
explained in Spanish. All work stays in the shared
checkout. Assessment definitions and evaluator instructions are outside this
localization scope. No commit or release is authorized.

## Content requirements

- Translate the complete teaching explanation, example meaning and worked note,
  including every example in sections with multiple examples.
- Preserve principal example text, inline target fragments, identifiers, ordering,
  source references and variety applicability.
- Keep ordinary explanatory prose distinct from marked target text, including
  same-language editions. Describe the selected variety directly.
- Keep AI provenance and `needs_review`; structural checks and editorial review
  do not certify native-speaker correctness.

## Integration implementation

The native grid regression test requires all 392 target-guide files to resolve
through the normal authored-edition path and render every selected variety. The
initial run failed as intended at English explained in Spanish, confirming that
missing authored coverage is detected rather than supplied by a fallback.

`seven-language-grid-audit.ts` compares new editions against their English sources:
all sections/examples, principal text, exact marked-fragment multisets, variety
branches and review revisions. Its default mode requires the full grid;
`--partial` reports progress while still checking present files. It caught an
untranslated second example in Portuguese explained in Mandarin; that was fixed.

GuideDocument now sets explanatory text language and direction from declared
language metadata, independently of the target reading scope. Existing isolated
inline target fragments and passage reading helpers retain their target behavior.
The three affected UI test files passed (14 tests), including both directions of
Arabic/English mixing. The fast gate passed after formatting the new native test.
The initial application build encountered an unrelated concurrently edited
TopBar test type error; a subsequent production build passed.

Tests that assumed missing English/Spanish or Spanish/Arabic editions are updated
for the new coverage. English with Spanish interface/explanations must now load
authored content with inference paused and record no guide-translation execution.
The cache/retry inference tests use Spanish explained in German, outside this
grid, and assert that the test pair is unfilled before starting their mock server.
Inspector assertions now expect all seven editions. No production inference or
assessment behavior is changed by these test updates. The UI direction test also
covers generated translations whose action references still identify the English
source: displayed language comes from the explanation scope, not that reference.
The updated UI suite passes 15 tests. A later production UI build passes, as do
Clippy (`--lib --tests -- -D warnings`) and the fast gate on that checkpoint.
One native test rerun encountered a Windows linker lock on the shared test binary;
the subsequent application regression run passed. Earlier transient missing-module
and UI contract errors arose during concurrent unrelated work in the checkout.

## Integration-authored content and source checks

Eight shared Portuguese files now translate all 42 shared concept headings and
descriptions. Eight Portuguese target guides explained in Spanish translate all
42 core sections and 43 examples. Exact fragment preservation and the current
partial-grid checks pass. Temporary authoring scripts were removed.

Portuguese explained in Portuguese is also authored: eight groups, 42 sections,
43 examples. Same-language meanings use plain paraphrases, while only preserved
marked target fragments are interactive. This batch passes the exact-fragment,
principal-text, variety and provenance audit. Independent review by the
Portuguese-column author is complete.

Mandarin explained in Spanish is authored in eight groups and 42 sections. All
worked meanings, practice answers, tone readings and grammatical qualifications
are translated; marked target fragments remain exact. The partial-grid audit
passes this batch. Independent review by the Spanish-column author is complete.

For this Mandarin localization, selected passages in Oxford's
[Elementary Chinese Grammar](https://www.ctcfl.ox.ac.uk/media/pages/pdf/lang-work_grammar-database_grammar-database-for-hard-copy.pdf)
were reread: possessive/relational `的` (pp. 8–9), modal `会` (p. 35), potential
`不了` with the `liǎo` reading (p. 80), and paired conjunctions (pp. 96–99)
[@oxford_mandarin_grammar2026]. This is a targeted cross-check, not a fresh read
of the whole 125-page grammar. Its absolute statement that a contrasting second
clause must always include a conjunction was not adopted; the guide teaches the
paired construction without claiming that alternatives are impossible.

For the Spanish localization, grammar notes in the University of Texas materials
were reread: [gostar and gustar](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_01.pdf)
supports experiencer agreement and the expressed complement introduced by `de`
[@ut_pt_gostar2026]; [future subjunctive](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_04.pdf)
supports projected conditions and the `tivermos` form [@ut_pt_future_subj2026].
These entries already exist in references.bib and remain attached to the relevant
guides. Historical cultural claims and absolute generalizations in those lessons
were not adopted. A direct Wisconsin lesson URL was inaccessible; this pass does
not claim a fresh read of that lesson. Original source lineage is preserved.

## Independent editorial review checkpoints

The integration agent read all six worker-authored Portuguese target editions
(252 core sections plus 70 variety replacements), including every worked example
and practice note. Corrections clarified Spanish location and auxiliary glosses,
removed an inaccurate claim that a Portuguese paraphrase begins with “eu”, improved
awkward turn-taking/declining prose, and removed a mixed-script typo in “Inverta”.
A different worker read the eight shared Portuguese files and the Portuguese
self-edition in full; its short-answer paraphrase was refined to “Abre às oito.”

The Spanish-column worker independently read the integration-authored Portuguese
and Mandarin targets explained in Spanish (84 sections), correcting the imperative
“propón”. The integration agent read the English and French targets explained in
Spanish in full, including US and Canada replacements. Corrections distinguish a
door being locked from having a key, keep the colleague's gender consistent, and
express a desire to rest without introducing an unsupported preference comparison.

The Arabic-column worker independently reviewed all Mandarin explanations and
corrected sibling glosses that had added an older-sibling distinction absent from
the Spanish/Portuguese source. Review scope and other column findings are recorded
in the adjacent language-specific grid notes. These are AI editorial checks;
`needs_review` remains and no native-speaker certification is claimed.

The integration agent also read all Arabic and Cantonese targets explained in
Spanish, including all 42 Levantine replacements. Final Cantonese refinements
clarified a context-dependent gloss, preserved the quiet/very quiet distinction,
and corrected another imperative “propón”. This completes independent review of
all newly authored Spanish and Portuguese pairs. A second worker reviewed the
French column without finding a concrete correction. Arabic-column corrections
are listed in [the Arabic review](seven-language-grid-arabic-review-2026-10-07.md).
Existing English/Cantonese editions and Spanish self-explanations were structurally
audited but were not reauthored or wholly re-reviewed in this localization pass.

The three native skill-guide application tests pass: authored English/Spanish
loading while inference is paused, shared translation caching across restart,
and invalid-translation diagnostics with explicit retry. The initial overly narrow
test filter matched no tests; the corrected `skill_guides` filter ran all three.

## Coverage checkpoint

The strict grid audit passes: 392 guide files, 2,548 section bodies, zero missing.
Each of the seven targets has all seven explanation languages, with eight groups
and 42 core subskills per pair. Counts include 490 replacement-section bodies
(70 per explanation language) in addition to 2,058 core bodies. The grid is authored
on disk; runtime translation is not used to fill these cells.

## Final verification

- Strict grid audit: 392 guide files, 2,548 section bodies, zero missing cells.
- Audit tool strict TypeScript check: passed.
- Affected UI regression tests: three files, 15 tests passed, including mixed
  Arabic/English direction and generated-translation source references.
- Production UI build: passed; existing bundle-size advisory remains.
- Fast gate: passed after the final content edits and inspector-test correction.
- Clippy (`--lib --tests -- -D warnings`): passed on the final native changes.
- Documentation links: passed for all nine current entry points.
- Content audit: passed, with 616 target guides, 56 shared explanations and
  168 unchanged assessments. No required source files are missing. The 224
  optional bundled-target gaps reported repository-wide are outside this grid.
- Language validation: interface/catalog validation and native `inspect-content
  --check` passed for all 21 languages. Configuration tests are included in the
  full native suite.
- Offline preview export: refreshed all seven targets, including the final Arabic
  editorial corrections. The fixture has 840 distinct renderings overall, of
  which 616 cover this grid with every declared variety; all 49 pairs have eight
  groups. The temporary refresh script was removed.

The first full native run had 843 passes, 14 failures and six ignored tests.
One assertion incorrectly expected French explanations to be absent; it now uses
German, outside this authored grid. A bundled/disk content hash comparison ran
while the last editorial changes were still being written; source content is now
stable. Twelve speech tests timed out waiting for their local mock servers during
the heavily parallel run. All 50 recording tests subsequently passed with two
test threads, without changing their deadlines or production behavior. The full
suite rerun (`cargo test --manifest-path native/Cargo.toml --lib --
--test-threads=4`) passed: 857 tests, zero failures, six intentionally ignored,
707.33 seconds. This includes all configuration, grid, authored loading,
translation-cache and assessment-isolation regressions. No new paid inference
test or native-speaker review was performed for this localization pass.

No fresh visual browser inspection is claimed. All work remains uncommitted.
