# Indonesian skill-guide expansion — implementation and verification note

Status: implemented content edit, pending independent Indonesian and Cantonese review.

## Scope

Expanded both English and Cantonese explanation guides for all eight Indonesian skill groups and all 42 subskills. The selected `indonesian-indonesia` variety now has a context, a form-focused explanation of each retained target example, and a practice prompt with a complete answer and reason. The principal `examples[].text` values, section IDs, group IDs, shared paths, variety dispositions and all eight assessment files were preserved. No runtime or shared-language content was edited.

Each `section.explanation` is a declarative teaching point for the AI partner. The worked reading of the example is in `examples[].meaning`; practice and contrast appear in `examples[].note`. These are original AI-authored lessons and practice answers, all marked `needs_review`.

## Primary sources actually consulted

- [@niu_indonesian_phrases2026] Northern Illinois University, *Indonesian Sentence and Phrase Patterns*, directly read for noun/adjective/locative predicates, phrase order, number phrases, clock times and duration. Its introductory wording was treated as a description of its examples, not a universal ban on every alternative register.
- [@niu_indonesian_questions2026] Northern Illinois University, *Forming and Answering Questions*, directly read for optional yes/no markers, confirmation questions, question types and relevant answers.
- [@niu_indonesian_verbs2026] Northern Illinois University, *Active, Passive and Imperative Verbs*, directly read for active and imperative patterns and the distinction between voice marking and time. Its explicit introductory limits on `di-` were not generalized into a rule for every Indonesian construction.
- [@niu_indonesian_pronouns2026] Northern Illinois University, [*Pronoun Summary*](https://seasite.niu.edu/Indonesian/new_indonesian/indonesian1/pronouns.pdf), directly read for inclusive `kita`, exclusive `kami`, and third-person `-nya`. The integration owner registered this key, and guides that explicitly teach those pronouns now cite it.

Bibliography entry registered by the integration owner:

```bibtex
@misc{niu_indonesian_pronouns2026,
  title = {FLIN 103: Pronoun Summary},
  author = {{Northern Illinois University, SEAsite}},
  url = {https://seasite.niu.edu/Indonesian/new_indonesian/indonesian1/pronouns.pdf},
  review = {full-text},
  claim = {The one-page handout distinguishes inclusive kita from exclusive kami and lists singular personal and possessive pronouns. It supports participant-reference contrasts, not the correctness of original SkellySpeak examples or Cantonese translations.},
  note = {Read directly 2026-10-07 for the Indonesian skill-guide expansion; original examples and practice remain AI-authored and needs_review.}
}
```

The official Indonesian grammar, *Tata Bahasa Baku Bahasa Indonesia* (fourth edition), was located on the education ministry's repository, but its 35 MB PDF timed out on direct opening. It was not used as a cited source.

## Assessment alignment and review limits

All eight assessment guidance files were read and left unchanged. The guides preserve their distinctions between information questions and action requests, acknowledging understanding and agreeing, `harus` versus `boleh`, ability versus opportunity, `tidak harus` versus `tidak boleh`, inclusive `kita` versus exclusive `kami`, and temporal meaning without an English tense inflection. I found no contradiction requiring an assessment edit. Source handouts support these constructions but do not certify the newly authored examples, practice answers, colloquial fit, or Cantonese register.

## Verification

Node's YAML parser read all 16 edited guides and eight unchanged assessments. A direct `git show HEAD` comparison confirmed every original principal target sentence, subskill ID and section count. English and Cantonese sections have identical IDs and target examples. All 84 guide sections have an explanation, worked meaning and practice note with an explicit answer. A scan found no unbalanced backticks, Markdown headings/blockquotes in these prose fields, or duplicated question-mark/full-stop punctuation. These checks establish structural preservation, not linguistic correctness. The repository-wide fast gate belongs to the integration owner after the parallel language edits settle.

Independent cross-review sharpened two declarative English explanation openings, made the paint-preparation practice order coherent in both editions, removed a doubled Cantonese full stop, and aligned the Cantonese gloss of `senang` with the English happiness reading. The original principal target texts and assessments remain unchanged. Final local YAML, 42-pair ID/target/HEAD preservation, prose-format and `git diff --check` checks passed after these corrections.
