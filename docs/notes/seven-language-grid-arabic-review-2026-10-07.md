# Arabic explanation column: independent teaching review

## Scope and status

Implemented review on 2026-10-07. I compared the eight Arabic shared skill files and all 56 Arabic target guide files with their current English editions: 42 core subskills for each of seven targets, plus the English-US, French-Canada, and Arabic-Levantine branches. I read explanations, meanings, and worked notes, checking the learner context, person and time reference, grammatical distinction, and practice answer. This is an AI editorial review, not native-speaker certification. Existing `needs_review` values remain.

The review introduced no new references. It changed Arabic explanation prose only. The target example text, marked target fragments, IDs, section order, varieties, sources, and provenance were left intact.

## Corrections

| Arabic explanation file under `content/languages/` | Correction |
| --- | --- |
| `arabic/skills/people-places/arabic-people-places-explained-in-arabic.yaml` | Named the Standard Arabic dual `كُرْسِيَّانِ` with its nominative form. |
| `cantonese/skills/possibilities-constraints/cantonese-possibilities-constraints-explained-in-arabic.yaml` | Kept the unmarked `佢` reference singular in the uncertainty contrast. |
| `cantonese/skills/reasons-connections/cantonese-reasons-connections-explained-in-arabic.yaml` | Kept the rain consequence's unmarked time reference and rendered `地鐵站` as a metro station. |
| `french/skills/coordinating-action/french-coordinating-action-explained-in-arabic.yaml` | Made the speaker's group, not the invited friend, issue the market invitation in both French varieties; improved the gratitude description in both accepting/declining branches. |
| `french/skills/feelings-viewpoints/french-feelings-viewpoints-explained-in-arabic.yaml` | Rendered `trop étroit` as too narrow rather than merely very narrow in both varieties. |
| `french/skills/time-events/french-time-events-explained-in-arabic.yaml` | Kept `nos places` as our seats in both varieties. |
| `portuguese/skills/feelings-viewpoints/portuguese-feelings-viewpoints-explained-in-arabic.yaml` | Corrected the worked substitution to replace tables with chairs, rather than the reverse. |
| `spanish/skills/feelings-viewpoints/spanish-feelings-viewpoints-explained-in-arabic.yaml` | Identified the Spanish `subjuntivo` without equating it universally with one Arabic verbal mood. |
| `spanish/skills/managing-conversation/spanish-managing-conversation-explained-in-arabic.yaml` | Corrected the person doing the thanking and an Arabic agreement error in the farewell description. |
| `spanish/skills/people-places/spanish-people-places-explained-in-arabic.yaml` | Matched the feminine Spanish `abierta` in its Arabic word gloss. |
| `spanish/skills/possibilities-constraints/spanish-possibilities-constraints-explained-in-arabic.yaml` | Used the scoped `subjuntivo` label and corrected the Arabic rain exercise prompt. |
| `spanish/skills/time-events/spanish-time-events-explained-in-arabic.yaml` | Clarified preterite as Spanish simple past and named the Spanish `gerundio` instead of an inaccurate Arabic participle label. |

## Verification

`node docs/notes/seven-language-grid-audit.ts --partial` passed on the complete 392-file grid and checked 2,548 sections, including preserved target examples and marked fragments. `git diff --check` and `npm run check:fast` passed. Root integration will refresh the affected rendered guides and run final gates. No human native review was performed.
