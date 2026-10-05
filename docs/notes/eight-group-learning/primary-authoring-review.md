# Required language catalog review

Source implementation and offline verification, 2026-10-04. Work completed in the primary chat.

## Scope and result

All 20 target languages have eight assessment documents and eight English learner guides. Required coverage is 328 documents including eight shared English explanations. The language guides contain 840 subskill sections and 888 original examples. Optional bundled translations remain separate: 320 documents are not pre-authored.

The primary chat completed 208 documents for the 13 languages listed below and reviewed the Italian, Portuguese and Greek batches against the worked pattern. All newly authored material remains AI-authored and needs_review; source consultation and structural checks are not independent linguistic certification. No paid model calls were made.

## Editorial findings

- German: ambiguity between two valid functions within the possibilities/constraints group does not make group use unclear. The assessment and its specimen were corrected.
- Hindi: clarified the distinction between an imperative request and an information question.
- Korean: corrected a route-number example to use 2번.
- Mandarin: removed an accidental English insertion in Chinese guidance.
- Vietnamese: corrected an accidental mixed-language fragment in English assessment prose.
- Arabic: supplied distinct Modern Standard and Levantine assessment supplements. Every guide section has explicitly labeled examples for both varieties. Levantine examples use conversational forms without formal case endings; regional alternatives remain valid. The guide schema currently shares sections across varieties, so both labeled examples are visible. It does not filter examples by selected variety.

## Source and composition review

Each document names its consulted references through provenance.sources and references.bib. Only accessible passages actually read were cited; unavailable resources were not represented as consulted. References support specific constructions, not certification of every original example. Arabic's sources focus on Levantine; its Modern Standard examples remain AI-authored pending independent review.

The actual native audit-content --request path produced ten-question assessment specimens: eight skills, grammar and understandability. Each specimen includes complete state, questions and 25 source fingerprints verified against current source bytes. All 19 saved specimens matched current fingerprints at final review. Learner-guide documents are not injected into these assessments. Language-specific assessment guidance and the selected variety supplement are injected. No XP is computed by the model request.

Each new guide's section order was checked against its shared subskill file. Examples were checked for accidental bold Markdown. The requests were composed offline, without calling Jev or testing live scoring.

## Exact authored files

Paths below are repository-relative. Each row identifies the separate runtime assessment source and learner-guide source; no concatenated mega-document is used at runtime.

### hindi

| Assessment | English learner guide |
| --- | --- |
| `content/languages/hindi/skills/coordinating-action/hindi-coordinating-action-assessment.yaml` | `content/languages/hindi/skills/coordinating-action/hindi-coordinating-action-explained-in-english.yaml` |
| `content/languages/hindi/skills/feelings-viewpoints/hindi-feelings-viewpoints-assessment.yaml` | `content/languages/hindi/skills/feelings-viewpoints/hindi-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/hindi/skills/information-exchange/hindi-information-exchange-assessment.yaml` | `content/languages/hindi/skills/information-exchange/hindi-information-exchange-explained-in-english.yaml` |
| `content/languages/hindi/skills/managing-conversation/hindi-managing-conversation-assessment.yaml` | `content/languages/hindi/skills/managing-conversation/hindi-managing-conversation-explained-in-english.yaml` |
| `content/languages/hindi/skills/people-places/hindi-people-places-assessment.yaml` | `content/languages/hindi/skills/people-places/hindi-people-places-explained-in-english.yaml` |
| `content/languages/hindi/skills/possibilities-constraints/hindi-possibilities-constraints-assessment.yaml` | `content/languages/hindi/skills/possibilities-constraints/hindi-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/hindi/skills/reasons-connections/hindi-reasons-connections-assessment.yaml` | `content/languages/hindi/skills/reasons-connections/hindi-reasons-connections-explained-in-english.yaml` |
| `content/languages/hindi/skills/time-events/hindi-time-events-assessment.yaml` | `content/languages/hindi/skills/time-events/hindi-time-events-explained-in-english.yaml` |

### indonesian

