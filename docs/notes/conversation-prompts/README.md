> Historical conversation-23 reference below. Current runtime: English Relationship instructions (`conversation-37-relationship-english`), temperature 1.1. See [adoption record](relationship-adoption-2026-09-20.md) and [tools resume guide](../../../tools/benchmarks/conversation-prompts/README.md).

# Conversation prompts: approved CEFR references

Status: approved wording implemented in source as `conversation-23`. Changes remain
uncommitted. Source/build verification does not establish live model compliance.
The previous `conversation-21` edit was provisional and is superseded.

## Implemented behavior

| Existing setting | Approved reference | Partner guidance |
| --- | --- | --- |
| Absolute Zero | Pre-A1 | No previous experience; first-page language; one short, simple sentence |
| Beginner | A1–A2 | Some basic knowledge; one short, simple sentence; no stacked clauses |
| Intermediate | B1–B2 | Connected everyday language and supported discussion |
| Advanced | C1 | Nuanced, flexible exchanges and reasoned perspectives |
| Fluent | C2 | Natural idiom, implication and register without forced verbosity |

The five difficulty blocks implement the user-reviewed wording, prefixed with
these reference labels. These are behavior references, not assessed learner levels.
The low-level single-sentence limits are user-approved product constraints, not
CEFR sentence quotas. There is no numeric word limit. [@cefr2020]

Shared opening and response instructions explicitly obey those limits. Absolute
Zero requires a specific, answerable first-lesson contribution or question; a greeting
alone is insufficient. It does not demand an elaborate setup. Beginner chooses one observation, opinion or question, without requiring a
statement plus question. Higher levels can develop a contribution. Difficulty also
takes priority over persona complexity and selected time-reference guidance.
Questioning and follow-up guidance draws on [@british_council_asking_questions]
and [@british_council_lower_level_fluency], adapted to the approved level constraints.

Only the selected difficulty block is sent in an actual request. Existing UI labels,
settings, serialized contracts, reading assistance and emoji cleanup are unchanged.

## Exact prompt snapshots

The active file is `content/prompts/conversation/instructions.yaml`. The YAML files
in this folder preserve full content for versions 20, 21, 22 and 23. Version 23 is the
approved implementation; earlier snapshots are historical, not configuration inputs.
They preserve authored content, not persona/language-specific compiled requests.
Actual accepted turns capture their assembled prompt and version in workspace data.

## Verification and remaining work

Passed language/content validation (28 configuration tests), generated-contract
checks, two prompt-composition tests, five opening-execution tests, native build
and `git diff --check`. No live model evaluation
has been performed for this revision. The earlier proposed 40-call evaluation is
not part of this implementation: its call/cost bound remains to be agreed before
execution. Live review must use the approved limits above and must check that
Absolute Zero remains accessible while offering something beyond a bare greeting.

## Research boundaries

Primary sources reviewed: Council of Europe interaction scales (not the entire
volume); Steve Darn and Funda Çetin's TeachingEnglish article, including its
Effective questioning checklist; Clare Lavery's A2 fluency activities. See
`references.bib` for URLs, review scope and claims.

No source guarantees AI compliance. Sentence budgets, persona contributions and
opening exclusions are SkellySpeak design decisions. True Pre-A1 may need visual,
translation or other support beyond partner prose; do not promise effortless
unassisted conversation or change reading assistance implicitly.


## Greeting-only correction

After an observed `Hola.` opening, the user requested retaining Gemini 2.5 Flash
and fixing the prompt. Version 23 removes the greeting-only exception from both
Absolute Zero and shared opening instructions. One short, simple sentence remains
the limit; no second sentence, word quota, fixed example dialogue, model change or
new response-rejection rule was introduced.
