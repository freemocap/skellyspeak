# Malayalam English and Cantonese teaching expansion — 2026-10-07

Implemented English and Cantonese teaching revisions across eight existing guides per edition and all 42 paired subskills. Original examples and new practice remain `needs_review`; root owns integrated repository checks.

## Proposed bibliography additions

The sandhi page and selected textbook grammar passages have been read; precise scope is recorded below. Original lesson prose and practice remain AI-authored and needs_review; source consultation does not certify them. No source prose or original source examples are copied into the guides.

```bibtex
@misc{utMalayalamSandhiTeaching20261007,
  author = {Donald R. Davis, Jr.},
  title = {Malayalam Sandhi},
  publisher = {University of Texas at Austin},
  url = {https://malayalam.la.utexas.edu/resources/malayalam-sandhi/},
  review = {full-text},
  claim = {Consulted for vowel loss, glide insertion, consonant doubling and changes before case endings when explaining the joined forms in original learner examples. The page's simplified rules are not treated as exhaustive.},
  note = {Read 2026-10-07. Original app examples and English teaching remain AI-authored and needs_review.}
}
@book{moagMalayalamTeaching20261007,
  author = {Rodney F. Moag},
  title = {Malayalam: A University Course and Reference Grammar},
  edition = {4},
  year = {2002},
  publisher = {Center for Asian Studies, University of Texas at Austin},
  url = {https://utw11087.utweb.utexas.edu/wp-content/uploads/sites/2/2021/06/Moag-Malayalam-CompleteTextbook.pdf},
  review = {full-text},
  claim = {Selected grammar explanations consulted for modal and hortative forms, infinitives, compounds, negation, conditional forms and comparison; review is of those passages rather than the whole book. Original app lessons are not copied textbook material.},
  note = {Selected passages read 2026-10-07; page scope recorded in docs/notes/malayalam-guide-expansion-2026-10-07.md. Original examples and prose remain AI-authored and needs_review.}
}
```

Existing Nizar and UT Time sources have been reread. The existing UT Dialogues URL timed out repeatedly; retained prior citations will not be described as freshly reviewed.

## English edition checkpoint: implemented coverage and source scope

Completed all42 subskills in the eight existing Malayalam English guides: possibilities_constraints5; information_exchange4; people_places5; feelings_viewpoints5; coordinating_action6; managing_conversation6; reasons_connections5; time_events6. Each has contextual declarative explanation, actual target-form analysis, a useful distinction, and practice with an explained answer. At this English-only checkpoint, Cantonese editions, definitions, assessments and runtime were outside the change. All principal texts and IDs were preserved. The two proposed keys above were registered by root before use.

Moag passages actually read: printed78–79 (§6.3 intentive/potential),101 (§7.7 hortative),135 (§9.1 nominal predicates),161–164 (§11.1 past forms,§11.2 cleft focus,§11.3 compound preview),250–252 (§17.4 commands,§17.5 emphatic present),278 (§19.2 negative commands),280 (§19.4 repeated activity),328–331 (§21.5 experiencers,§21.6 progressive,§21.7 compounds/benefactive),362–363 (§23.2 conditionals),381–382 (§24.2 comparison),389–391 (§24.6 capability). First-person and inclusive/exclusive distinctions were also checked against the textbook pronoun discussion; the original lexical items are retained rather than treated as newly certified textbook examples.

The source supports grammatical construction families, not a claim that each app sentence appears in it. Capability and permission use scoped modal readings; no universal case-to-meaning rule is taught. Comparison uses an accusative standard before the comparison particle. Compounds distinguish the main activity from a following modifier; progressive and completed readings are distinguished. Open conditionals can use a past-based conditional form for future situations. Repeated activity is distinguished from one ongoing occurrence. UT Time supports time words and contextual future/habitual readings. Sandhi supports the joins explained in noun case and predicate forms. Nizar supports scoped dative experiencer/possessor analyses rather than all emotions taking the same case.

The existing UT Dialogues source repeatedly timed out and was not freshly read; it is no longer cited in these rewritten English files. PDF Malayalam glyph extraction uses a legacy font and is unreliable; English grammatical commentary was read, but garbled extracted glyphs were not used to manufacture spelling claims. Original and adapted Malayalam remains AI-authored and needs_review, with native-speaker review still needed for conversational idiom and register.

