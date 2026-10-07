# English guide teaching expansion

Status: implemented authored-content draft, 2026-10-07. Independent linguistic
review remains pending. This report covers English target-language guides only;
integrated checks and production preview are owned by the coordinating pass.

## Scope and changes

Audited all 42 subskills in both existing explanation editions, English and
Cantonese: 16 YAML files, 84 section editions. No other explanation editions exist
under English. Retained the seven accepted pilot lessons as parsed teaching data;
rewrote the remaining 35 lessons in both editions. Every rewritten lesson opens
with a communicative meaning and plausible situation, works through the principal
example, explains an adaptation and a useful contrast, and includes a short task
with an explained answer. Discourse lessons teach a conversational move rather
than forcing a grammatical template onto it.

| Group | Sections audited | Result |
| --- | --- | --- |
| Information exchange | asking_information, answering_information, checking_facts, useful_detail | Retained question pilot; added short-answer choice, fact confirmation and landmark detail. |
| People and places | identification, qualities_states, location_movement, possession_relations, quantity_comparison | Added identification versus description, linking verbs, location versus movement, possessive owners, and productive comparisons/amounts. |
| Time and events | present_events, past_events, future_events, duration_frequency, event_sequence, event_phase | Added regular versus ongoing situations, irregular past/do support, arrangements, duration versus starting points, order and interrupted background. |
| Feelings and viewpoints | wants_intentions, preferences, emotions, opinions, agreement_disagreement | Added desire versus plan, ordered preferences, feelings versus experiences, excessive versus high degree, and agreement versus understanding. |
| Coordinating action | requests, offers_invitations, suggestions, commitments, accepting_declining, negotiating_plans | Added person/action ownership, invitation forms, proposal strength, promise context, clear refusals and specific counterproposals. |
| Possibilities and constraints | ability, permission, obligation, possibility, certainty | Reviewed and retained all five accepted pilot lessons. |
| Reasons and connections | causes_reasons, consequences, conditions, contrast, supporting_claims | Added reason/result order, noun versus statement complements, open future conditions, contrast alternatives and limits of observational support. |
| Managing conversation | opening_closing, acknowledging, clarification, rephrasing, correcting_misunderstanding, turns_topics | Retained clarification pilot; added closing context, receipt versus agreement, practical restatement, correction versus changed plans and requesting a turn. |

All shared principal example strings, subskill IDs/order and shared-guide references
are preserved. US-selected lessons use complete replacement lists only in People
and places and Time and events. They change three principal spellings:
`neighbour` to `neighbor`, `harbour` to `harbor`, and the verb `practise` to
`practice`. Associated inline worked forms change with them. UK/shared examples
retain their originals. These are orthographic adaptations, not corrections of
incorrect original examples or new regional grammar claims. No gratuitous regional
comparison is included, and each selected variety has identical target examples
across the two explanation editions. Other lessons remain shared.

Inline code marks actual English forms, including meaningful affixes. No formulas,
extra example blockquotes or level-three headings were introduced. Provenance now
describes the expansion and original exercises, retains existing sources and
`needs_review`, and does not claim independent validation.

## Sources and claim scope

The following primary teaching references were consulted on 2026-10-07. Prose,
worked adaptations and practice tasks are original editorial work. Source support
for a construction does not validate every original example, Cantonese rendering,
register judgement or pedagogical effectiveness. HTML review excludes reader
comments; PDF review uses extracted text rather than a rendered-page inspection.

| Key | Source / exact URL | Review and supported claim |
| --- | --- | --- |
| [@bcPresentSimpleTeaching20261007] | British Council, [Present simple](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-simple) | Teaching sections: third-person singular ending, do/does questions and negatives, regular/current situations. |
| [@bcPastContinuousTeaching20261007] | British Council, [Past continuous](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-continuous) | Teaching sections: was/were with an ongoing action, past background and another event during it. |
| [@bcFutureTeaching20261007] | British Council, [Talking about the future](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/talking-about-future) | Teaching sections: present continuous for arrangements, going to for intentions, will for decisions/predictions; context and overlapping uses. |
| [@bcPossessivesTeaching20261007] | British Council, [Possessives: nouns](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/possessives-nouns) | Teaching sections: singular possessive ending and apostrophe after regular plural ending. |
| [@bcComparativesTeaching20261007] | British Council, [Comparative and superlative adjectives](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/comparative-superlative-adjectives) | Teaching sections: comparative endings or more, and than introducing another compared item. |
| [@bcAgreementTeaching20261007] | British Council, [Agreeing and disagreeing](https://learnenglish.britishcouncil.org/free-resources/speaking/b1/agreeing-disagreeing) | Lesson transcript/phrases: understanding a view, qualified acceptance, explicit agreement and disagreement in conversation. |
| [@bcInfinitivesTeaching20261007] | British Council, [Verbs followed by -ing or infinitive](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/verbs-followed-ing-or-infinitive) | Teaching sections: plan, want and would like followed by a to-infinitive. The separately titled verbs-followed-infinitive page timed out and is not cited as read. |
| [@bbcPreferencesTeaching20261007] | BBC Learning English, [Preferences transcript](https://downloads.bbc.co.uk/learningenglish/features/learning_english_grammar/250902_Learning_English_Grammar__preferences_transcript.pdf), 2025 | Selected extracted explanation on PDF page 4: general prefer links nouns or -ing activities with to; contrasted future-specific would prefer. |
| [@bcDurationTeaching20261007] | British Council, [How long](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/how-long) | Teaching sections: for expresses duration; since supplies a starting point with present/past perfect. |
| [@bcConnectorsTeaching20261007] | British Council, [Grammar snacks: Conjunctions](https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_conjunctions_1.pdf) | Extracted teaching paragraphs, PDF pages 1–2: because gives reasons, so results, but/although contrast and and addition. Its broad warning about sentence-initial conjunctions was not adopted. |
| [@bbcBecauseTeaching20261007] | BBC Learning English, [Because / because of tables](https://downloads.bbc.co.uk/worldservice/learningenglish/grammarchallenge/pdfs/10_because_table.pdf), 2007 | Full extracted one-page table: because introduces subject/verb, while because of takes a noun phrase or -ing expression. |

Also re-read the existing British Council conditional reference
[@bc_conditionals2026] for the narrow open-future example. Existing pilot references
remain attached to the retained lessons. General CEFR and dialogue-act sources
remain historical functional provenance, not proof of the new lexical/grammar
details. Cambridge prefer reference and dictionary URLs could not be retrieved;
the BBC transcript supplies the preference construction instead.

## Verification and remaining review

Local YAML parsing and round-trip parsing passed for all 16 files. Parsed comparison
against HEAD confirmed all 84 shared principal examples and subskill order, and all
14 pilot section editions, remain unchanged. All four replacement lists are complete;
selected US/UK target-example parity across editions passed. Markdown checks found
no extra blockquotes or level-three headings and no unbalanced inline delimiters.
Scoped diff whitespace check passed. Root will run the integrated fast/content gates
and preview after the other language work lands; this report does not claim those
passes or a running native-app check.

There are no known blocking linguistic questions in these narrow English lessons.
Independent review should check original conversational naturalness/politeness,
Cantonese teaching terminology and semantic equivalence, and whether the shared
lexical choices suit both selected varieties. The US replacement is limited to
standard spelling differences; it does not pretend to model every local accent or
usage. Live reading assistance and speech remain a separate application verification.
No assessment, runtime, persistence, skill identity or migration behavior changed.
No commit or deployment was performed.
