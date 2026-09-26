# Spanish prompt sensitivity study

Status: complete: 900 measured responses, no transport failures, three response
validation failures. Reported cost $0.06495468. [Open the dashboard](index.html). This is a development-set sensitivity study,
not independent validation. No app content or XP contracts changed.

## Fixed design

Reuse the previous 36 Spanish cases, 31 scenario clusters, two focal skills,
reference labels and disputed flags. Five repetitions × five conditions gives
900 measured requests. The previous B condition is rerun concurrently; historical
responses are not pooled. Shared assessment framing, four question IDs, question
wording, choice labels and criteria, model, state format and concurrency are fixed.
Only the skill-description block changes. Temperature remains unspecified.

| Arm | Strategy | Purpose |
| --- | --- | --- |
| A | Minimal, vague description | Test how much domain knowledge Jev supplies without detailed guidance |
| B | Previous language guidance | Concurrent comparator |
| C | Operational rules plus compact relation notation | Make assessment boundaries explicit |
| D | Contrastive teaching examples | Express similar boundaries through contrasting cases |
| E | Intentionally misleading definitions | Test instruction sensitivity; not candidate app guidance |

These are bundled strategies, not a factorial decomposition of length, prose,
notation and example effects. A retained shared frame and label definitions may
limit the minimal condition's weakness; that is intentional control of scope.
The misleading condition restricts possession to legal physical ownership and
reverses past reference to future meaning. It does not change output labels.

Strategies were authored after inspecting the previous study. Their illustrative
examples use different sentences, but target known difficult distinctions. Any
improvement is development-set improvement, not held-out accuracy. Existing
reference labels remain provisional, and no reference edits are permitted after
seeing these results. Excluding flagged cases is a sensitivity view, not a gold set.

## Measurement

Primary comparisons are each arm versus B, using equal case weighting, five
repetitions and the selected focal judgment dimensions. 5,000 paired bootstrap
samples resample whole scenario clusters; 95% intervals are exploratory and not
adjusted for multiple comparisons. Interpretation concerns this authored collection.

Also measure changed labels relative to the same case/repetition in B, with
cluster intervals and counts of fixes, regressions and changes between two
reference-mismatching answers. Repetition numbers pair collection blocks, not
shared model random seeds. This distinguishes behavioral sensitivity from a net
agreement score that could hide offsetting changes. Valid-answer comparisons
exclude invalid pairs and disclose them. Agreement includes missing judgments as
non-matches. No single numeric acceptance gate is used.

Costs are USD **per 1,000 requests**, not per request. Each request asks four
judgments. The dashboard now presents both units. Initial conservative reservation
is $0.88354392 with an enforced $2 cap and live endpoint-price checks.

## Artifacts and operations

- [Frozen plan](plan.yaml): exact requests and job hash.
- [Run metadata](run.yaml): live pricing and start time.
- [Receipts](receipts.yaml): answers, latency, reported billing and failures.
- [Dashboard](index.html): shared renderer, scoped to this experiment.
- [Summary](summary.yaml): comparisons and label transitions.

The runner preserves bounded numeric values and recognized labels for invalid
answers in `invalidAnswerMetadata`, without treating them as validated judgments.
Transport, pricing, billing and model errors stop collection. Billed response
validation failures remain visible and are not retried. No automatic retry.

Dashboard and statistics reuse the previous implementation. Cases reuse the
existing case source. New authored prompt text is confined to
`tools/benchmarks/conversation-prompts/assessment/skill-sensitivity/strategies.yaml`;
the E control must never be promoted into production content.

To rebuild without new model calls, from the repository root:

```sh
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/build.ts docs/notes/language-guides-and-xp/jev-sensitivity-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/serve.ts docs/notes/language-guides-and-xp/jev-sensitivity-2026-09-24
```

## Findings

| Strategy | Agreement | Difference from B, pp [95% paired interval] | USD / 1,000 requests |
| --- | ---: | --- | ---: |
| Minimal | 85.28% | −1.67 [−3.78, −0.26] | 0.05488 |
| Baseline | 86.94% | Reference | 0.06648 |
| Rules | 84.44% | −2.50 [−7.57, +2.11] | 0.08554 |
| Examples | 88.89% | +1.94 [−3.03, +6.83] | 0.08781 |
| Misleading control | 45.83% | −41.11 [−59.03, −23.23] | 0.06614 |

The control establishes sensitivity to the guidance. Candidate improvements remain
uncertain. Examples cost about 32% more than baseline and fix 13 reference
mismatches while introducing five among valid paired comparisons; one additional
focal judgment is invalid. Rules fix five and introduce fourteen. Changed labels
can have offsetting effects on net agreement.

Both richer candidates fix the contextual `Marta.` expression judgment. Rules also
introduce mismatches on a greeting and a quoted time word. Examples improve two
present/future negative controls. The next focused question is how to express the
boundary between no use, failed use and incomplete use compactly, with fresh cases.
No inference that general lesson length is valuable follows from these results.

The three validation failures are selected choices 0.01 below a different reported
maximum probability. Their numerical distributions and choices are retained in
`invalidAnswerMetadata`. They fail the existing argmax-consistency validator;
these are not HTTP failures. Two involve non-focal questions and one focal question.
No validation rule was changed after seeing these responses.

The [dashboard interpretation](discussion.yaml) records detailed conclusions.
Tests cover unchanged baseline/criteria, balanced assignments, transition counts,
shared dashboard scope and prompt inspection, bootstrap behavior, and invalid
judgments. Strict TypeScript, all nine relevant tests, and actual-data DOM checks passed.
The dashboard focus control hides the misleading condition in the paired-difference
plot so the smaller candidate contrasts remain readable. Local HTTP returned 200.
