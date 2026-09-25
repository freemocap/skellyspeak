# Jev criteria and question-structure study

Status: complete: 3,360 billed responses, three validation failures, no transport
failures or retries. Reported total cost $0.26638584. [Dashboard](index.html). This is an exploratory study, not an app
contract or a search that stops when a favorable result is obtained.

## Research and rationale

TypeSafe's documentation explicitly recommends moving difficult boundaries into
criteria and reducing indirect questions. It cautions against relying on
cross-question consistency. [@typesafeJaggedness20260924]
Choice accepts structured instructions/criteria; option names and descriptions
are visible to the model, while question IDs are not. This makes the criteria a
substantial part of the prompt, not just an output schema.
[@typesafeStructuredChoice20260924]

A first-person community benchmark reports that label conventions affected its
results. Its code/results were not independently verified here, and it does not
establish an optimal prompt for Spanish assessment.
[@jevCommunityBenchmark20260924] Other public summaries mostly restated vendor
documentation and were not treated as independent experimental evidence.

Earlier studies changed explanatory text but held criteria and separate-question
structure fixed. Those studies do not establish equivalence of every useful
formulation. This study changes those previously fixed components.

## Eight strategies

| Arm | Strategy | Mechanism being explored |
| --- | --- | --- |
| A | Criteria-centered | Put target and precise boundaries in each option |
| B | Prior baseline | Concurrent reference, unchanged questions |
| C | Spanish rubric | State the task and criteria in the input language |
| D | Joint assessment | Choose evidence and expression together, then decode |
| E | Misleading control | Retain the deliberately incorrect description |
| F | Concrete questions | Ask about the relation/time directly, avoiding abstract skill terms |
| G | Decision procedure | Explicit sequence for absence, ambiguity, completion and success |
| H | Examples in criteria | Contrastive, option-specific structured examples |

These are bundled strategic contrasts, not an orthogonal factorial experiment.
D makes two joint Choice judgments; other strategies make four separate judgments.
Its valid categories are a design choice, not an established application invariant.
Raw and normalized D results are distinguishable. The chosen joint label is mapped
to its components, and probabilities are marginalized without replacing that
choice with marginal argmax. Joint confidence is not a separately calibrated
marginal confidence. Cost/latency comparisons concern the whole assessment request.

## Cases and locked analysis

- 36 earlier Spanish cases are development data, not pooled into the primary slice.
- 48 fresh cases are 24 semantic pairs. Context changes, ellipsis, negation,
  word mentions, progressive past, tense ambiguity, malformed attempts and
  unrelated longer replies are included.
- New strategies were authored first, new cases second; all were frozen before
  inference. No strategy selection or reference editing after results. The same
  author created both: this is not independent expert validation or a blind external
  held-out benchmark. Cases flagged ambiguous before inference are excluded from
  the primary view but remain inspectable.
- 84 cases × eight strategies × five repetitions = 3,360 planned requests.
- Seven primary strategy-versus-B comparisons on fresh, unflagged cases. Paired
  bootstrap resampling keeps each scenario cluster together. 5,000 resamples;
  Bonferroni-adjusted percentile tails (.025/7, 1−.025/7) provide conservative,
  approximate family coverage. Bootstrap coverage is not exact at this sample size.
- Individual-arm agreement intervals and label-transition intervals remain pointwise
  95% descriptive intervals. All additional slice exploration is exploratory and
  not covered by the seven primary-comparison adjustment.
- Changed-label rates, fixes/regressions, repeat variability, latency distributions,
  billing and invalid outputs accompany net agreement. No equivalence margin or
  numeric acceptance threshold is being retrofitted.

Frozen [requests](plan.yaml) record exact payloads and hash. The initial reservation
is $3.21877836 against a $5 cap; [run metadata](run.yaml) checks current pricing.
Invalid billed judgments remain outcomes without retry. Transport/billing/model
failures stop the run. No temperature setting, LLM comparator or runtime change.

## Reproduction

Use the shared dashboard builder and local server from the repository root:

```sh
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/build.ts docs/notes/language-guides-and-xp/jev-strategies-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/serve.ts docs/notes/language-guides-and-xp/jev-strategies-2026-09-24
```

[Dashboard](index.html) · [receipts](receipts.yaml) · [summary](summary.yaml)

## Results and repeatability audit

Primary fresh/unflagged agreement: A 92.75%, B 95.25%, C 94.50%, D 91.25%,
E 49.75%, F 93.75%, G 93.00%, H 96.25%. No non-misleading candidate has an
adjusted difference interval excluding zero. H minus B is +1.00 percentage point,
with adjusted interval −9.75 to +11.56; this is neither improvement evidence nor
an equivalence result. See [full interpretation](discussion.yaml) and
[primary numeric results](summary.yaml).

The [repeat audit](repeat-audit.yaml) verifies one unique JSON request-body hash
for each of 672 case/strategy groups across their five repeats. It compares choice
and probability values in sorted key order, avoiding serialization-order artifacts.
Of 669 groups with all five responses valid, 61 change a selected answer, 36 change
a focal-skill answer, and 626 change probabilities. These counts span all response
questions and all cases; they are not the primary accuracy denominator or per-call
error rates. Both joint and separate strategies are included, with different numbers
of questions per group. The observed API is not strictly deterministic, but this
audit does not identify the underlying source of variation.

The bootstrap retains repeated calls inside each resampled scenario group. It does
not count them as independent cases. Future work should prioritize independent,
adjudicated examples and repeat only a bounded stability subset. No new run is
started automatically from that recommendation.

Verification: 13 relevant tests and strict TypeScript checks passed before the
completed artifact was built; actual-data DOM and local HTTP checks accompany the
handoff. Tests cover frozen design balance, reference isolation, joint decoding,
adjusted intervals, cohort filtering and chart bounds. No browser visual inspection
is implied by DOM checks.