| Assessment | English learner guide |
| --- | --- |
| `content/languages/indonesian/skills/coordinating-action/indonesian-coordinating-action-assessment.yaml` | `content/languages/indonesian/skills/coordinating-action/indonesian-coordinating-action-explained-in-english.yaml` |
| `content/languages/indonesian/skills/feelings-viewpoints/indonesian-feelings-viewpoints-assessment.yaml` | `content/languages/indonesian/skills/feelings-viewpoints/indonesian-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/indonesian/skills/information-exchange/indonesian-information-exchange-assessment.yaml` | `content/languages/indonesian/skills/information-exchange/indonesian-information-exchange-explained-in-english.yaml` |
| `content/languages/indonesian/skills/managing-conversation/indonesian-managing-conversation-assessment.yaml` | `content/languages/indonesian/skills/managing-conversation/indonesian-managing-conversation-explained-in-english.yaml` |
| `content/languages/indonesian/skills/people-places/indonesian-people-places-assessment.yaml` | `content/languages/indonesian/skills/people-places/indonesian-people-places-explained-in-english.yaml` |
| `content/languages/indonesian/skills/possibilities-constraints/indonesian-possibilities-constraints-assessment.yaml` | `content/languages/indonesian/skills/possibilities-constraints/indonesian-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/indonesian/skills/reasons-connections/indonesian-reasons-connections-assessment.yaml` | `content/languages/indonesian/skills/reasons-connections/indonesian-reasons-connections-explained-in-english.yaml` |
| `content/languages/indonesian/skills/time-events/indonesian-time-events-assessment.yaml` | `content/languages/indonesian/skills/time-events/indonesian-time-events-explained-in-english.yaml` |

### japanese

| Assessment | English learner guide |
| --- | --- |
| `content/languages/japanese/skills/coordinating-action/japanese-coordinating-action-assessment.yaml` | `content/languages/japanese/skills/coordinating-action/japanese-coordinating-action-explained-in-english.yaml` |
| `content/languages/japanese/skills/feelings-viewpoints/japanese-feelings-viewpoints-assessment.yaml` | `content/languages/japanese/skills/feelings-viewpoints/japanese-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/japanese/skills/information-exchange/japanese-information-exchange-assessment.yaml` | `content/languages/japanese/skills/information-exchange/japanese-information-exchange-explained-in-english.yaml` |
| `content/languages/japanese/skills/managing-conversation/japanese-managing-conversation-assessment.yaml` | `content/languages/japanese/skills/managing-conversation/japanese-managing-conversation-explained-in-english.yaml` |
| `content/languages/japanese/skills/people-places/japanese-people-places-assessment.yaml` | `content/languages/japanese/skills/people-places/japanese-people-places-explained-in-english.yaml` |
| `content/languages/japanese/skills/possibilities-constraints/japanese-possibilities-constraints-assessment.yaml` | `content/languages/japanese/skills/possibilities-constraints/japanese-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/japanese/skills/reasons-connections/japanese-reasons-connections-assessment.yaml` | `content/languages/japanese/skills/reasons-connections/japanese-reasons-connections-explained-in-english.yaml` |
| `content/languages/japanese/skills/time-events/japanese-time-events-assessment.yaml` | `content/languages/japanese/skills/time-events/japanese-time-events-explained-in-english.yaml` |

### korean

