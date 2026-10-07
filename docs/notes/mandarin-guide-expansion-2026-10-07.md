# Mandarin teaching guide expansion — 2026-10-07

Implemented editorial revision; independent linguistic review remains pending.

## Coverage and boundaries

All eight groups, 42 subskills, and 16 existing English/Cantonese explanation files were revised for `mandarin-mainland-china`. All 42 principal example strings, IDs and order are preserved in each edition. No assessment, shared concept, language configuration, runtime or bibliography files were edited.

| Group | Audited subskills |
| --- | --- |
| possibilities_constraints | ability, permission, obligation, possibility, certainty |
| information_exchange | asking_information, answering_information, checking_facts, useful_detail |
| people_places | identification, qualities_states, location_movement, possession_relations, quantity_comparison |
| feelings_viewpoints | wants_intentions, preferences, emotions, opinions, agreement_disagreement |
| coordinating_action | requests, offers_invitations, suggestions, commitments, accepting_declining, negotiating_plans |
| managing_conversation | opening_closing, acknowledging, clarification, rephrasing, correcting_misunderstanding, turns_topics |
| reasons_connections | causes_reasons, consequences, conditions, contrast, supporting_claims |
| time_events | present_events, past_events, future_events, duration_frequency, event_sequence, event_phase |

Each lesson now starts with a plausible communicative situation in declarative prose. Meaning fields unpack the principal example's actual words and order. Notes supply an adaptable contrast and a short exercise with a complete Mandarin answer and explanation. Exercises stay out of section.explanation because that field also enters partner focus prompts. Backticks mark Mandarin forms and their pronunciation where needed; Cantonese explanatory prose remains unquoted.

## Substantive teaching

The revision distinguishes learned skill from current opportunity, permission from a placement statement, absence of need from prohibition, and candidate-fact confirmation from an open question. It explains object handling with 把 separately from 把 as a chair classifier; location words after their reference nouns; direct adjective predicates; comparison standards and small differences; roles in offering versus requesting help; and volunteering during planning.

Time lessons distinguish contextual past/future reference from conjugation, verb-adjacent event 了 from sentence-final changed-situation 了, and explicit completion with 完 from simply reporting a reading or repair event. Pronunciation notes distinguish huán/hái, liǎo/le and necessity děi from complement-linking de. No principal-example correction was necessary. The expanded past-repair lesson does not equate 修了 with guaranteed successful repair; its contrast explicitly introduces 修好.

## Primary source consultation

Existing key: [@oxford_mandarin_grammar2026]. No new keys or proposed BibTeX entries are needed. Existing bibliography metadata remains applicable:

- University of Oxford, Centre for Teaching Chinese as a Foreign Language, *Elementary Chinese Grammar*, 2011; [primary PDF](https://www.ctcfl.ox.ac.uk/media/pages/pdf/lang-work_grammar-database_grammar-database-for-hard-copy.pdf), passages read 2026-10-07.
- Printed pages 7–11: predicates, identification and descriptive/possessive 的; 13–21: questions, answer position and time expressions; 32–35: clock time and modal positioning; 36–44: ongoing actions, 着 and event 了; 56–60: volunteering 来, suggestions and sentence-final 了; 79–80: potential complements and liǎo; 81–87: comparisons, equal comparison and 把 placement; 96–99: paired conjunctions and condition/result order.

The passages cross-check forms and ordering, not the correctness of every original example or translation. Oxford's broad introductory restrictions are not promoted into universal rules. Original contexts, contrasts and exercises are model-authored; all provenance remains AI and needs_review. Attempts to read AllSet Grammar Wiki pages returned access errors and are not claimed as consulted sources or cited.

## Assessment alignment and verification

All eight existing assessment guidance documents were read without editing. No explicit exclusion of a taught valid form or contradictory semantic requirement was found. The lessons retain their distinctions between skill and prediction, desire and undertaking, acknowledgment and endorsement, factual confirmation and repair, direct location and destination, frequency and duration, event occurrence and completion, cause and evidence, and sequence and causation. They do not narrow valid assessment forms to the single taught example.

Local checks: all 16 YAML files parse; all 84 edition-specific sections preserve ordered IDs and principal examples against HEAD; each practice note contains an answer and a reason; exercises remain outside explanation fields; scoped git diff --check passes. Writes used sibling temporary files and atomic replacement; no temporary tooling files remain. Root runs integrated schema/content/fast checks and independent cross-review.

## Remaining review questions

No known blocking linguistic defect. Independent review should still check the naturalness of model-authored adaptations, Cantonese meanings and colloquial readings. In particular, contextual readings of 来, 会, 了 and 吧 are intentionally scoped to these exchanges rather than defined exhaustively. Neutral 很 and the contrast between event occurrence and a result complement require that same contextual reading; they are not claims that degree or completion can never be inferred.
