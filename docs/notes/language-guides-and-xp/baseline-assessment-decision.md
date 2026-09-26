# Baseline B assessment strategy

Status: **adopted by the user**, 2026-09-24. The prompt-strategy investigation is
complete. This selects the strategy for forthcoming implementation; it does not
claim the new evaluator or XP system is running in the app.

## Decision and evidence

Proceed with baseline B. The user considers the observed approximately 85–87%
agreement sufficient for development. The final multilingual experiment covers
two skills, 48 cases per language and two repetitions across Spanish, Levantine
Arabic and Mandarin Chinese. Baseline agreement was 86.98%, 85.94% and 86.46%.
References and translations are provisional. No pooled candidate contrast
established improvement over B; this does not establish equivalence or general
accuracy across the whole catalog.

The [completed report](jev-multilingual-2026-09-24/README.md),
[frozen plan](jev-multilingual-2026-09-24/plan.yaml),
[receipts](jev-multilingual-2026-09-24/receipts.yaml) and
[numeric summary](jev-multilingual-2026-09-24/summary.yaml) preserve the evidence.
Misleading control E is excluded from candidate performance summaries. Default
case selection includes preflagged cases; historical comparisons use matched
cases and never silently substitute an easier subset.

## Subsequent product simplification — agreed

The user selected experience and effort as the first-version signals. Skill
presence/use is the required Jev judgment; expression success is optional and
excluded from initial XP and recommendation calculations. Keep baseline's compact
instructions, core, language guidance and evidence criteria. The original study
used two judgments; the descriptions and results below preserve that experimental
record. They do not establish a separate measured accuracy for a one-judgment
production request. No new experiment is required or queued by this simplification.

See the [current counting and recommendation policy](evaluation-xp-refactor-plan.md).

## Selected content and original experimental composition

1. Input: selected language/variety, current learner message and available
   preceding partner context. Partner text is context, not learner production.
2. Shared instructions: assess target meaning; permit contextually complete short
   answers and incomplete direct attempts. Do not calculate XP, infer assistance,
   or generate explanations in the assessment request.
3. Skill core: name, terse overview and essential boundary.
4. Compact language guidance: relevant realization and interpretation cautions,
   resolved from shared language material plus the selected variety. Arabic core
   is not MSA; Levantine guidance must apply directly to Levantine.
5. Two separate Choice judgments per skill, with baseline's short criteria:
   evidence (`absent`, `contextual`, `direct`, `unclear`) and expression
   (`successful`, `partial`, `unsuccessful`, `unclear`, `not_applicable`).

The exact adopted example payloads are the jobs with `arm: B` in the frozen plan.
The plan hash is `62a189690f3a461edb5c9aca4282cc41ed5708a011fa146a306290695a21f380`.
Requested model: `typesafe/jev-1.13`; recorded actual model:
`typesafe/jev-1.13-20260917`. The benchmark currently assembles B through
`skill-strategies/strategies.ts` and substitutes selected language paragraphs in
`skill-multilingual/plan.ts`. This experimental assembly is provenance, not the
intended app dependency: production composition should read the authored content,
not import benchmark generators or historical plans.

## Human view and assessor view

One authored source supports two explicit projections:

| Human-readable skill guide | Compact assessor prompt |
| --- | --- |
| Skill overview and boundary | Skill overview and boundary |
| Language core plus connected variety guidance | Relevant compact guidance for the selected language/variety |
| Explanations and worked examples | No full teaching examples |
| Optional explanatory meaning notation | No predicate formula requirement |
| Structured Markdown for a skill-card detail view | Shared instructions and Choice criteria |

Keep examples and richer explanations. Clicking a skill should expose the static
language guide without an inference call. Full prose remains useful teaching
content even though it is not required for the chosen evaluator. Do not maintain
a second conflicting skill definition inside prompts. Progression stays separate.

## Boundaries for implementation

Expression success concerns communicating meaning; it is not a grammatical
correctness judgment. Choice probabilities are not XP, proficiency, or established
calibration. Baseline has no token spans, novelty computation or amount-of-practice
score. Independent questions can disagree; retain the actual validated output
rather than silently inventing consistency.

The next design step defines attempt/revision records, actual assistance supplied,
observations and uncertainty handling. Deterministic XP policy consumes those
records. Explanations are requested on demand and refer to saved assessments;
they do not silently rescore or change awards. Further operational and all-skill
coverage checks belong to integration, without reopening prompt-style exploration.

## Closure and reuse

No further experiments are queued. Preserve alternative strategies as experiment
fixtures, not additional runtime modes. Rebuilding a saved dashboard is offline;
running new inference is a separate action with its own scope and cost cap.
See the [assessment tooling guide](../../../tools/benchmarks/conversation-prompts/assessment/README.md).
Bulk guide generation remains deferred until composition and the pilot flow are
ready. The [execution plan](evaluation-xp-refactor-plan.md) is the current to-do list.
