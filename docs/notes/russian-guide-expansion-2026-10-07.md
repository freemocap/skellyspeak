# Russian skill-guide expansion — 2026-10-07

Status: implementation complete; independent review pending. This note records source inspection, citation entries, verification, and unresolved review questions. It does not make the AI-authored guide text independently validated.

## Source inspection

Directly read Cornell's *Beginning Russian Grammar* pages on aspect (`gr04_d`), adjective agreement (`gr02_b_1`), possession (`le22_30_a`), `можно`/`нельзя` (`le103_110_e`), necessity (`le57_62_f`), real conditions (`gr12_c_b`), and polite imperatives (`le79_86_j`) on 2026-10-07. These support the existing bibliography keys `cornell_russian_aspect2026`, `cornell_russian_agreement2026`, `cornell_russian_possession2026`, `cornell_russian_modality2026`, `cornell_russian_need2026`, `cornell_russian_condition2026`, and `cornell_russian_imperative2026` within their respective, narrow claims. The site displays legacy-font Cyrillic incorrectly in plain text; the source's English grammar descriptions were reviewed, while guide examples remain original and need linguistic review.

Also read Cornell's past-tense page (`gr02_c_1`), future-tense page (`gr05_c_2`), comparative page (`gr13_a_a`), numeral page (`le51_56_b_num`), comparison-standard page (`le95_102_e`), joint suggestion page (`le63_70_a`), and frequency page (`times_per`). The root agent registered all six new entries below in `references.bib` before they were used in YAML.

```bibtex
@misc{cornell_russian_past2026,
  title = {Beginning Russian Grammar: The past tense},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/gr02_c_1.htm},
  review = {full-text},
  claim = {Past-tense -л- forms agree in gender and number with the nominative subject; relevant explanation consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}

@misc{cornell_russian_future2026,
  title = {Beginning Russian Grammar: Verbs expressing past, present, and future},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/gr05_c_2.htm},
  review = {full-text},
  claim = {Perfective nonpast expresses future reference, while imperfective future uses forms of быть with an imperfective infinitive; relevant explanation consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}

@misc{cornell_russian_comparison2026,
  title = {Beginning Russian Grammar: Expressing than in comparisons},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/le95_102_e.htm},
  review = {full-text},
  claim = {A genitive comparison standard can replace чем for a nominative or accusative second item, while other constructions require чем; relevant passage consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}

@misc{cornell_russian_lets2026,
  title = {Beginning Russian Grammar: Expressing Let's},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/le63_70_a.htm},
  review = {full-text},
  claim = {Давайте combines with an imperfective infinitive or a perfective nonpast form to suggest joint future action; relevant passage consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}

@misc{cornell_russian_frequency2026,
  title = {Beginning Russian Grammar: X times per day, week, month, year},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/times_per.htm},
  review = {full-text},
  claim = {Frequency is expressed with a count of раз plus в and an accusative time unit, including в неделю; relevant passage consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}

@misc{cornell_russian_numerals2026,
  title = {Beginning Russian Grammar: Genitive singular after numerals two, three, four},
  author = {{R. L. Leed, A. D. Nakhimovsky and A. S. Nakhimovsky; Cornell University}},
  url = {https://russian.cornell.edu/grammar/html/le51_56_b_num.htm},
  review = {full-text},
  claim = {Nominative or matching accusative numerals two, three, and four take genitive singular counted nouns, and two distinguishes feminine from masculine or neuter; relevant passage consulted, with legacy-font source spellings not copied.},
  note = {Relevant passage consulted 2026-10-07. Russian guide examples remain AI-authored and needs_review.}
}
```

## Scope and verification

The edit scope is the sixteen Russian English/Cantonese explanation YAML files: eight groups and 42 subskills. Principal Russian example text, subskill IDs, and the sole declared `russian-russia` variety are preserved. All eight Russian assessment guidance files were read for semantic contradictions and are left unchanged. Explanations are declarative; transfer tasks and worked answers/reasons belong in example notes. Source-informed editorial review is not independent linguistic certification; review status remains `needs_review`.

Local verification after the final edit: all sixteen YAML files parse; eight groups and 42 subskill IDs match `HEAD`; all principal Russian example text and the sole variety match `HEAD`; English/Cantonese principal text and section ordering match; target fragments have paired backticks, and no Cyrillic target form appears bare in prose; no heading, blockquote, or additional example is embedded in explanatory prose; `git diff --check` passes. Source keys were confirmed present in `references.bib`. All eight assessment files remain unchanged. The root agent is running independent review and global checks.

Review corrections: the `requests` context now calls for bringing a box near the door for loading, matching principal `к двери`; it no longer describes clearing that doorway. Cantonese practice notes no longer add a second Chinese full stop immediately after a Russian answer that already ends with terminal punctuation. No principal example was changed.

Remaining review: fixed feminine speaker forms (`рада`, `согласна`, `имела`, `уверена`, past `-ла`) are explicitly taught without assuming the learner's identity. The light-in-window example is presented as a cautious inference, not proof of occupancy. Native-speaker review is still needed for idiom and register of both principal and newly authored transfer sentences; source review only establishes the scoped constructions above.


Additional independent AI review read all 42 bilingual pairs and eight assessments, with Cornell source checks. Root changed the invitation context from a friend to a colleague to fit the preserved polite `Извините` reply. No other demonstrated target-form error or assessment contradiction was found; native linguistic review remains pending.
