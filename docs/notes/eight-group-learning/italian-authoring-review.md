# Italian authoring checkpoint

2026-10-04; revision `italian-skills-2026-10-04`. Authored in standard written Italian applicable to the declared `italian-italy` variety. All documents and variety records are explicitly AI-authored, `needs_review`, `generation: null`, with `use_core`. This is source-informed AI editorial review and structural validation, not independent linguistic certification.

## Created sources

All paths are relative to the repository root.

| Assessment | English-explanation guide |
| --- | --- |
| `content/languages/italian/skills/people-places/italian-people-places-assessment.yaml` | `content/languages/italian/skills/people-places/italian-people-places-explained-in-english.yaml` |
| `content/languages/italian/skills/time-events/italian-time-events-assessment.yaml` | `content/languages/italian/skills/time-events/italian-time-events-explained-in-english.yaml` |
| `content/languages/italian/skills/information-exchange/italian-information-exchange-assessment.yaml` | `content/languages/italian/skills/information-exchange/italian-information-exchange-explained-in-english.yaml` |
| `content/languages/italian/skills/feelings-viewpoints/italian-feelings-viewpoints-assessment.yaml` | `content/languages/italian/skills/feelings-viewpoints/italian-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/italian/skills/possibilities-constraints/italian-possibilities-constraints-assessment.yaml` | `content/languages/italian/skills/possibilities-constraints/italian-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/italian/skills/reasons-connections/italian-reasons-connections-assessment.yaml` | `content/languages/italian/skills/reasons-connections/italian-reasons-connections-explained-in-english.yaml` |
| `content/languages/italian/skills/coordinating-action/italian-coordinating-action-assessment.yaml` | `content/languages/italian/skills/coordinating-action/italian-coordinating-action-explained-in-english.yaml` |
| `content/languages/italian/skills/managing-conversation/italian-managing-conversation-assessment.yaml` | `content/languages/italian/skills/managing-conversation/italian-managing-conversation-explained-in-english.yaml` |

42 ordered sections, 43 original teaching examples, eight assessment guidance strings of 152–160 words. One extra example contrasts ongoing painting and finished painting. Explanations, meanings and notes are English; literal examples are Italian with required accents and apostrophes. No runtime, schema, language-identity, scoring, global-prompt or UI change.

## Research

Read relevant passages of Treccani’s authored grammar/dictionary entries and Zanichelli’s original lessons. Added 18 entries in `references.bib`, each with URL, scoped claim and full-text review of the relevant passages. The file-specific provenance uses these keys:

- People/places: `treccani_it_agreement2026`, `treccani_it_possessives2026`, `treccani_it_essere2026`, `zanichelli_it_comparison2026`, `zanichelli_it_prepositions2026`, `zanichelli_it_location2026`. Read agreement, possessive forms/article exceptions, predication and location, comparative di/che, and preposition contraction tables.
- Time/events: `treccani_it_present2026`, `treccani_it_past2026`, `treccani_it_periphrases2026`, `treccani_it_connectives2026`. Read present/current/programmed future, continuing duration, compound past formation and regional notes, progressive stare + gerund, and finire di versus smettere di.
- Questions and actions: `treccani_it_questions2026`, `zanichelli_it_modals2026`, `treccani_it_conditional2026`. Read question and confirmation forms, polite/action uses, modal infinitives and conditional requests/potential actions.
- Viewpoints: `treccani_it_preferences2026`, `treccani_it_piace2026`; plus agreement/modal/discourse references. Read preferire’s infinitive and alternative-selection usage, and mi piace/mi piacciono constructions.
- Connections: `treccani_it_causal2026`, `treccani_it_conditions2026`, `treccani_it_connectives2026`. Read factual reason clauses, open indicative contingencies and colloquial notes, consequence/contrast and argument links.
- Conversation: `treccani_it_discourse2026` and question/connector references. Read discourse-marker multifunctionality, reception, floor-taking, reformulation, topic transition and contextual readings.