## Assessment alignment and verification

Read all eight current Malayalam assessments. No concrete contradiction between their communicative criteria and the revised lessons was found; guide examples and practice are teaching context, not additional assessment evidence. All eight edited files parse locally. All42 subskill IDs, order and principal example text lists match HEAD. Practices contain explicit answers; inline backticks are balanced and no extra heading/block-quote boundaries are introduced. Root owns integrated final gates and independent linguistic cross-review.

Two cautious revisions arose during review: negative necessity form can mean need not or function as a don't instruction, so the obligation note explicitly makes its interpretation context-sensitive; the certainty practice no longer extrapolates a present result-state question to tomorrow. Practice chiefly changes directly supported time/place/object material or asks learners to identify the meaning of retained forms. No principal example correction was made.

## Cantonese edition expansion — separate pass, 2026-10-07

Status: implemented Cantonese teaching-content revision across the eight existing editions and all 42 paired subskills; independent Malayalam and Cantonese review is now complete, with remaining native-speaker review noted below. The current English guides, their working-tree diffs, all eight assessments and the source scope above were read before editing. No concrete error in an English principal target sentence was demonstrated, so all original target texts and IDs remain unchanged. Cantonese `section.explanation` now starts with a plausible exchange and explains the particular Malayalam words, endings, order or discourse function. `examples.meaning` works through the preserved sentence, and `examples.note` supplies the English guide's transfer task or semantic check with its full answer and reason. For the English guides whose exercise is a meaning-choice question rather than a new Malayalam sentence, the Cantonese edition keeps that exercise type and explains the answer.

For this pass I directly read the [University of Texas Malayalam Sandhi page](https://malayalam.la.utexas.edu/resources/malayalam-sandhi/) for joined written forms, its [Time in Malayalam page](https://malayalam.la.utexas.edu/resources/time-in-malayalam/) for time expressions and at-hour marking, and selected Malayalam sections of [Nizar's primary thesis](https://linguistics.berkeley.edu/~mikkelsen/nizar_thesis.pdf) for dative experiencer, possession and modal frames. These are construction-level checks, not attestation of the app's original or practice sentences. The Moag grammar URL linked above was opened but the web reader rejected its 38 MB download; the preceding English-author pass documents selected passages that author actually read. This Cantonese pass relies on that recorded scope but does not claim a fresh direct reading of the PDF. The existing UT Dialogues source was likewise not freshly readable, so the Cantonese source lists now mirror the revised English guide lists and omit that key. No new bibliography entry was needed.

Local Node YAML parsing passed for all eight Cantonese files. Comparison with `HEAD` and the English editions verified 42 subskill IDs, principal Malayalam texts and original example counts; the `malayalam-kerala` variety key and disposition were preserved. Source-key lists now match the English editions. All 42 Cantonese practice notes have an explicit answer, and target-form answers match the English notes where those notes supply a target form. Backticks are paired, ordinary Cantonese prose is unquoted, and no Markdown heading/blockquote or doubled Cantonese question/full-stop punctuation appears inside the prose fields. No source-independent native idiom or Cantonese register certification is claimed. The root integration owner runs the final repository-wide gates.

## Independent cross-review closure

A read-only reviewer compared all 42 Cantonese/English pairs with eight assessments and directly reopened the UT Sandhi and Time pages and Nizar dative sections. One concrete Cantonese context mismatch was corrected: the bag is now near the companion and needs lifting, so the offer `ഞാൻ ബാഗ് എടുത്തുതരട്ടെ?` matches the scene. No principal target text or assessment guidance changed. The reviewer found no other demonstrated bilingual meaning, grammar or practice-answer contradiction. This is a scoped construction and editorial review, not native-speaker certification; the Moag PDF was not freshly reread in that reviewer pass.

The English guide revision is `malayalam-skills-2026-10-04`; all eight Cantonese guides now use `malayalam-cantonese-teaching-expanded-2026-10-07` at document and provenance review levels.
