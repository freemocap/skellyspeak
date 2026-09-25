# Jev assessment study design

Status: **historical design proposal, amended by user decision**.

The user removed the LLM comparison and numerical pass/fail gates and authorized
Jev-only exploratory performance/cost/time comparisons. The first bounded pilot
is [complete](../../jev-pilot-2026-09-24/README.md). Its smaller run size and actual
results are the current checkpoint. Comparator work and the numerical decision
rule below are superseded; retain them only as exploration history.

Original proposal: No provider calls authorized or
executed by this document. Numerical targets below are proposed engineering
criteria, not established research benchmarks or agreed product requirements.

## Objective

Find the smallest input that lets Jev assess the new skill definitions accurately,
reliably and quickly enough for chat. Measure accuracy against reviewed human
expectations, not against another model. Assess whether a conventional LLM offers
useful improvements at an acceptable latency/cost, if the existing runner can be
adapted without building another assessment system.

## Comparator audit

Inspected `tools/benchmarks/conversation-prompts/assessment/current-assessor.ts`
and `transport.ts`. This was a source inspection, not a live compatibility test.

- The old current-app comparator requires old Jev plans, native exports, old
  outcome mapping and a maximum of four reported skills. It is not a fair
  comparator for the proposed per-skill measurements. Do not restore it.
- `transport.ts` already has a general LLM `chatPayload` that answers all questions
  with structured output. Its decoder assumes the old shared five-choice set;
  it cannot directly handle our four-choice and five-choice questions today.
- A bounded comparator adaptation can generate per-question enums, validate exact
  requested question IDs and accept labels without requiring LLM confidence prose.
  Reuse the same content and cases as Jev. Do not add a separate native assessor.
- Pricing, model IDs, route availability and API behavior in this old runner have
  not been verified as current. Check them before any run, alongside transport
  observability and redaction. No old speed or price assumption carries forward.

Recommendation: Jev-first study; adapt this general LLM path as an optional matched
comparator. If it requires new application contracts or a substantial new engine,
leave it out and report Jev's absolute performance. This does not block Jev work.

## Questions held fixed

Use [the two candidate questions](measurement.yaml): evidence type and expression
success. Their labels are nominal, not XP values. Freeze definitions after reviewer
agreement, before running. An LLM comparator returns the same labels for every
requested skill; no explanations or spans from either engine in the first study.
Native Jev probability distributions may be retained, but label metrics provide
the shared comparison. Do not request fabricated comparable probabilities from
an LLM or treat either model's self-report as calibrated confidence.

## Stage A: information content

Every arm uses identical learner text, context, selected language/variety, skill
cores, shared instructions, question definitions and question order. One pinned
Jev model/route; fixed concurrency and timeout. Only the listed content changes.

| Arm | Additional content beyond compact skill cores |
| --- | --- |
| A. Core | None: names, overviews and boundaries only |
| B. Language | Compact relevant language/variety guidance |
| C. Language + meaning in prose | B plus a plain-language explanation of the semantic relationships |
| D. Language + meaning notation | Same information as C, expressed through notation and argument definitions |
| E. Full guide | B plus the fuller teaching explanation and examples |

Comparisons have specific purposes:

- A versus B: benefit of language guidance.
- B versus C: benefit of extra semantic clarification.
- C versus D: notation versus equivalent prose. Review informational equivalence;
  do not accidentally give one arm extra rules/examples. Token counts may differ.
- B versus E: benefit and cost of the longer teaching material.

No arm receives expected labels, review notes, held-out examples or a rendered
explanation of the current answer. Condition E's teaching examples must not be
copies of evaluation cases. This is a controlled subset of comparisons, not a
full factorial claim that all interactions have been isolated.

Proposed screening set: 60 development cases, two repetitions per arm = 600 Jev
calls. Each call evaluates both focal skills (four questions). The six focal
coverage cells are two skills (possession, past reference) × Spanish/Mexico,
Arabic/Levantine, Arabic/MSA, with ten cases each. Label both skills in every case,
including absence. Language guides for these cells must be reviewed first.

Use cases covering successful explicit use, contextual use, incomplete use,
completed-but-unsuccessful attempts, no use, ambiguous interpretation, partner-only
evidence, negation/composition and revisions. Do not force unnatural examples to
fill a quota. Ensure each scored class has enough reviewed cases; revise the case
allocation before freezing if it does not. The nine existing cases are development
seeds, not a sufficient study or an independent evaluation set.

After screening, select one Jev arm using the rule below. Do not tune on held-out
cases. Add a fresh 60-case held-out set with equivalent coverage, new wording and
new situations; keep related templates in the same split. Two repeats = 120 Jev
calls. If the LLM adapter remains small, run it on these same 60 cases with the same
selected content, twice = 120 LLM calls. Interleave engine/arm order in balanced
blocks to reduce time-of-day/provider-load bias. Repeats are not independent cases.

Total proposed stage A ceiling: 720 Jev calls plus optionally 120 LLM calls.
Preflight protocol calls, if needed, require their own explicit allowance and use
separate smoke fixtures; they are not quietly added to these totals. Cost could
make this plan too large: price the full plan before accepting the run size.

