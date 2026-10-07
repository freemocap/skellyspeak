# Thai skill-guide expansion — 2026-10-07

Status: implementation complete; independent bilingual review corrections applied. This note distinguishes source review from AI-authored guidance and records verification and unresolved questions.

## Source review

Directly read the existing cited NIU Hartmann *Beginning Thai Grammar Notes* on `ไหม`, `ใช่ไหม`, content questions and clock time; the Thai Notes digital FSI Lesson 9 grammar on time words, `กำลัง`, `จะ`, and past reference without conjugation; and NIU's supplementary `ให้` exercise on giving, causing/allowing, and doing something for another person. These support the existing keys `hartmann_thai_questions2026`, `fsi_thai_time2026`, and `niu_thai_hai2026` only within those sections. The examples in the guides remain AI-authored and `needs_review`.

Also directly read NIU Maanii Lesson 30 structure on `อยาก` before a following predicate; NIU Maanii Lesson 11 structure on noun–number–classifier order and `ตัว` with chairs; and NIU *Spoken Thai* Unit 14 word study contrasting skill `เป็น`, general `ได้`, and physical capacity `ไหว`, plus evening clock time. NIU *Spoken Thai* Unit 17 word study points 5–6 were also directly read: they contrast reading to an endpoint with `จบ` against finishing an activity with `เสร็จ`. The root agent registered all four keys below before their use in YAML.

```bibtex
@misc{niu_thai_desire2026,
  title = {Maanii Book II Lesson 30: Structure, อยาก},
  author = {{Northern Illinois University SEAsite; Jenjit}},
  url = {https://seasite.niu.edu/Thai/maanii2/lesson30/structure.htm},
  review = {full-text},
  claim = {อยาก expresses wanting and can be followed directly by another predicate, without an English-style infinitive marker; relevant section consulted.},
  note = {Relevant section consulted 2026-10-07. Thai guide examples remain AI-authored and needs_review.}
}

@misc{niu_thai_classifiers2026,
  title = {Maanii Book I Lesson 11: Classifier ตัว},
  author = {{Northern Illinois University SEAsite}},
  url = {https://seasite.niu.edu/thai/maanii1/lesson11/structure.htm},
  review = {full-text},
  claim = {The lesson shows noun–number–classifier order and ตัว as a classifier for chairs and other legged furniture; relevant section consulted.},
  note = {Relevant section consulted 2026-10-07. Thai guide examples remain AI-authored and needs_review.}
}

@misc{niu_thai_skill2026,
  title = {Spoken Thai Unit 14: Word Study, ได้ ไหว เป็น},
  author = {{Northern Illinois University SEAsite}},
  url = {https://seasite.niu.edu/thai/spokenthai/unit14/wordstudy/Default.htm},
  review = {full-text},
  claim = {Postverbal เป็น expresses knowing how to perform a learned skill, contrasted with general ได้ and capacity ไหว; relevant Word Study point 4 consulted. The same page gives evening time after the hour in point 8.},
  note = {Relevant sections consulted 2026-10-07. Thai guide examples remain AI-authored and needs_review.}
}

@misc{niu_thai_completion2026,
  title = {Spoken Thai Unit 17: Word Study, จบ and เสร็จ},
  author = {{Northern Illinois University SEAsite}},
  url = {https://seasite.niu.edu/Thai/spokenthai/unit17/wordstudy/Default.htm},
  review = {full-text},
  claim = {จบ follows the activity and marks reaching its end, including reading a book through; points 5–6 contrast this with เสร็จ, while แล้ว can present the achieved state.},
  note = {Relevant Word Study points 5–6 consulted 2026-10-07. Thai guide examples remain AI-authored and needs_review.}
}
```

## Scope

The planned edit covers the sixteen existing English/Cantonese explanation YAML files, eight groups and 42 subskills. Principal Thai example text, subskill IDs, sole declared `thai-thailand` variety, all eight assessments, shared definitions, and runtime code remain unchanged. Explanations provide declarative context and form teaching; transfer practice with an answer and reason belongs in example notes. All guides retain `needs_review` pending independent linguistic review.

Local verification: all sixteen YAML files parse; the eight groups and 42 subskill IDs match `HEAD`; principal Thai example text and the sole declared variety match `HEAD`; English/Cantonese principal texts and section order match; target fragments have paired backticks and no Thai target form appears bare in explanatory prose; no headings, blockquotes or additional examples are embedded in prose; every cited key exists in `references.bib`; `git diff --check` passes. The eight assessment files were read for contradictions and remain unchanged. The root agent ran an intermediate production build, twelve focused guide UI tests and the fast gate; final global checks remain with the root.

No demonstrated error in a principal Thai target sentence was found during this pass or independent review, so none was changed. New transfer exercises retain the original communicative function and include the complete answer and reason in both editions. The doorway request now explicitly brings a box toward the door for loading; advance-booking rephrasing begins from an explicitly stated booking policy; date changes in invitations establish the new invitation day. The light-in-window example is a cautious inference, with audible voices used as a stronger transfer clue. Independent review also corrected the English permission context from asking *where* to asking *whether* the bag may be left here, and the Cantonese gloss of `เก้าอี้พับ` from folding stool to folding chair; principal Thai text stayed intact.

Native-speaker review remains useful for the idiom and register of both principal and newly authored transfer sentences, especially the courtyard-side entrance wording. The source review establishes only the construction claims above; it does not certify the complete guide text. All document and variety provenance remains `needs_review`.
