# Portuguese skill-guide expansion — 2026-10-07

Status: implemented teaching-content revision, awaiting independent linguistic review. This note records verification and open questions; it does not make the generated lessons authoritative.

## Scope and behavior

Expanded the existing English and Cantonese `section.explanation` and `examples.note` fields for all eight Portuguese skill groups: 42 subskills and 43 principal examples in each explanation language. The selected variety is `portuguese-brazil` and continues to use the core sections. Explanations now establish a learner situation, unpack the principal Portuguese forms, distinguish nearby functions or forms, and leave a worked transfer task with a full answer and reason in each example note. These are declarative guide fields consumed by the practice assistant, not changes to assessment or runtime behavior. No new examples were inserted into the principal example arrays.

The eight assessment guidance files were read for alignment. No contradiction requiring an assessment edit was found. The distinctions between ability, permission and requests; sequence and cause; acknowledgment and agreement; duration and frequency; and completed and ongoing activity remain explicit in the guides.

## Source review

The following existing `references.bib` keys were used for claims supported by primary text inspected in this pass:

- `ut_pt_gostar2026`: [UT Austin Tá Falado, Grammar Lesson 1](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_01.pdf), grammar notes on `gostar de`, verb agreement with the experiencer and short `Gosto` replies.
- `ut_pt_contractions2026`: [UT Austin Grammar Lesson 2](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_02.pdf), contraction charts for `em`, `de`, `a` and articles. Apparent typos in unrelated chart rows were not adopted.
- `ut_pt_future_subj2026`: [UT Austin Grammar Lesson 4](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_04.pdf), conditional `se` with future subjunctive, including regular forms resembling infinitives and irregular `tiver`, `quiser`, `puder`.
- `ut_pt_ficar2026`: [UT Austin Grammar Lesson 6](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_06.pdf), location, remaining, change of state and continuation uses of `ficar`.
- `ut_pt_possessives2026`: [UT Austin Grammar Lesson 9](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_09.pdf), possessive agreement with the noun and `dele`/`dela` for owner clarity.
- `ut_pt_negation2026`: [UT Austin Grammar Lesson 10](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_10.pdf), preverbal and final `não` in Brazilian responses.
- `ut_pt_perfect2026`: [UT Austin Grammar Lesson 19](https://coerll.utexas.edu/brazilpod/tafalado/pdf/tafalado_gra_19.pdf), compound perfect for recent repeated or ongoing activity versus preterite with `já` for a completed event.
- `ninin_pt_reformulation2026`: [Ninin, section 2.3](https://www.scielo.br/j/ld/a/gW6rNQRrF9m7yMkgVf6G5Cn/), `em outras palavras` as a reformulation marker relating new wording to prior content. Its academic-writing setting does not certify the app's colloquial examples.

`uw_pt_principiantes2026` remains in the preexisting provenance. Its bibliography record states that relevant passages were read on 2026-10-04; the Wisconsin download and chapter pages returned 403 in this pass, so no new claim rests solely on a fresh reading of that site. No new bibliography key was needed. The teaching sentences and practice answers are original AI-authored material, not quotations from the sources.

## Verification

Local YAML parsing passed for all 16 explanation files. A comparison with `HEAD` verified all 42 subskill IDs, all 43 principal Portuguese example texts, every existing example count, and the `portuguese-brazil` variety key. English and Cantonese target examples remain aligned. Every explanation and exercise note has paired backticks, and every example note includes a full worked answer. The original Cantonese gloss for `Estou contente com o resultado` was adjusted from a narrower satisfaction reading to `我對個結果感到開心。`; its Portuguese text and ID are unchanged. The event-sequence transfer task now gives a sensible wash-then-cut procedure instead of asking the learner to reverse the flour and water recipe steps.

Root integration owns `npm run check:fast` and any wider content gates on the final shared working tree. These local checks do not constitute a running-app review or native-speaker certification.

## Open review point

`Podemos combinar no sábado?` in the coordinating-plan principal example is plausible elliptical Brazilian conversation, while `Podemos combinar para sábado?` may be a more explicit target-date construction. Its principal text was preserved. A Brazilian Portuguese reviewer can judge whether the elliptical wording fits this context before any principal-example correction. The original example meanings and all newly authored Cantonese terminology remain `needs_review` until independent linguistic review.
