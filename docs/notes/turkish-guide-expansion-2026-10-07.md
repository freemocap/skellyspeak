# Turkish skill-guide expansion — 2026-10-07

Status: implemented teaching-content revision, awaiting independent Turkish and Cantonese review. This note separates consulted grammar evidence from AI-authored guide examples, which remain `needs_review`.

## Source review and registration proposals

The existing [@tt_turkish_possession2026], [@tt_turkish_modality2026], [@tt_turkish_conditions2026], [@tt_turkish_optative2026] and [@tt_turkish_past2026] Turkish Textbook pages were opened directly on 2026-10-07. Relevant passages support possessive marking, modal meanings in context, conditional suffixes, first-person offers/proposals and direct-past suffix/person forms. These are construction claims, not certification of SkellySpeak's original examples. The additional original Turkish Textbook pages below were also opened and selected grammar passages read. Root registered the five proposed keys in `references.bib` before they were cited in guide YAML; their original proposals are retained below as review provenance.

```bibtex
@misc{tt_turkish_need2026,
  title = {Expressing need using gerek},
  author = {{Turkish Textbook}},
  url = {https://www.turkishtextbook.com/lesson/need-gerek/},
  review = {full-text},
  claim = {Selected verb-nominalization passages show an action noun with a possessive ending plus gerekiyor for a person's need, and distinguish gerek yok as no need rather than prohibition. This does not certify original SkellySpeak sentences.}
}

@misc{tt_turkish_locative2026,
  title = {Locative case: at, in, and on},
  author = {{Turkish Textbook}},
  url = {https://www.turkishtextbook.com/lesson/at-in-and-on-da-de/},
  review = {full-text},
  claim = {Selected locative-case passages describe -da/-de/-ta/-te variants, including consonant assimilation after voiceless consonants, for location expressions. This does not certify original SkellySpeak examples.}
}

@misc{tt_turkish_ablative2026,
  title = {Ablative case: from in Turkish},
  author = {{Turkish Textbook}},
  url = {https://www.turkishtextbook.com/lesson/ablative-case-from-in-turkish-dan-den-tan-ten/},
  review = {full-text},
  claim = {Selected comparison passage illustrates an ablative standard with daha and a descriptive adjective. This does not certify original SkellySpeak examples.}
}

@misc{tt_turkish_questions2026,
  title = {Yes or no questions},
  author = {{Turkish Textbook}},
  url = {https://www.turkishtextbook.com/yes-or-no-questions/},
  review = {full-text},
  claim = {Selected passages describe the separate vowel-harmonized mı/mi/mu/mü question particle in yes-no questions. They do not claim every content question needs that particle or certify original SkellySpeak examples.}
}

@misc{tt_turkish_progressive2026,
  title = {Continuous present tense},
  author = {{Turkish Textbook}},
  url = {https://www.turkishtextbook.com/continuous-present-tense/},
  review = {full-text},
  claim = {Selected -ıyor/-iyor/-uyor/-üyor passages illustrate ongoing events and person-marked forms. The construction does not itself fix present time without context, and this source does not certify original SkellySpeak examples.}
}
```

## Coverage and assessment alignment

Expanded the existing eight Turkish skill groups and 42 subskills in both English and Cantonese explanation guides. Each `section.explanation` now begins with a plausible situation and unpacks the preserved principal target example’s words, endings, order or discourse function. Each `examples.note` supplies a transfer task, a whole Turkish answer and a reason. The 42 principal target texts, subskill IDs, one-example structure and `turkish-turkiye` variety disposition were preserved. Meanings, assessment guidance, shared/runtime data and original provenance `needs_review` status were not edited.

All eight assessment guidance files were read before editing. The guides retain their distinctions between request and ability inquiry, offer and commitment, understanding and agreement, permission and ability, obligation and no need, sequence and cause, and direct past, current-progressive and future readings. The existing assessment treats a lit window as supporting a cautious occupancy inference; the guide now explicitly places that cue at night and keeps `Sanırım` tentative. No assessment contradiction requiring an edit was found. The transfer examples and Cantonese prose are AI-authored and need independent review; the consulted grammar pages support constructions, not the naturalness of each new sentence.

## Verification

Local Node YAML parsing passed for all 16 edited guides. A direct `git show HEAD` comparison verified all 42 IDs, 42 principal Turkish examples in each explanation language, example counts and variety keys/dispositions. English and Cantonese principal examples and all 42 worked practice answers match. Every section contains a context-bearing explanation and a practice note with a whole answer and reason. Scans found paired backticks, no Markdown heading/blockquote in prose, and no duplicated Cantonese question/full-stop punctuation. A focused semantic pass corrected a potential awkward snow-starting practice example to a storm-starting example. No temporary authoring script remains. Root integration owns the final repository-wide fast gate.

Integration review then corrected five teaching details without changing principal target text: the refusal practice now has a new invitation for its changed day; rephrasing establishes the advance-booking requirement before restating it; the preference explanation locates the alternative by dative marking rather than a false word-position claim; the ability explanation separates the bicycle object from the `tamir etmek` repair verb; and the future explanation identifies the first-person form directly. These were applied in both editions where relevant. The local bilingual and preservation checks were rerun after this pass.

All 16 teaching guides now carry current document and provenance review revisions: `turkish-teaching-expanded-2026-10-07` for English and Cantonese. The eight assessment files retain their original revisions because their content was not changed. `needs_review` remains in every guide.
