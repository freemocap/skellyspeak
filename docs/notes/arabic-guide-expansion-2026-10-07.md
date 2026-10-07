# Arabic learner-guide teaching expansion

Implemented content revision, 2026-10-07. Independent linguistic and Cantonese
translation review remain pending; all provenance retains `needs_review`.
This follows the selected-variety decision in
[the teaching audit](skill-guide-teaching-audit-2026-10-07.md), not its superseded
comparative pilot.

## Coverage and teaching choices

All eight Arabic groups now have complete Modern Standard sections and complete
`variety_sections.arabic-levantine` replacements in both existing editions,
English and Cantonese: 42 subskills per edition, 84 selected lessons per edition.
The seven approved pilot subskills retain their teaching explanations; the other
35 have new contextual openings, worked-example unpacking, adaptable forms,
contrasts and short practice with explained answers. The lesson is specific to
the selected variety. Appendices no longer repeat the constructions already
taught in the sections; dispositions use `use_core`.

Modern Standard instruction explains person-marked verbs, feminine-address
commands and suffixes, noun/adjective relationships, dual endings and dependent
verbs in their actual examples. Levantine instruction explains its own spoken
forms, including wanting-plus-action, future-plus-action, possession, nominal
predicates and clock expressions. The progressive card teaches the existing
first-person b-prefixed example without asserting a universal prefix rule.
One brief Southern demonstrative note remains where it identifies the model
the learner is using. Contextual openings may coincide because the communicative
task is the same; worked constructions and practice are authored separately.

Exercises include full changes of addressee, speaker, object, preference,
comparison direction, time and event order. Comprehension exercises remain where
identifying a condition, contrast or evidence relationship serves the lesson.
There is no prescribed universal grammar template, assessment change or runtime
language branch. Inline code marks Arabic forms and real affixes only.

## Example preservation and corrections

All principal example strings retain their exact source text. A parsed comparison
against HEAD checked 84 edition/subskill pairs, including both selected varieties.
English and Cantonese preserve the same principal examples and section ordering.
No assessment IDs or content were edited.

Corrected an existing Modern Standard agreement note that incorrectly referred
to a Levantine masculine adjective: the Standard example uses a first-person
agreement verb, independent of speaker gender. Removed stale explanations that
paired both varieties inside a single selected lesson. Clarified that the
Levantine reason connector in the existing supporting-claims example introduces
the following we-clause; its final sound is not the person doing the measuring.

## Source review and limits

The prose and exercises are original AI-authored teaching content. Sources support
specific construction claims, not every original sentence or its naturalness.
The public articles were read as teaching sources, not empirical evidence for
one required presentation sequence.

| Bibliography key | Exact source and reviewed scope | Claim used |
| --- | --- | --- |
| [@levantongue_b_prefix2026] | [Lyn, TheLevanTongue: B-prefix verbs](https://thelevantongue.com/levantine-arabic/b-prefix-verbs-levantine-arabic-simplified/), full public lesson | Dependent actions after future/wanting/modals; imperative distinction; first-person progressive prefix variation. |
| [@talkInArabicFutureTeaching20261007] | [Asma Wahba, Talk In Arabic: Future tense](https://talkinarabic.com/levantine/grammar/future-tense/), public lesson only | The native-Jordanian contribution identifies the future marker; member audio transcript was not reviewed. |
| [@madinahVerbFormsTeaching20261007] | [Madinah Arabic, Lesson 28 part 2](https://madinaharabic.com/free-content/grammar/lesson-28/part-2), selected conjugation table | Present/past person forms and masculine/feminine singular imperative distinction. Not a universal formula for irregular verbs. |
| [@madinahDualTeaching20261007] | [Madinah Arabic, Lesson 18 part 2](https://madinaharabic.com/free-content/grammar/lesson-18/part-2), lesson body | Dual count and nominative versus accusative/genitive dual endings in Standard Arabic. |
| [@madinahDemonstrativesTeaching20261007] | [Madinah Arabic, Lesson 6 part 2](https://madinaharabic.com/free-content/grammar/lesson-6/part-2), lesson body | Singular feminine demonstrative and contrasting masculine referent. |
| [@madinahAdjectivesTeaching20261007] | [Madinah Arabic, Lesson 78 part 2](https://madinaharabic.com/free-content/grammar/lesson-78/part-2), lesson body | Attributive adjective agreement in gender, number, definiteness and case. |
| [@madinahNominalTeaching20261007] | [Madinah Arabic, Lesson 58 part 2](https://madinaharabic.com/free-content/grammar/lesson-58/part-2), lesson body | Noun subject and adjective predicate examples without a present copula. |
| [@madinahPossessiveTeaching20261007] | [Madinah Arabic, Lesson 5 part 2](https://madinaharabic.com/free-content/grammar/lesson-5/part-2), lesson body | Construct ordering and genitive after prepositions. Simplified blanket definiteness statements were not adopted. |
| [@madinahMoodsTeaching20261007] | Previously reviewed selected mood tables, as recorded in references.bib | Person-marked dependent forms after the Standard connector. Existing PDF review limits retained. |

These metadata were supplied to the coordinating agent for bibliography integration;
this content pass did not edit references.bib. Previously cited sources remain
recorded; provenance does not claim independent authorship or human review.

## Remaining review and verification boundaries

An independent reviewer should check regional consistency of the existing
Levantine examples, especially plural-prefix and vowel choices, the conditional
waiting command, and the reason connector before an explicit we-clause. These
are preserved draft examples, not certification that one form covers the entire
Levant. Cantonese explanations and added practice forms also need linguistic
review. No principal correction was made without sufficient evidence.

Local parsed example-preservation comparison and Arabic-only diff whitespace
check passed. No full checks were run concurrently with other agents. The
coordinating agent owns final content/configuration validation, the fast gate,
affected regressions, UI build and preview review. This note reports authored
content, not a verified running native application. No commit or deployment.
