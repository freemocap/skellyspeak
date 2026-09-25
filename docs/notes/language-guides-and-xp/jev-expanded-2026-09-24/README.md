# Expanded Jev assessment study

**Status:** complete. 2,700 measured responses plus one retained transport-timeout
attempt. [Open the standalone dashboard](index.html).
This is exploratory development evidence, not a production acceptance test.

## Findings from this run

All 108 cases and both focal judgments:

| Condition | Agreement | 95% scenario interval | Difference from B, percentage points [95% interval] | Median / p95 latency, ms | USD / 1,000 requests |
| --- | ---: | --- | --- | --- | ---: |
| A Core | 84.35% | 74.41–92.50% | +1.02 [−0.57, +2.96] | 173 / 292 | 0.05883 |
| B Language | 83.33% | 73.24–91.89% | Reference | 176 / 274 | 0.06717 |
| C Language + prose | 83.89% | 74.54–91.86% | +0.56 [−0.72, +1.90] | 176 / 264 | 0.07650 |
| D Language + notation | 84.35% | 75.30–92.14% | +1.02 [−0.78, +3.33] | 176.5 / 271 | 0.07549 |
| E Longer guide | 85.00% | 76.37–92.12% | +1.67 [−2.04, +6.93] | 178 / 290 | 0.08142 |

Every paired interval against B includes zero. This collection does not clearly
separate those conditions. It also does not prove equivalence: some intervals
still allow practically relevant differences. E costs about 21% more than B on
this four-judgment workload, without a clearly established agreement improvement.

Excluding the 30 preflagged cases leaves 78 cases / 23 clusters. Agreement rises
to 93.2–94.4%, and the highest point estimate changes from E to D. This is a strong
reason to review the disputed definitions and labels before treating reference
agreement as accuracy. Unflagged references are still provisional.

Repeated-choice disagreement ranges from 1.39% to 2.32% of valid repeat pairs.
Stable answers can still disagree with the reference; repeatability and validity
are separate findings. Five repetitions cannot precisely characterize rare failures.

Actual model: `typesafe/jev-1.13-20260917`. Reported billed-response total:
**$0.19407822**. The first timeout has unknown billing; its **$0.001013292**
reservation remains separate, giving $0.195091512 in budget accounting. Two of
2,700 responses failed distribution validation, both in D, for Levantine past
expression (`s10-1`, repetition 1; `s29-1`, repetition 2). No reference labels were
changed after seeing results. Invalid distributions themselves were not retained,
so the exact rejected values cannot be reconstructed from these receipts.

Recommended next review: inspect disputed short answers, broken attempts, and
relative/hypothetical time in the matrix; refine the shared interpretation of
meaning success versus grammatical correctness. Do not select a more elaborate
prompt or start bulk guide generation on the strength of the point-estimate ranking.

## Design fixed before inference

- 108 cases: 36 scenario rows in Spanish (Mexico), Levantine Arabic and MSA.
- Two skills: possession/relationships and past reference. Each request assesses
  evidence and expression for both skills; primary summaries use the focal skill.
- Five content conditions: A core, B language guidance, C language plus semantic
  prose, D language plus notation, E longer guide specimen.
- Five repetitions per case and condition; 2,700 planned requests.
- 31 semantic clusters keep translations and related scenario variants together.
- Randomized case order and rotating condition order, seed 938174; sequential calls.
- 5,000 paired cluster bootstrap resamples, 95% percentile intervals. The mean
  weights selected cases equally; each case averages repetitions and selected
  judgment dimensions. All conditions share each bootstrap sample.
- Provisional AI-authored references. Disputed cases were flagged before inference.
  Excluding flagged cases is a sensitivity analysis, not an independently validated
  gold set. No post-result reference changes have been made.
- No temperature setting: the reviewed DecisionsRequest schema declares none.
  Repeated calls characterize service-default variability. [@openrouterDecisionsSchema20260924]
- $5 hard cap; initial conservative reservation $2.65147932. Price ceiling
  $0.042/million input tokens and zero output-token charge, checked live.

The frozen [plan](plan.yaml) preserves exact requests and a hash of the jobs.
The [initial run metadata](run.yaml) preserves endpoint pricing. Source is under
`tools/benchmarks/conversation-prompts/assessment/skill-expanded/`.

## Protocol deviations and failures

1. The sixth request hit the original 20-second timeout. Five prior responses
   completed. Its billing was unknown. The receipt was retained; a deliberate
   continuation increased the timeout to 60 seconds, skipped successful requests
   and counted the failed attempt's reservation against the budget. That one
   timed-out slot was retried; there is no automatic retry loop.
2. The continued run stopped at slot 28 on an invalid distribution for one question.
   The HTTP response and billing were present. The valid partial answers survived.
   A second deliberate continuation retained that outcome without retrying it.
3. Thereafter, structured-validation failures with HTTP 200 and reported billing
   remain measured outcomes and do not stop the collection. Transport, billing,
   model and provider failures still stop execution. This operational amendment
   does not alter requests, references or condition assignment.

Every attempt and response remains in the append-only YAML logs. Analyses include
one billed response per planned slot; the timeout remains separately disclosed.
Invalid/missing judgments count as non-matches in reference agreement. Repeat
variability excludes pairs missing a validated answer and is explicitly conditional
on valid pairs. Latency and cost include billed invalid responses. These choices
avoid selecting only successfully decoded calls.

The generic metadata adapter marked input/output token fields as omitted before the
Jev wrapper restored them. Those fields are present despite the historical omission
markers. Invalid distributions were not retained, only their validation error and
other valid answers; this limits diagnosis of the two initial invalid responses.

## Dashboard interpretation

The dashboard is a standalone HTML file with embedded data and code, no CDN or
analytics. It contains:

- Agreement intervals and paired differences from condition B.
- Latency boxes (observed 5th/25th/50th/75th/95th percentiles) and full ECDFs.
- Provider-reported cost per 1,000 requests with scenario bootstrap intervals.
- Repeated-choice disagreement and probability drift (total variation distance).
- Case agreement matrix and all five repeated responses, with probabilities.
- Language, focal skill, judgment dimension and disputed-reference filters.
- Download of the currently selected numeric comparison as CSV.

The bootstrap estimates sensitivity to this authored scenario collection, not
population learner accuracy. Related scenarios may remain correlated beyond the
chosen clusters. Five repetitions are insufficient for precise rare-failure rates.
Intervals are pointwise and unadjusted for multiple exploratory comparisons.
Latency distributions include network/provider effects and pauses between run
segments; their percentiles are not confidence intervals. Successful expression
means communication of target meaning, not necessarily grammatical correctness.

## Reproduce without new inference

From the repository root, once all planned slots have receipts:

```sh
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/build.ts docs/notes/language-guides-and-xp/jev-expanded-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/serve.ts docs/notes/language-guides-and-xp/jev-expanded-2026-09-24
```

The server binds only to loopback and serves the report and its named evidence files.
The self-contained HTML can also be opened directly; evidence links need the files
beside it. The build refuses incomplete collections or duplicate billed slots.
No runtime XP changes, bulk guide generation or deployment are part of this study.

## Verification

- Balanced assignments, no reference-label or temperature leakage.
- Paired bootstrap equality and invariance to duplicating identical repetitions.
- Missing judgments retained in denominator; valid partial comparisons continue.
- DOM execution of charts, filters, case navigation and numeric rendering.
- Strict TypeScript checks for study and dashboard sources.

Visual layout still needs user review in the opened dashboard; DOM execution is
not a visual browser inspection.
