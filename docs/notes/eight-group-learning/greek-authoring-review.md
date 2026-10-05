# Modern Greek authoring checkpoint

2026-10-04; revision `greek-skills-2026-10-04`. Sixteen sources retain explicit AI authorship, `origin: ai`, `needs_review`, `generation: null` and identical document/variety review revisions. The sole declared variety, `greek-greece`, uses the core for contemporary standard Modern Greek in Greece. No independent linguistic review or live-model/app verification has been performed. Structural validation does not certify correctness.

## Exact files and coverage

Paths relative to the repository root:

| Assessment | English-explanation guide |
| --- | --- |
| `content/languages/greek/skills/people-places/greek-people-places-assessment.yaml` | `content/languages/greek/skills/people-places/greek-people-places-explained-in-english.yaml` |
| `content/languages/greek/skills/time-events/greek-time-events-assessment.yaml` | `content/languages/greek/skills/time-events/greek-time-events-explained-in-english.yaml` |
| `content/languages/greek/skills/information-exchange/greek-information-exchange-assessment.yaml` | `content/languages/greek/skills/information-exchange/greek-information-exchange-explained-in-english.yaml` |
| `content/languages/greek/skills/feelings-viewpoints/greek-feelings-viewpoints-assessment.yaml` | `content/languages/greek/skills/feelings-viewpoints/greek-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/greek/skills/possibilities-constraints/greek-possibilities-constraints-assessment.yaml` | `content/languages/greek/skills/possibilities-constraints/greek-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/greek/skills/reasons-connections/greek-reasons-connections-assessment.yaml` | `content/languages/greek/skills/reasons-connections/greek-reasons-connections-explained-in-english.yaml` |
| `content/languages/greek/skills/coordinating-action/greek-coordinating-action-assessment.yaml` | `content/languages/greek/skills/coordinating-action/greek-coordinating-action-explained-in-english.yaml` |
| `content/languages/greek/skills/managing-conversation/greek-managing-conversation-assessment.yaml` | `content/languages/greek/skills/managing-conversation/greek-managing-conversation-explained-in-english.yaml` |

All 42 ordered subskills, 44 original examples, eight assessment guidance strings (158–166 English words). Two additional examples distinguish location/destination and completed/continuing repairs. Explanation, meaning and note are English; literal examples use monotonic Greek script, appropriate accents and final sigma, with Greek question punctuation. Existing identity and romanization instructions are unchanged; examples do not contain romanization or role-labelled dialogue. No runtime, schema, scoring, global prompt or UI edits were made.

Required missing **224 → 208**, bundled missing **544 → 528**, exactly sixteen fewer in each report. No required Greek paths remain. Bibliography additions comprise seven scoped entries, with full-text meaning relevant passages actually read rather than exhaustive reading of a book.

## Primary research and access limitations