| Assessment | English learner guide |
| --- | --- |
| `content/languages/korean/skills/coordinating-action/korean-coordinating-action-assessment.yaml` | `content/languages/korean/skills/coordinating-action/korean-coordinating-action-explained-in-english.yaml` |
| `content/languages/korean/skills/feelings-viewpoints/korean-feelings-viewpoints-assessment.yaml` | `content/languages/korean/skills/feelings-viewpoints/korean-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/korean/skills/information-exchange/korean-information-exchange-assessment.yaml` | `content/languages/korean/skills/information-exchange/korean-information-exchange-explained-in-english.yaml` |
| `content/languages/korean/skills/managing-conversation/korean-managing-conversation-assessment.yaml` | `content/languages/korean/skills/managing-conversation/korean-managing-conversation-explained-in-english.yaml` |
| `content/languages/korean/skills/people-places/korean-people-places-assessment.yaml` | `content/languages/korean/skills/people-places/korean-people-places-explained-in-english.yaml` |
| `content/languages/korean/skills/possibilities-constraints/korean-possibilities-constraints-assessment.yaml` | `content/languages/korean/skills/possibilities-constraints/korean-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/korean/skills/reasons-connections/korean-reasons-connections-assessment.yaml` | `content/languages/korean/skills/reasons-connections/korean-reasons-connections-explained-in-english.yaml` |
| `content/languages/korean/skills/time-events/korean-time-events-assessment.yaml` | `content/languages/korean/skills/time-events/korean-time-events-explained-in-english.yaml` |

### mandarin

| Assessment | English learner guide |
| --- | --- |
| `content/languages/mandarin/skills/coordinating-action/mandarin-coordinating-action-assessment.yaml` | `content/languages/mandarin/skills/coordinating-action/mandarin-coordinating-action-explained-in-english.yaml` |
| `content/languages/mandarin/skills/feelings-viewpoints/mandarin-feelings-viewpoints-assessment.yaml` | `content/languages/mandarin/skills/feelings-viewpoints/mandarin-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/mandarin/skills/information-exchange/mandarin-information-exchange-assessment.yaml` | `content/languages/mandarin/skills/information-exchange/mandarin-information-exchange-explained-in-english.yaml` |
| `content/languages/mandarin/skills/managing-conversation/mandarin-managing-conversation-assessment.yaml` | `content/languages/mandarin/skills/managing-conversation/mandarin-managing-conversation-explained-in-english.yaml` |
| `content/languages/mandarin/skills/people-places/mandarin-people-places-assessment.yaml` | `content/languages/mandarin/skills/people-places/mandarin-people-places-explained-in-english.yaml` |
| `content/languages/mandarin/skills/possibilities-constraints/mandarin-possibilities-constraints-assessment.yaml` | `content/languages/mandarin/skills/possibilities-constraints/mandarin-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/mandarin/skills/reasons-connections/mandarin-reasons-connections-assessment.yaml` | `content/languages/mandarin/skills/reasons-connections/mandarin-reasons-connections-explained-in-english.yaml` |
| `content/languages/mandarin/skills/time-events/mandarin-time-events-assessment.yaml` | `content/languages/mandarin/skills/time-events/mandarin-time-events-explained-in-english.yaml` |

### russian

| Assessment | English learner guide |
| --- | --- |
| `content/languages/russian/skills/coordinating-action/russian-coordinating-action-assessment.yaml` | `content/languages/russian/skills/coordinating-action/russian-coordinating-action-explained-in-english.yaml` |
| `content/languages/russian/skills/feelings-viewpoints/russian-feelings-viewpoints-assessment.yaml` | `content/languages/russian/skills/feelings-viewpoints/russian-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/russian/skills/information-exchange/russian-information-exchange-assessment.yaml` | `content/languages/russian/skills/information-exchange/russian-information-exchange-explained-in-english.yaml` |
| `content/languages/russian/skills/managing-conversation/russian-managing-conversation-assessment.yaml` | `content/languages/russian/skills/managing-conversation/russian-managing-conversation-explained-in-english.yaml` |
| `content/languages/russian/skills/people-places/russian-people-places-assessment.yaml` | `content/languages/russian/skills/people-places/russian-people-places-explained-in-english.yaml` |
| `content/languages/russian/skills/possibilities-constraints/russian-possibilities-constraints-assessment.yaml` | `content/languages/russian/skills/possibilities-constraints/russian-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/russian/skills/reasons-connections/russian-reasons-connections-assessment.yaml` | `content/languages/russian/skills/reasons-connections/russian-reasons-connections-explained-in-english.yaml` |
| `content/languages/russian/skills/time-events/russian-time-events-assessment.yaml` | `content/languages/russian/skills/time-events/russian-time-events-explained-in-english.yaml` |

