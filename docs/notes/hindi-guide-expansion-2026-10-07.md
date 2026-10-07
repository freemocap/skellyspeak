# Hindi skill guide expansion — implementation and verification note

Status: implemented content edit, pending independent Hindi and Cantonese review.

## Scope

Expanded the English and Cantonese explanation guides for all eight Hindi skill groups, covering 42 subskills in each explanation language. Every section now begins with a conversational need, explains the particular Hindi words or construction in the retained example, and gives a short practice prompt with its full answer and reason. The principal Hindi `examples[].text` values, subskill IDs, group IDs, selected `hindi-india` applicability, and all eight assessment guidance files were retained. No runtime or shared guide was changed.

Each section's `explanation` states a reusable point for the AI partner. Worked reading of the example is in `examples[].meaning`; the practice and contrast are in `examples[].note`. These are AI-authored teaching examples and explanations, not certified linguistic data. Both guide languages remain `needs_review`.

## Primary sources actually consulted

- [@snell_hindi_skeleton2026] Rupert Snell, *Hindi Skeleton Grammar*, University of Texas Hindi Urdu Flagship PDF. Read the source's sections on questions and answers (1.2, 2.1), adjective agreement and politeness (1.4, 2.3–2.4), postpositions and oblique nouns (3.1–3.2), future and presumptive use (9.1–9.3), subjunctive and wanting (10.1–10.4), perfective and `ने` (11.2–11.3), and infinitive obligation (13.3). The source supports the grammatical contrasts used here; it does not validate original situational examples or the Cantonese translations. Existing bibliography entry has `url`, `review = full-text`, and a scoped `claim`, so no new entry was added.
- [@msu_hindi_tense_aspect2026] Directly read Michigan State University's *Basic Hindi* chapter 7.6, [Tense and Aspect](https://openbooks.lib.msu.edu/basichindi/chapter/chapter-7_grammar-tense-and-aspect/), for progressive, habitual, perfective and future contrasts. The integration owner registered the bibliography entry, and the two Hindi time-and-events guides now cite it. Chapter 8.6 appeared in search results but returned a 403 on direct opening, so it was not cited in the revised guides.

Bibliography entry registered by the integration owner:

```bibtex
@misc{msu_hindi_tense_aspect2026,
  title = {Basic Hindi: 7.6 Grammar: Tense and Aspect},
  author = {{Rajiv Ranjan, Michigan State University}},
  url = {https://openbooks.lib.msu.edu/basichindi/chapter/chapter-7_grammar-tense-and-aspect/},
  review = {full-text},
  claim = {The chapter contrasts Hindi habitual, progressive and perfective aspect and gives present, past and future examples. It supports those form distinctions, not the correctness of original SkellySpeak example sentences or Cantonese translations.},
  note = {Read directly 2026-10-07 for the Hindi teaching expansion; original examples remain AI-authored and needs_review.}
}
```

## Editorial boundaries and questions

The eight assessments were read for semantic alignment and not edited. The guides keep their central distinctions: confirmation versus an unknown-time question, understanding versus agreement, an offer versus a request, a future commitment in planning versus mere prediction, conditional perfective versus a past assertion, and a reason versus evidence for a claim. I found no contradiction requiring an assessment edit. The assessment discussion of other forms remains broader than a single teaching example.

Practice answers are original AI-authored Hindi; in particular, modal/subjunctive, compound-verb, and register examples warrant human linguistic review before being treated as authoritative. Cantonese translation and register likewise need native review. The examples are intentionally framed for the selected `hindi-india` variety without claims about alternative varieties.

A later read-only cross-review found three exercises that needed sharper context. The time-sequence practice now washes lentils before adding water, preserving a useful cooking order. The rephrasing practice now explicitly says that the earlier permission ended at five before it paraphrases that time. The supporting-claim practice now uses a visible door lock as evidence of closure instead of an unlit interior, which would be weak evidence in daylight. Five Cantonese meanings had an extra full stop after a question mark; those punctuation errors were removed. Principal examples remained unchanged.

## Verification

Node's YAML parser read all 16 edited guides and all eight unchanged assessment files. A direct `git show HEAD` comparison confirmed every original `examples[].text`, subskill ID and section count. English and Cantonese sections have identical IDs and principal examples. All 84 guide sections contain an explanation, worked meaning and practice note with an explicit answer. A scan found no unbalanced backticks or Markdown headings/blockquotes in those prose fields. These checks establish structural preservation, not linguistic correctness. The repository-wide fast gate is being run by the integration owner after the parallel language edits settle.