The ULB MultiGram site was also consulted while locating material. Its modal table contains apparent transcription errors in some cells, so it was not added or used as the source of the authored conjugations. Several guessed Treccani URLs failed; successful exact entry URLs were then located. Unavailable pages are not cited as read. Zanichelli review applies to the main lessons and relevant tables, not their long reader-comment collections. Simplified claims such as only sì/no answers, a universal regional tense preference or a geography-based preposition rule were not adopted.

## Editorial cases

Paper expectations, not measured model results. Negative cases assume no other successful function in the reply. Context must come from the available exchange; subfunction ambiguity alone does not make an otherwise successful main group unclear.

| Group | Direct / positive | Unsuccessful or absent | Contextual | Ambiguity to resolve |
| --- | --- | --- | --- | --- |
| People/places | `Le finestre sono aperte.` | Intended property `Le finestre sono aperto.` has incorrect agreement. | `Di Sara.` after asking who owns the bag. | `La sua.` without recoverable possessed item or possessor needs context. |
| Time/events | `Domani il corso comincia alle nove.` | Intended compound past `Ieri ho comprare.` alone fails. | `Ieri sera.` after asking when the learner called. | `Vorrei partire.` describes a current wish/potential action, not necessarily a future event actually planned. |
| Information | `A che ora comincia il corso?` | Copied `a che ora` without an intelligible question. | `Alle nove.` after asking the course’s start time. | `Alle nove?` may confirm the hour or repair hearing; inspect preceding contribution. |
| Viewpoints | `Preferisco camminare.` | Intended liking `Mi piace i funghi.` alone fails agreement. | `Sì.` after an evaluative claim can align. | `Vorrei un caffè.` may function primarily as a service request; do not infer every neighboring function. |
| Possibilities | `So riparare una ruota.` | `Devo parto.` alone fails the intended infinitive construction. | `Sì.` from a responsible person after a permission question. | Permission/opportunity with `Posso entrare?` can both establish this group; unresolved subtype alone is not `unclear`. |
| Connections | `Prendo l’autobus perché piove.` | A copied perché supplies no reason. | `Piove.` after asking why the learner takes the bus. | `Non so se apre.` is an indirect whether question, not automatically a condition. |
| Action | `Puoi chiudere la finestra, per favore?` | `Puoi chiudi la finestra?` alone fails the modal request. | `Volentieri.` after an invitation can accept. | `Porto i pennelli.` is a commitment in a supplies plan, but may merely report another event. |
| Conversation | `Intendevo il cortile, non il parcheggio.` repairs an interpretation. | Quoting ciao as vocabulary does not open contact. | `Sì.` after an explanation can register receipt. | `Vero?` may seek factual confirmation or check understanding; inspect its antecedent. |

Independent review still needs to confirm naturalness, English meanings, short-answer contexts and regional/register applicability. Neutral examples do not exhaust regional Italian. No known selected-construction gap was filled with invented content.

## Actual checks

All four required checkpoint commands exited 0: `npm run content:check`; `cargo run --manifest-path native/Cargo.toml --bin audit-content -- --coverage`; `npm run check:fast`; `cargo test --manifest-path native/Cargo.toml --lib configuration::`. Fast regression tests: 13 passed. Configuration tests: 66 passed, 0 failed, 761 filtered out. Content totals now include 40 assessments and 48 learner guides.

Required missing **256 → 240**; bundled-target missing **576 → 560**; no Italian required paths remain missing. The offline `--request italian italian-italy` command exited 0 using the original Italian message in [the complete specimen](italian-assessment-specimen.json). Inspected all eight skill questions plus grammar and understandability, unchanged global category definitions, 25 matching source fingerprints and absence of learner-guide sources. No model call was made.

The same checkpoint commands also validate the corrected German guidance. Its regenerated specimen uses `Kann ich mein Fahrrad hier abstellen?`; the corrected ambiguity sentence is present. This is an internal checkpoint; authoring continues with Portuguese.