Maria Poulopoulou’s original 2015 University of Crete/Kallipos grammar was read through its [accessible original-text mirror](https://www.scribd.com/document/405392750/0-Modern-Greek-for-Absolute-Beginners-pdf). Cover author, title, year, ISBN and reviewer agree with official Kallipos metadata; official repository full-text endpoints were blocked or timed out. The mirror uploader is not treated as the primary author. Relevant sections: cases/time 3.2, present 4, articles/adjectives/comparison 5, pronouns/liking 6, adverbials/reasons 7, aorist and selected verb stems 8, future/finite να/modal/conditional constructions 9, possessive clitics and stress 10.2.3, and selected lexical distinctions 11. Its quoted pedagogical “infinitive” label is not imposed on the person-inflected να construction.

The [official school grammar by Sofronis Hatzisavvidis and Athanasia Hatzisavvidou](https://ebooks.edu.gr/ebooks/d/8547/774/21-0058-02_V2_Grammatiki-Neas-Ellinikis-Glossas_A-B-G-Gymnasiou.pdf) was successfully read through a different official PDF endpoint after earlier textbook endpoints failed. Relevant passages were read for punctuation; stems and register; adverbs/prepositions; questions and ellipsis; mood, modality, aspect, person and impersonals; temporal/spatial/reference expressions; dependent reason/result/condition/contrast clauses; speech acts and contextual meaning; narrative/argumentation/spoken style. The record does not claim every page was read or that PDF screenshots were visually reviewed.

Centre for the Greek Language materials by Anastasios Tsaggalidis and Argyris Archakis (with Christina Panagiotou) were read for respectful plural address and indirect request strategies. The person-reference iframe has a misleading extracted page title: its actual body and parent lemma identify `Πρόσωπο`, not an aspect chapter. The bibliography explicitly records that distinction.

The Institute of Modern Greek Studies dictionary entries for `δηλαδή`, `συμφωνώ` and `εννοώ` support reformulation, clarification, viewpoint versus practical agreement, intended meaning and comprehension. The complete modern `εννοώ` lemma was available in the indexed search response even though opening its page failed; that access method is recorded. The accompanying medieval result was excluded. Unread scanned Triantafyllides grammar pages, failed Ministry PDF endpoints and anonymous secondary grammar summaries are not cited as full-text evidence. Examples and explanations were written independently, not copied from lessons or translated from French.

File citations:

- people-places: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`.
- time-events: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`.
- information-exchange: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`, `tsaggalidis_el_person2026`.
- feelings-viewpoints: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`, `triantafyllides_el_agreement2026`.
- possibilities-constraints: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`.
- reasons-connections: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`.
- coordinating-action: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`, `tsaggalidis_el_person2026`, `archakis_el_politeness2026`, `triantafyllides_el_agreement2026`.
- managing-conversation: `poulopoulou_el_grammar2015`, `hatzisavvidis_el_school_grammar2026`, `tsaggalidis_el_person2026`, `archakis_el_politeness2026`, `triantafyllides_el_diladi2026`, `triantafyllides_el_mean2026`.

## Editorial cases reviewed on paper

These are expectations, not model ratings. An absent-use case assumes no other successful function in the message; context belongs to the actual exchange. Correct readings within one group need not have a uniquely identifiable subtype.

| Group | Positive / direct | Absent or unsuccessful | Contextual | Ambiguity / boundary |
| --- | --- | --- | --- | --- |
| People/places | `Το συνεργείο είναι κοντά στην πλατεία.` states a location. | A copied `πιο` without a recoverable comparison. | `Κοντά στην πλατεία.` after asking where the shop is. | `Στο συνεργείο.` may answer where someone is or where they are going; do not impose a destination on an unknown fragment. |
| Time/events | `Χθες άλλαξα το λάστιχο.` reports a past event. | A quoted `χθες` unconnected to any event. | `Χθες το πρωί.` after asking when the speaker made the repair. | `Θα φέρω τα εργαλεία.` can report a future event or undertake a task. Aspect does not mean an action necessarily took one instant. |
| Information | `Πότε ανοίγει το συνεργείο αύριο;` asks for a time. | A question word quoted as vocabulary with no question. | `Στις εννέα το πρωί.` answers that opening-time question. | Repeating `Στις εννέα;` may check truth or repair hearing; inspect which problem the exchange establishes. |
| Viewpoints | `Διαφωνώ με αυτή την πρόταση.` expresses disagreement. | A quoted `γνώμη` without a stance. | `Ναι.` after an identified evaluation can align. | `Κατάλαβα.` can acknowledge understanding without agreement; `Συμφωνώ.` names agreement explicitly despite an omitted object. |
| Possibilities | `Μπορεί να έρθω αργότερα.` states possibility. | A copied `πρέπει` without a requirement or another correct modal function. | `Ναι.` from the space’s responsible person after a permission question. | `Ο Νίκος μπορεί να οδηγήσει.` can express ability or possibility, both within the group; subtype ambiguity alone is not unclear. |
| Connections | `Αν βρέξει αύριο, θα πάμε με το λεωφορείο.` states a condition and consequence. | An isolated `επειδή` without a recoverable reason. | `Το λάστιχο είναι χαλασμένο.` after asking why the speaker is not taking the bicycle. | `αν` in an indirect whether question is not necessarily a conditional. A lit shop can support an inference without causing its opening. |
| Action | `Μπορείτε να ανοίξετε την πόρτα, παρακαλώ;` requests action. | Quoting `παρακαλώ` without an action or contextual offer. | `Ναι, ευχαριστώ πολύ.` after an offer to carry a bag. | `Θα φέρω εγώ τα εργαλεία.` commits during task division but need not promise in a neutral event report. Respectful plural does not require multiple listeners. |
| Conversation | `Εννοώ το Σάββατο, όχι την Παρασκευή.` repairs a misunderstood day. | Quoting a greeting as vocabulary without establishing contact. | `Κατάλαβα, ευχαριστώ.` after an explanation can register receipt. | `Δηλαδή;` can request clarification; the particle also has other interrogative roles and is not automatically conversational repair. |

No known unsubstantiated selected construction was replaced with filler. Independent review is still needed for the naturalness and English meanings of all 44 original examples, clitic stress, scope of negation, short-answer contexts, modality and interpersonal readings, and core applicability to ordinary standard usage in Greece. The batch makes no claim to describe all regional varieties. A literal first-person adjective such as `μόνος μου` has its male-speaker choice explained rather than an invented gender-neutral form.

## Actual validation

All commands ran on the completed Greek source state and exited 0:

| Command | Result |
| --- | --- |
| `npm run content:check` | 8 skills, 42 subskills, 20 languages, 16 shared explanations; 56 assessments and 64 learner guides valid. Required missing 208; bundled missing 528. |
| `cargo run --manifest-path native/Cargo.toml --bin audit-content -- --coverage` | Exact remaining paths emitted; no Greek required gaps. |
| `npm run check:fast` | Fast validation passed; 13 tooling regression tests passed, 0 failed. |
| `cargo test --manifest-path native/Cargo.toml --lib configuration::` | 66 passed, 0 failed, 0 ignored, 761 filtered out. |
| Offline `--request greek greek-greece` | Complete actual request saved to [Greek assessment specimen](greek-assessment-specimen.json). |
| Scratch `node work/inspect-language.cjs greek` | 42 sections/44 examples; all 10 questions inspected, 25 matching fingerprints, no learner-guide source paths. |

The request used `Χθες άλλαξα το λάστιχο του ποδηλάτου. Αν βρέξει αύριο, θα πάμε με το λεωφορείο.` with empty preceding exchange. All eight skills, grammar and understandability retain their shared definitions and criteria; the actual authored Greek guidance is included, without learner-guide prose copied wholesale. This is offline composition, not a provider-generated judgement. Cargo emitted its nonfatal path-canonicalization warning; commands nevertheless exited 0. Logs and exact exit records are in the authoring workspace’s `work/validation-greek/`.

Continue with Hindi and all independent remaining required languages. Combined catalog ready/full-native/Clippy/docs and live-app acceptance remain outstanding. No paid API, commit or deployment was performed.