## Stage B: context and grouping

Only after selecting a useful content arm, compare inputs on an appropriate
reviewed challenge set:

1. Current reply alone.
2. Current reply plus the fixed preceding exchange.
3. The same reply and context plus token/group annotations.

The current message and context stay intact in condition 3. Compare grouping
assistance without also removing information. Reference judgments are specific to
what each condition can know: a context-dependent reply may be unclear or lack
focal evidence when isolated. Also report the contextual tasks enabled by extra
context; do not reward guessing unseen context.

Measure annotation preparation time/cost in the grouped condition. If annotations
come from an existing operation, report incremental and total pipeline costs
separately. Splitting groups into independent assessment calls is a separate later
experiment because it changes both context and call count.

Do not vary question wording, model, evidence spans and grouping simultaneously.
Stage B receives its own reviewed size and cost plan; no stage B runs are included
in stage A authorization.

## Stage C: realistic twelve-skill workload

Before selecting a production configuration, run the chosen format with all twelve
skills and twenty-four questions per reply. Include reviewed cases for every skill,
multiple simultaneous skills and a representative language-defined extension.
Measure cross-skill false positives and whether the two judgments remain consistent.
The two-skill screening latency/cost is not a production estimate. A dedicated
all-twelve run plan and reviewed labels are required; its calls are not included
in stage A. No catalog prefilter is introduced without checking missed skills.

## What we measure

| Measure | Definition and reporting |
| --- | --- |
| Judgment quality | Separate confusion matrices and macro-F1 for evidence and expression; also exact agreement on both questions. Report class counts. |
| False success | Prediction successful when reference is partial, unsuccessful or not applicable; report numerator/denominator and each subgroup. |
| Missed success | Reference successful, prediction partial, unsuccessful, not applicable or unclear; report separately from false success. |
| Source contamination | Skill credited from partner-only wording when the learner supplies no relevant evidence. |
| Ambiguity handling | Correct use of unclear on reviewed ambiguous cases, plus unclear rate on clear cases. Do not count every abstention as correct. |
| Result reliability | Exact question coverage, valid labels, failures and missing responses. Report contradictory question pairs, without repairing them. |
| Stability | Fraction of case/skill judgments changing between repeated identical inputs. |
| Latency | Request-to-validated-result p50/p95, timeout rate and failure elapsed time; total pipeline time when grouping is present. |
| Cost | Actual billed total including failures, per submitted case and per valid assessment; token counts and input size. Unknown billing remains unknown. |

Quality reports show both matched valid cases and all requested cases, with missing
answers counting against end-to-end agreement. Report each language/variety and
skill, not just pooled averages. Show proportions with denominators and uncertainty
intervals clustered by case; do not treat repeated calls or two questions as
independent samples. Sparse groups remain inconclusive, not passed by omission.

## Proposed decision rule

Before inference, review and freeze these provisional screening targets:

- At least 90% agreement for each question on clear reviewed cases.
- At most 5% false success and 10% missed success on their eligible clear cases.
- At least 99% valid complete assessments; zero source-contamination errors in
  designated control cases.
- At least 95% repeat agreement across case/skill/question comparisons.

Ambiguous-case performance is reported separately; define acceptable ranges after
reviewing those cases and before model output is available. Empty classes or tiny
strata cannot support a pass. These are point-estimate screening gates; report
uncertainty explicitly. The small study does not establish population guarantees.

Among arms meeting the quality gates, identify the accuracy/latency/cost tradeoff.
Prefer the smallest input with comparable quality; report differences rather than
inventing a combined quality-price score. Predeclare a two-percentage-point agreement
margin for a provisional cheaper-arm choice; overlapping uncertainty means the
choice is provisional, to be checked on the held-out set. If no arm passes, inspect
definitions, fixtures or content, then design a new run; do not lower gates post hoc.

For the final all-twelve workload, proposed interactive targets are p95 under
1.5 seconds and cost no more than $1 per 1,000 assessments. These are proposed
product targets to discuss, not current prices or measured performance. A good
accuracy result that misses these targets is an explicit tradeoff, not a silent pass.

The optional LLM comparison answers whether its quality improvement justifies
extra cost/time. It is not the truth source and is not needed for Jev to pass.
If the selected configuration fails held-out gates, do not tune against that set
and report it as held-out success; use a new independent confirmation set.

## Before pressing run

Freeze the case content and split, reviewed judgments and disagreements, actual
resolved prompts, choice definitions, selected model/route, decoding rules, timeout,
concurrency, execution order and acceptance criteria. Produce a concrete run manifest
with hashes, estimated token usage, verified current pricing and a maximum spend.

The user reviews that artifact before provider calls. No numerical spend cap is
asserted before pricing the selected plan. Stop on access, budget or protocol failure;
retain diagnostic metadata and validated partial results. No automatic retry or
unplanned replenishment of failed cases. Human review of fixtures is separate from
our syntax/consistency checks. No broad guide generation is needed to run this study.
