# Ukrainian skill-guide teaching expansion — 2026-10-07

Status: all 16 existing English and Cantonese guides revised; independent Ukrainian and Cantonese review remains pending.

## Proposed bibliography entries for root integration

The following original teaching pages were opened and their stated passages read on 2026-10-07. The root integrator registered these keys in `references.bib` before their use in YAML.

```bibtex
@misc{jenkala_ukrainian_cases2026,
  title = {Read Ukrainian: How cases work},
  author = {Marta Jenkala},
  url = {https://www.ukrainianlanguage.org.uk/read/unit06/page6-2.htm},
  review = {full-text},
  claim = {The lesson's feminine-noun paradigm contrasts nominative, genitive, dative, accusative, instrumental, locative and vocative forms and gives example functions. It supports explanation of case distinctions, not automatic validation of every authored form.},
  note = {Relevant original lesson passage read 2026-10-07; new practice and translations remain AI-authored and needs_review.}
}

@misc{jenkala_ukrainian_aspect_summary2026,
  title = {Read Ukrainian: Aspects in summary},
  author = {Marta Jenkala},
  url = {https://www.ukrainianlanguage.org.uk/read/unit11/page11-7.htm},
  review = {full-text},
  claim = {The summary distinguishes imperfective process, duration and repetition from perfective bounded or completed actions and sequence points; it expressly presents these as a starting account rather than exhaustive rules.},
  note = {Summary passage read 2026-10-07; newly authored examples and Cantonese renderings still need independent review.}
}

@misc{jenkala_ukrainian_word_order2026,
  title = {Read Ukrainian: Word order},
  author = {Marta Jenkala},
  url = {https://www.ukrainianlanguage.org.uk/read/unit20/page20-5.htm},
  review = {full-text},
  claim = {The lesson describes a neutral order broadly similar to English while showing that case endings allow word-order variation with differences of emphasis; flexibility does not make order semantically irrelevant.},
  note = {Relevant original lesson passage read 2026-10-07; not a blanket claim that all permutations are equally natural.}
}
```

Existing entries [@ukma_ukrainian_tenses2026], [@jenkala_ukrainian_infinitives2026], [@jenkala_ukrainian_conditions2026] and [@ukma_ukrainian_terms2026] were reopened and read for their scoped claims, including present/imperfective and future/perfective contrasts, past gender/number agreement, infinitival modal frames, and real versus hypothetical conditions. Their pages do not certify the authored guide examples.

## Implemented content and assessment alignment

All eight groups now have contextual teaching for all 42 subskills in English and Cantonese. Each `section.explanation` gives the scene and the relevant Ukrainian form, including case, agreement, aspect, clock-time ordinals or register where the chosen example calls for it. The worked meaning identifies what the principal sentence conveys; `examples[].note` gives a related practice prompt, a full Ukrainian answer and a reason. The selected `ukrainian-ukraine` variety is taught directly. These lessons are original AI-authored prose, with `needs_review` retained; source pages support scoped constructions, not linguistic certification.

All eight assessment guidances were read and left unchanged. The guides preserve their distinctions between learned skill and permission, absence of necessity and prohibition, ongoing and bounded events, an evidential reason and a physical cause, a real condition and an already asserted event, understanding and agreement, and contextual short answers. Feminine past and stance forms in principal examples are taught as speaker-linked forms rather than universal first-person endings. No assessment contradiction requiring an edit was identified.

## Verification

All 16 guides and eight assessments parsed as YAML. A local HEAD comparison confirmed 84 paired edition-sections and 84 principal Ukrainian examples retain their original text, subskill IDs and order; all eight assessments remained byte-for-byte unchanged. Every section has a declarative explanation, worked meaning and a note with a full answer. English and Cantonese target examples match, and a scan found balanced backticks and no exercises in `section.explanation`. `node tools/check-languages.ts` and `git diff --check` passed for this content. The repository integrator owns the final `npm run check:fast` gate.

The integration reviewer read all 84 sections, the eight assessments and the cited Jenkala case/aspect/word-order pages. Two contextual refinements followed: the box in the request lesson is being brought near the door for pickup, and the first-person booking paraphrase now explicitly follows a rule that applies to the speaker. These changes affect teaching context and practice only; the principal Ukrainian examples and IDs remain unchanged. No further assessment conflict was found in that review. The final repository gate remains integration-owned.

An independent paired review then identified three editorial issues, now corrected: the tomorrow-refusal practice explicitly responds to a new invitation for tomorrow in both editions; the Cantonese box-help practice no longer narrows `допомогти з коробкою` to carrying the box; and a stray backtick pair was removed from the English prose `five o’clock`. None changed an assessment, principal target sentence or subskill ID.