### ukrainian

| Assessment | English learner guide |
| --- | --- |
| `content/languages/ukrainian/skills/coordinating-action/ukrainian-coordinating-action-assessment.yaml` | `content/languages/ukrainian/skills/coordinating-action/ukrainian-coordinating-action-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/feelings-viewpoints/ukrainian-feelings-viewpoints-assessment.yaml` | `content/languages/ukrainian/skills/feelings-viewpoints/ukrainian-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/information-exchange/ukrainian-information-exchange-assessment.yaml` | `content/languages/ukrainian/skills/information-exchange/ukrainian-information-exchange-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/managing-conversation/ukrainian-managing-conversation-assessment.yaml` | `content/languages/ukrainian/skills/managing-conversation/ukrainian-managing-conversation-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/people-places/ukrainian-people-places-assessment.yaml` | `content/languages/ukrainian/skills/people-places/ukrainian-people-places-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/possibilities-constraints/ukrainian-possibilities-constraints-assessment.yaml` | `content/languages/ukrainian/skills/possibilities-constraints/ukrainian-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/reasons-connections/ukrainian-reasons-connections-assessment.yaml` | `content/languages/ukrainian/skills/reasons-connections/ukrainian-reasons-connections-explained-in-english.yaml` |
| `content/languages/ukrainian/skills/time-events/ukrainian-time-events-assessment.yaml` | `content/languages/ukrainian/skills/time-events/ukrainian-time-events-explained-in-english.yaml` |

### turkish

| Assessment | English learner guide |
| --- | --- |
| `content/languages/turkish/skills/coordinating-action/turkish-coordinating-action-assessment.yaml` | `content/languages/turkish/skills/coordinating-action/turkish-coordinating-action-explained-in-english.yaml` |
| `content/languages/turkish/skills/feelings-viewpoints/turkish-feelings-viewpoints-assessment.yaml` | `content/languages/turkish/skills/feelings-viewpoints/turkish-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/turkish/skills/information-exchange/turkish-information-exchange-assessment.yaml` | `content/languages/turkish/skills/information-exchange/turkish-information-exchange-explained-in-english.yaml` |
| `content/languages/turkish/skills/managing-conversation/turkish-managing-conversation-assessment.yaml` | `content/languages/turkish/skills/managing-conversation/turkish-managing-conversation-explained-in-english.yaml` |
| `content/languages/turkish/skills/people-places/turkish-people-places-assessment.yaml` | `content/languages/turkish/skills/people-places/turkish-people-places-explained-in-english.yaml` |
| `content/languages/turkish/skills/possibilities-constraints/turkish-possibilities-constraints-assessment.yaml` | `content/languages/turkish/skills/possibilities-constraints/turkish-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/turkish/skills/reasons-connections/turkish-reasons-connections-assessment.yaml` | `content/languages/turkish/skills/reasons-connections/turkish-reasons-connections-explained-in-english.yaml` |
| `content/languages/turkish/skills/time-events/turkish-time-events-assessment.yaml` | `content/languages/turkish/skills/time-events/turkish-time-events-explained-in-english.yaml` |

### vietnamese

| Assessment | English learner guide |
| --- | --- |
| `content/languages/vietnamese/skills/coordinating-action/vietnamese-coordinating-action-assessment.yaml` | `content/languages/vietnamese/skills/coordinating-action/vietnamese-coordinating-action-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/feelings-viewpoints/vietnamese-feelings-viewpoints-assessment.yaml` | `content/languages/vietnamese/skills/feelings-viewpoints/vietnamese-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/information-exchange/vietnamese-information-exchange-assessment.yaml` | `content/languages/vietnamese/skills/information-exchange/vietnamese-information-exchange-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/managing-conversation/vietnamese-managing-conversation-assessment.yaml` | `content/languages/vietnamese/skills/managing-conversation/vietnamese-managing-conversation-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/people-places/vietnamese-people-places-assessment.yaml` | `content/languages/vietnamese/skills/people-places/vietnamese-people-places-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/possibilities-constraints/vietnamese-possibilities-constraints-assessment.yaml` | `content/languages/vietnamese/skills/possibilities-constraints/vietnamese-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/reasons-connections/vietnamese-reasons-connections-assessment.yaml` | `content/languages/vietnamese/skills/reasons-connections/vietnamese-reasons-connections-explained-in-english.yaml` |
| `content/languages/vietnamese/skills/time-events/vietnamese-time-events-assessment.yaml` | `content/languages/vietnamese/skills/time-events/vietnamese-time-events-explained-in-english.yaml` |

