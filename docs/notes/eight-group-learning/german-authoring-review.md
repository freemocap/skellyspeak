# German source batch: authoring and verification

Date: 2026-10-04. Revision: `german-skills-2026-10-04`.

Completed the German batch requested in the [bulk-authoring handoff](bulk-authoring-handoff.md), using the French worked pairs and [verification record](french-authoring-review.md) as structural examples. German grammar was researched separately. Every document and its `german-germany` variety record explicitly retain `origin: ai`, `review.status: needs_review` and the same revision. `generation: null` records that no reliable generation-model metadata was available.

This is schema-valid, source-informed material with an AI editorial review. It has **not been independently linguistically reviewed**. Structural checks do not certify German correctness.

## Files and coverage

Created the following 16 files, relative to the repository root. The language identity file, shared concepts, policies, schemas, global prompts, scoring, runtime and UI were not edited.

| Assessment | English-explanation learner guide | Sections / examples |
| --- | --- | --- |
| `content/languages/german/skills/people-places/german-people-places-assessment.yaml` | `content/languages/german/skills/people-places/german-people-places-explained-in-english.yaml` | 5 / 6 |
| `content/languages/german/skills/time-events/german-time-events-assessment.yaml` | `content/languages/german/skills/time-events/german-time-events-explained-in-english.yaml` | 6 / 7 |
| `content/languages/german/skills/information-exchange/german-information-exchange-assessment.yaml` | `content/languages/german/skills/information-exchange/german-information-exchange-explained-in-english.yaml` | 4 / 4 |
| `content/languages/german/skills/feelings-viewpoints/german-feelings-viewpoints-assessment.yaml` | `content/languages/german/skills/feelings-viewpoints/german-feelings-viewpoints-explained-in-english.yaml` | 5 / 5 |
| `content/languages/german/skills/possibilities-constraints/german-possibilities-constraints-assessment.yaml` | `content/languages/german/skills/possibilities-constraints/german-possibilities-constraints-explained-in-english.yaml` | 5 / 5 |
| `content/languages/german/skills/reasons-connections/german-reasons-connections-assessment.yaml` | `content/languages/german/skills/reasons-connections/german-reasons-connections-explained-in-english.yaml` | 5 / 5 |
| `content/languages/german/skills/coordinating-action/german-coordinating-action-assessment.yaml` | `content/languages/german/skills/coordinating-action/german-coordinating-action-explained-in-english.yaml` | 6 / 6 |
| `content/languages/german/skills/managing-conversation/german-managing-conversation-assessment.yaml` | `content/languages/german/skills/managing-conversation/german-managing-conversation-explained-in-english.yaml` | 6 / 6 |

All 42 declared subskills occur once, in shared-source order. There are 44 original teaching examples; the two extra examples contrast spatial location/destination and unfinished/completed work. All eight assessments cover their whole group through the existing single `guidance` field. All guides point to their existing shared English explanation. English explanation, meaning and note fields accompany German example text. All 16 files explicitly select `use_core` for the sole declared variety, `german-germany`.

Required source coverage fell from **272 to 256** missing files, exactly 16 fewer; no German required sources remain missing. The separate bundled-target gap fell from 592 to 576. The 256 required files belong to the other 16 remaining target languages; optional explanatory translations are a separate backlog.

Also added 22 narrowly scoped German reference entries to `references.bib`, this note, and the [complete offline German assessment specimen](german-assessment-specimen.json).

## References and scope of evidence

The following relevant passages were read on 2026-10-04. Bibliography entries record URLs, `review: full-text` and scoped claims; this means the relevant passages were read, not that every long source was exhaustively reviewed. File provenance selects the relevant keys. Explanations and examples were authored for this batch rather than translated from French lessons or reproduced from source collections.

