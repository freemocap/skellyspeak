# Spanish teaching-guide expansion — 2026-10-07

Status: implemented authored-content revision; independent linguistic review pending.
This continues the approved [teaching audit](skill-guide-teaching-audit-2026-10-07.md),
whose selected-variety and explanatory-opening sections supersede its earlier pilots.

## Scope and implemented content

Audited all 42 subskills in all three existing explanation editions (English,
Spanish and Cantonese): 24 files, 126 section instances. Existing substantial
English/Cantonese asking-information and five possibility/constraint pilot lessons
were retained. Their Spanish-explanation counterparts required full expansion.
The remaining 36 subskills were expanded in every edition.

| Group | Audited subskills |
| --- | --- |
| people-places | identification, qualities_states, location_movement, possession_relations, quantity_comparison |
| time-events | present_events, past_events, future_events, duration_frequency, event_sequence, event_phase |
| information-exchange | asking_information, answering_information, checking_facts, useful_detail |
| coordinating-action | requests, offers_invitations, suggestions, commitments, accepting_declining, negotiating_plans |
| possibilities-constraints | ability, permission, obligation, possibility, certainty |
| feelings-viewpoints | wants_intentions, preferences, emotions, opinions, agreement_disagreement |
| reasons-connections | causes_reasons, consequences, conditions, contrast, supporting_claims |
| managing-conversation | opening_closing, acknowledging, clarification, rephrasing, correcting_misunderstanding, turns_topics |

The lessons introduce a conversational purpose before explaining the relevant
Spanish expression. Principal examples now receive a grammatical and pragmatic
unpacking rather than a translation alone. Adaptations show how to change person,
number, place, time or action; a useful distinction or error accompanies a short
practice item and explained answer. The prose was authored independently; source
grammar claims inform the explanations without copying teaching text.

Specific repairs include agreement around gustar; the difference between a
requirement and lack of obligation; a desire versus a promise; short answers tied
to their actual questions; location versus direction; possessives agreeing with
the possessed object; open conditions rather than guaranteed outcomes; and an
inference whose supporting observation is not proof. Past-event lessons now explain
completed versus habitual readings without unrelated assessment commentary.
The sequence example explicitly explains the present/preterite ambiguity of
cenamos and salimos instead of silently treating them as uniquely past forms.

Shared lessons teach forms valid in both selected Spain and Mexico profiles.
No paired regional lesson, extra variety replacement, assessment change, runtime
change or principal-example correction was needed. Inline code marks actual
Spanish forms only. All IDs, section order, principal text strings, variety
declarations and existing provenance sources remain. Newly reviewed sources were
added only to relevant groups. Every review status remains needs_review.

## Primary references reviewed

Existing entries reused: [@yepesSaberTeaching20261007],
[@yepesQuestionsTeaching20261007], [@yepesSubjunctiveTeaching20261007],
[@yepesConditions20260924] and existing copula/possessive/future/thanks references.
The online full text of the first four was inspected in this pass. New entries
below were sent to the coordinating agent for inclusion in references.bib.
All are Enrique Yepes, Spanish Tools Online Grammar Book / practice, Bowdoin;
reviewed 2026-10-07. They support particular grammatical claims, not independent
certification of the authored examples, exercises or Cantonese translations.

| Key | URL | Review and supported claim |
| --- | --- | --- |
| [@yepesParticiplesTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/ats/26.htm | Full text: adjectival participles agree with their nouns; estar plus adjectival participle describes state; abrir has abierto. Used in people-places and supporting-claims. |
| [@yepesStemChangesTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/ats/18.htm | Full text: present stem changes of querer and poder; nosotros forms retain the base stem. Used in wants, requests and suggestions. |
| [@yepesGustarTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/ats/39.htm | Full text: the liked thing is the grammatical subject and the experiencer is an indirect object; plural noun versus singular infinitive agreement. Used in preferences. |
| [@yepesPreteriteTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/ats/28.htm | Form tables inspected: ir has fui/fue; regular nosotros preterite forms support the cenamos/salimos ambiguity. Used in time-events. |
| [@yepesPresentTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/present.htm | Full text: Spanish simple present can also express actions in progress; English progressive wording does not require a Spanish progressive. Used in present-events. |
| [@yepesGerundTeaching20261007] | https://learn.bowdoin.edu/spanish-grammar/newgr/ats/27.htm | Full text: estar plus gerund for actions in progress; invariant gerunds; infinitives after prepositions. Used in ongoing events, thanks and invitations. |

## Verification and remaining review

Local YAML parsing succeeded for all 24 files. A parsed comparison against HEAD
confirmed principal example text and ordered subskill IDs were unchanged in every
edition. All sections include worked explanations and marked adaptation/practice
content. Whitespace diff checking passed for the Spanish guide folder.
The coordinator owns integrated content/schema checks, the final fast gate and
rendering review; these local checks are not a running-app or linguistic result.

Remaining review is specific: confirm naturalness and register of each Spanish
example and alternative within both declared profiles, and have a Cantonese reader
review the grammatical terminology (particularly gerund versus participle). The
shared examples avoid second-person plural distinctions and relative recent-past
preferences, so no unsupported uniform regional rule was introduced. English
translations of context-sensitive subjectless Spanish clauses are made explicit
where needed; they do not imply that Spanish encodes an unspecified person's
gender. No source claims to validate all original principal examples.

No commit, deployment or live provider request performed.