### thai

| Assessment | English learner guide |
| --- | --- |
| `content/languages/thai/skills/coordinating-action/thai-coordinating-action-assessment.yaml` | `content/languages/thai/skills/coordinating-action/thai-coordinating-action-explained-in-english.yaml` |
| `content/languages/thai/skills/feelings-viewpoints/thai-feelings-viewpoints-assessment.yaml` | `content/languages/thai/skills/feelings-viewpoints/thai-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/thai/skills/information-exchange/thai-information-exchange-assessment.yaml` | `content/languages/thai/skills/information-exchange/thai-information-exchange-explained-in-english.yaml` |
| `content/languages/thai/skills/managing-conversation/thai-managing-conversation-assessment.yaml` | `content/languages/thai/skills/managing-conversation/thai-managing-conversation-explained-in-english.yaml` |
| `content/languages/thai/skills/people-places/thai-people-places-assessment.yaml` | `content/languages/thai/skills/people-places/thai-people-places-explained-in-english.yaml` |
| `content/languages/thai/skills/possibilities-constraints/thai-possibilities-constraints-assessment.yaml` | `content/languages/thai/skills/possibilities-constraints/thai-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/thai/skills/reasons-connections/thai-reasons-connections-assessment.yaml` | `content/languages/thai/skills/reasons-connections/thai-reasons-connections-explained-in-english.yaml` |
| `content/languages/thai/skills/time-events/thai-time-events-assessment.yaml` | `content/languages/thai/skills/time-events/thai-time-events-explained-in-english.yaml` |

### irish

| Assessment | English learner guide |
| --- | --- |
| `content/languages/irish/skills/coordinating-action/irish-coordinating-action-assessment.yaml` | `content/languages/irish/skills/coordinating-action/irish-coordinating-action-explained-in-english.yaml` |
| `content/languages/irish/skills/feelings-viewpoints/irish-feelings-viewpoints-assessment.yaml` | `content/languages/irish/skills/feelings-viewpoints/irish-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/irish/skills/information-exchange/irish-information-exchange-assessment.yaml` | `content/languages/irish/skills/information-exchange/irish-information-exchange-explained-in-english.yaml` |
| `content/languages/irish/skills/managing-conversation/irish-managing-conversation-assessment.yaml` | `content/languages/irish/skills/managing-conversation/irish-managing-conversation-explained-in-english.yaml` |
| `content/languages/irish/skills/people-places/irish-people-places-assessment.yaml` | `content/languages/irish/skills/people-places/irish-people-places-explained-in-english.yaml` |
| `content/languages/irish/skills/possibilities-constraints/irish-possibilities-constraints-assessment.yaml` | `content/languages/irish/skills/possibilities-constraints/irish-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/irish/skills/reasons-connections/irish-reasons-connections-assessment.yaml` | `content/languages/irish/skills/reasons-connections/irish-reasons-connections-explained-in-english.yaml` |
| `content/languages/irish/skills/time-events/irish-time-events-assessment.yaml` | `content/languages/irish/skills/time-events/irish-time-events-explained-in-english.yaml` |

### malayalam