| Source and bibliography key | Relevant material consulted |
| --- | --- |
| University of Michigan: [word order](https://sites.lsa.umich.edu/german-resources/grammatik/wortstellung/) — `umich_de_word_order2026` | Finite verb position, subordinate clauses, modal infinitives and separable verbs. |
| Michigan: [tenses](https://sites.lsa.umich.edu/german-resources/grammatik/tenses/) — `umich_de_tenses2026` | Present/current/future reference, Perfekt/Präteritum, participles including verbs in -ieren. The teaching summary does not justify universal tense equivalence or a mandatory aspect contrast. |
| Michigan: [article tables](https://sites.lsa.umich.edu/german-resources/grammatik/basic-chart/) and [adjective endings](https://sites.lsa.umich.edu/german-resources/grammatik/adjektivendungen/) — `umich_de_articles2026`, `umich_de_adjectives2026` | Possessive endings; predicative versus attributive adjective forms. |
| Michigan: [prepositions](https://sites.lsa.umich.edu/german-resources/grammatik/prepositions/) — `umich_de_prepositions2026` | Spatial location versus destination, motion within a location, mit and seit with dative. |
| Michigan: [comparison](https://sites.lsa.umich.edu/german-resources/grammatik/komparativ/) — `umich_de_comparison2026` | Comparative -er, als, gern/lieber. |
| Michigan: [modal verbs](https://sites.lsa.umich.edu/german-resources/grammatik/modal-verbs/) and [Konjunktiv II](https://sites.lsa.umich.edu/german-resources/grammatik/konjunktiv2/) — `umich_de_modals2026`, `umich_de_subjunctive2026` | Forms, bare infinitives and current polite requests. |
| Michigan: [verb-first clauses](https://sites.lsa.umich.edu/german-resources/grammatik/verb-first/) — `umich_de_questions2026` | Questions, imperatives and main clauses after an initial subordinate clause. |
| Michigan: [conjunctions](https://sites.lsa.umich.edu/german-resources/grammatik/konjunktionen/) and [adverbs](https://sites.lsa.umich.edu/german-resources/grammatik/useful-adverbs/) — `umich_de_connectors2026`, `umich_de_adverbs2026` | Weil/dass/falls/ob, denn/aber; temporal sequence versus causal consequence. |
| Michigan: [prepositional verbs](https://sites.lsa.umich.edu/german-resources/grammatik/prepositional-verbs/) and [reflexive verbs](https://sites.lsa.umich.edu/german-resources/grammatik/reflexiv/) — `umich_de_prepositional2026`, `umich_de_reflexive2026` | Arbeiten an + dative; sich freuen über + accusative; reciprocal treffen. |
| IDS grammis: [epistemic modal use](https://grammis.ids-mannheim.de/systematische-grammatik/1552) and [question mode](https://grammis.ids-mannheim.de/systematische-grammatik/1873) — `ids_de_epistemic2026`, `ids_de_questions2026` | Obligation versus inference; confirmation, declarative-order questions and conversational repair. |
| Goethe-Institut: [discussion expressions](https://www.goethe.de/de/spr/ueb/dfs/adu/s00/s07.html) — `goethe_de_discussion2026` | Position, agreement, disagreement, grounds, doubt, clarification and proposals. |
| Goethe/telc: [Deutsch-Test für Zuwanderer handbook](https://www.goethe.de/resources/files/pdf209/dtz_pruefungshandbuch.pdf) — `goethe_de_discourse2026` | Sprachliche Inventare, printed pp. 89–96 (PDF pp. 92–99), especially discourse strategies pp. 95–96. Address forms, social/action functions, repair, taking the floor, and softened current requests with wollte. No exam scoring imported. |
| Duden: [fertig](https://www.duden.de/rechtschreibung/fertig) — `duden_de_fertig2026` | Meanings 1–3: task completion distinguished from readiness/exhaustion. |
| Victorian education authority: [German clock expressions](https://www.education.vic.gov.au/languagesonline/legacy/german/sect29/answers.htm) — `victoria_de_clock2026` | Activities 6 and 11: halb neun denotes 8:30. No claim about all regional time-expression systems. |
| LEO grammar: [müssen](https://dict.leo.org/grammatik/deutsch/Wort/Verb/VollHilfModal/muessen.xml?lang=de) and [dürfen](https://dict.leo.org/grammatik/deutsch/Wort/Verb/VollHilfModal/duerfen.xml?lang=de) — `leo_de_modal_negation2026`, `leo_de_permission2026` | Necessity/negation/inference; permission and authority. Nicht müssen removes necessity; nicht dürfen denies permission. |
| Susanne Günthner: [spoken grammar paper](https://www.degruyterbrill.com/document/doi/10.1515/infodaf-2000-0403/pdf) — `guenthner_spoken_grammar2000` | Section 4.1, printed pp. 359–360 (PDF pp. 7–8): documented discourse functions of spoken weil + verb-second. This prevents a universal error claim. |

An additional IDS modal page, `/1555`, was read as corroboration but not needed as a file citation. IDS `/1551` timed out and a Goethe Deutsch Online A1 PDF was unavailable; neither is claimed as read or used as evidence.

## Editorial cases reviewed on paper

These are expectations for applying the existing categories, **not model scores or empirical evaluations**. Counterexamples assume no separate successful function in the same reply. Context belongs to the preceding exchange, not to the partner's credited performance. Multiple plausible readings within one group can still establish that group; ambiguity between subfunctions alone does not force `unclear`.

| Group | Positive / direct | Unsuccessful or absent | Context-dependent / contextual | Ambiguous case and boundary |
| --- | --- | --- | --- | --- |
| People/places | `Diese Kiste ist leichter als die anderen.` compares weight. | Intended ordinary comparative `Diese Kiste ist mehr leicht.` is unsuccessful. | After `Wer ist das?`, `Unsere Nachbarin.` identifies the person contextually. | `Leichter.` without a recoverable comparison/referent cannot establish which relation is being expressed. Do not invent it. |
| Time/events | `Morgen fährt unser Zug ab.` explicitly dates a future event without werden. | `Gestern ich die Reifen prüfen.` alone fails the attempted ordinary past clause. | After `Wann hast du angerufen?`, `Gestern Abend.` completes past reference. | `Ich wollte dich besuchen.` may describe an earlier plan or soften a current intention; wanted-form morphology alone is insufficient past-event evidence. |
| Information exchange | `Wann öffnet die Werkstatt morgen?` asks for information. | A copied word `wann` with no communicative question is absent. | `Um halb neun.` answers an identifiable opening-time question. | `Um halb neun?` may check a proposed time or seek clarification of hearing. Inspect the preceding exchange before assigning the function. |
| Feelings/viewpoints | `Ich freue mich über deine Nachricht.` expresses pleasure. | Intended reflexive `Ich freue über die Nachricht.` alone does not successfully form that construction. | `Ja.` after an identifiable evaluative claim can align with it. | `Ja.` with no recoverable antecedent could align, accept an invitation or acknowledge; do not infer all three. |
| Possibilities/constraints | `Wir müssen die Fahrkarten vorzeigen.` states a requirement. | Intended modal construction `Ich muss zu gehen.` alone is unsuccessful. | `Ja.` from the responsible person after `Darf ich hier parken?` can grant permission. | `Er muss da sein.` may express duty or inference. Both can fall in this group; lack of a unique subtype does not erase a correct group use. A polite request with können need not demonstrate ability. |
| Reasons/connections | `Falls es morgen regnet, bleiben wir zu Hause.` states a contingency. | Copying `weil` without a reason relationship is absent. | After `Warum nimmst du den Bus?`, `Mein Fahrrad ist kaputt.` supplies the reason without explicitly stating the causal relationship. | `Wenn es regnet, bleibe ich zu Hause.` can be habitual temporal or conditional; inspect the meaning and context instead of crediting every wenn token. Spoken weil + V2 is not universally unsuccessful. |
| Coordinating action | `Könntest du die Tür öffnen?` can request an action. | `Könntest du die Tür öffnest?` alone fails that modal request construction. | `Gern.` after a clear invitation can accept it. | `Ich bringe die Decke mit.` undertakes responsibility in a supplies plan but can merely report an event elsewhere. Context must establish the undertaking. |
| Managing conversation | `Ich meinte den Hintereingang, nicht den Haupteingang.` explicitly repairs the mistaken interpretation. | Quoting `Guten Tag` as a vocabulary item does not open an encounter. | `Ah ja.` after an explanation can acknowledge it. | `Stimmt das?` can check truth or repair understanding. Ask which conversational trouble is addressed; a fact check alone need not manage conversation. |

The sources substantiate the selected constructions. No known unsupported rule was filled with invented material. Remaining independent-review questions are the naturalness and English meanings of all 44 original examples; the adequacy of each short-response context; register-sensitive readings of modal/request forms; and whether the neutral core choices are suitable across ordinary usage in Germany. The batch does not describe all German regional colloquial variants or ban constructions outside its teaching examples. The broad `use_core` editorial choice still needs independent confirmation.

## Commands and actual results

Executed from the repository root after authoring; the content and fast checks were repeated after the final citation/wording adjustment.

| Command | Actual result |
| --- | --- |
| `npm run content:check` | Exit 0. 8 skills, 42 subskills, 20 languages, 16 shared explanations, 32 assessments, 40 learner guides valid; 256 required and 576 bundled-target files missing. |
| `cargo run --manifest-path native/Cargo.toml --bin audit-content -- --coverage` | Exit 0 before and after. Required missing 272 → 256; bundled missing 592 → 576; no German required sources missing. |
| `npm run check:fast` | Exit 0. Rust formatting, localization sources/usage, diagnostics, styles and validation-tool types passed; all 13 validation regression tests passed. |
| `cargo test --manifest-path native/Cargo.toml --lib configuration::` | Exit 0. 66 passed, 0 failed, 0 ignored, 761 filtered out. |
| Offline request command below | Exit 0. Actual request saved without hand-editing to the linked specimen. All 10 questions and all hashed sources inspected. |
| `npm run docs:links` | Exit 0. Local links valid in the checker’s 9 current documentation entry points. The three relative links in this new note were also inspected for existing destinations. |
| `cargo run --manifest-path native/Cargo.toml --bin audit-content -- --ready` | Exit 1, as expected: `256 required documents missing; inspect --coverage for exact paths.` The whole source collection is not ready. |
| `node work/inspect-german-final.cjs` (scratch inspection, from the authoring workspace) | Exit 0 on the corrected final run. Confirmed 42 sections / 44 examples, guidance lengths 164–171 words, exact German guidance in all eight questions, 25 matching source fingerprints and no learner-guide sources. Confirmed the preservation audit below. |

```powershell
$state = '{"currentLearnerMessage":"Gestern habe ich den Fahrradkorb repariert. Morgen bringe ich ihn zurück, weil ich heute keine Zeit habe.","precedingExchange":[]}'
$payload = $state | cargo run --manifest-path native/Cargo.toml --bin audit-content -- --request german german-germany
$payload | Set-Content docs/notes/eight-group-learning/german-assessment-specimen.json -Encoding utf8
```

The specimen uses `language: German` and `variety: Germany`, with the original German message preserved. It contains all eight group questions, grammar and understandability. Each group receives its shared definition, global criteria and authored German assessment guidance. No learner-guide source is included, and its prose is not copied wholesale into the assessment questions. Grammar and understandability retain the existing global instructions. The specimen is offline composition evidence, not a model response.

Cargo emitted the nonfatal environment warning `could not canonicalize path C:\Users\jonma`; the successful commands still exited 0. An initial ad hoc JSON inspection mistakenly treated the questions object as an array and failed with TypeError; the inspection was corrected to enumerate the keyed object. The first scratch preservation inspection reached Git’s ownership guard after completing its file/hash checks; rerunning with a command-local `safe.directory` for this known checkout succeeded. No global Git setting, content or validator change was made to suppress either inspection failure.

Compared SHA-256 hashes against the initial snapshot of existing nonignored tracked/untracked files. The only changed pre-existing file was `references.bib`; its entire initial byte sequence remains intact before the appended German entries. No existing file was removed. New nonignored repository files are exactly the 16 German source files, this review note and the specimen. The shared checkout’s unrelated changes were preserved, including generated schemas after the configuration tests.

No paid generation call, commit or deployment was made. This initial report ended with the German batch. The subsequently expanded catalog task is tracked in `catalog-authoring-progress.md`.

## Follow-up correction, 2026-10-04

Clarified the possibilities/constraints assessment to match the editorial principle already documented above: permission versus practical-opportunity ambiguity does not itself justify `unclear` when all plausible readings establish correct use within this same main group. Reserve `unclear` for evidence that does not establish correct group use. The German specimen was regenerated from the corrected source; source status remains AI-authored and `needs_review`.