| Assessment | English learner guide |
| --- | --- |
| `content/languages/malayalam/skills/coordinating-action/malayalam-coordinating-action-assessment.yaml` | `content/languages/malayalam/skills/coordinating-action/malayalam-coordinating-action-explained-in-english.yaml` |
| `content/languages/malayalam/skills/feelings-viewpoints/malayalam-feelings-viewpoints-assessment.yaml` | `content/languages/malayalam/skills/feelings-viewpoints/malayalam-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/malayalam/skills/information-exchange/malayalam-information-exchange-assessment.yaml` | `content/languages/malayalam/skills/information-exchange/malayalam-information-exchange-explained-in-english.yaml` |
| `content/languages/malayalam/skills/managing-conversation/malayalam-managing-conversation-assessment.yaml` | `content/languages/malayalam/skills/managing-conversation/malayalam-managing-conversation-explained-in-english.yaml` |
| `content/languages/malayalam/skills/people-places/malayalam-people-places-assessment.yaml` | `content/languages/malayalam/skills/people-places/malayalam-people-places-explained-in-english.yaml` |
| `content/languages/malayalam/skills/possibilities-constraints/malayalam-possibilities-constraints-assessment.yaml` | `content/languages/malayalam/skills/possibilities-constraints/malayalam-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/malayalam/skills/reasons-connections/malayalam-reasons-connections-assessment.yaml` | `content/languages/malayalam/skills/reasons-connections/malayalam-reasons-connections-explained-in-english.yaml` |
| `content/languages/malayalam/skills/time-events/malayalam-time-events-assessment.yaml` | `content/languages/malayalam/skills/time-events/malayalam-time-events-explained-in-english.yaml` |

### arabic

| Assessment | English learner guide |
| --- | --- |
| `content/languages/arabic/skills/coordinating-action/arabic-coordinating-action-assessment.yaml` | `content/languages/arabic/skills/coordinating-action/arabic-coordinating-action-explained-in-english.yaml` |
| `content/languages/arabic/skills/feelings-viewpoints/arabic-feelings-viewpoints-assessment.yaml` | `content/languages/arabic/skills/feelings-viewpoints/arabic-feelings-viewpoints-explained-in-english.yaml` |
| `content/languages/arabic/skills/information-exchange/arabic-information-exchange-assessment.yaml` | `content/languages/arabic/skills/information-exchange/arabic-information-exchange-explained-in-english.yaml` |
| `content/languages/arabic/skills/managing-conversation/arabic-managing-conversation-assessment.yaml` | `content/languages/arabic/skills/managing-conversation/arabic-managing-conversation-explained-in-english.yaml` |
| `content/languages/arabic/skills/people-places/arabic-people-places-assessment.yaml` | `content/languages/arabic/skills/people-places/arabic-people-places-explained-in-english.yaml` |
| `content/languages/arabic/skills/possibilities-constraints/arabic-possibilities-constraints-assessment.yaml` | `content/languages/arabic/skills/possibilities-constraints/arabic-possibilities-constraints-explained-in-english.yaml` |
| `content/languages/arabic/skills/reasons-connections/arabic-reasons-connections-assessment.yaml` | `content/languages/arabic/skills/reasons-connections/arabic-reasons-connections-explained-in-english.yaml` |
| `content/languages/arabic/skills/time-events/arabic-time-events-assessment.yaml` | `content/languages/arabic/skills/time-events/arabic-time-events-explained-in-english.yaml` |

## Verification

- content:check: passed; zero required files missing, 320 optional bundled translations missing.
- audit-content --ready: passed.
- check:fast: passed after all 208 new source documents were written.
- Native Clippy --lib --tests -- -D warnings: passed.
- Full native library tests: 822 passed, 0 failed, 5 ignored. Two tests now remove a guide from their in-memory fixture explicitly; production content is complete.
- Final configuration regression rerun after the Arabic learner-note edit: 66 passed. An overlapping attempt initially hit a Windows executable lock; the sequential rerun passed.
- Documentation links: passed.

## Running-app check

Select one newly populated language, open several skill guides, ask the coach about a section and start a conversation from an example. Check both Arabic varieties: examples are labeled and assessment guidance must match the selected variety. With Spanish or Arabic explanations selected, exercise an unbundled guide translation and then reopen it to check the cache. Send a message and confirm automatic coaching appears without opening analysis; inspect the assessment details for the eight groups. These live checks remain user verification, not completed automated results.
