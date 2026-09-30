# Expanded comparison: proposed run and budget

Status: proposal based on the completed September 30 pilot. No new paid calls,
model routing changes, deployment or commits. This note distinguishes corpus
preparation, paid execution, offline evaluation and future experiments.

## What happened

The prepared suite contains 64 synthetic exchanges: 60 language-specific semantic
cases plus four encoding variants. Six languages share ten scenario families;
translations are related observations, not independent story seeds. Each exchange
produces seven task inputs, giving 448 synthetic inputs. Nineteen recorded task
inputs are separate. The original two-arm, two-repetition plan had 1,868 calls,
but its manifest records zero paid calls. Preparing fixtures did not run them.

The separately executed pilot deliberately selected twelve synthetic inputs:
three languages times four task types. Two arms times two repetitions gave 48
attempts. All were attempted; 46 completed and two returned HTTP 429. Rate limits
caused pauses and continuations, not the selection of a 48-call sample. Neither
failed job was retried. The gap between prepared coverage and executed coverage
was insufficiently communicated in the earlier reports.

## New offline findings

All 48 receipts now have explicit review annotations in
`tools/benchmarks/model-comparison/quality-review.json`. The annotation rubric is
post-hoc and unblinded; it is not independent expert validation. The analysis uses
the exact schema frozen with each request, not today's edited source schema.

| Task | Transport completion, standard / fast | Frozen schema passes, standard / fast | No defect found in reviewed dimensions, standard / fast |
| --- | --- | --- | --- |
| Partner reply | 6/6 / 5/6 | Not applicable | 6/6 / 5/6 |
| Word gloss | 6/6 / 5/6 | 6/6 / 5/6 | 3/6 / 1/6 |
| Coaching | 6/6 / 6/6 | 1/6 / 0/6 | 0/6 / 0/6 |
| Reply assistance | 6/6 / 6/6 | 6/6 / 6/6 | 1/6 / 0/6 |

The final column requires transport success, frozen-schema compliance, limited
source/field checks, core-task pass and no flagged semantic issue. It is deliberately
called "no defect found", not certified correctness. Partner replies were scored
only for topic following and target-language response, not every stylistic constraint.
Core task performance and auxiliary field performance remain separate in the data.

The new schema check catches failures the original JSON-only screen missed:
nonempty coaching cue fields despite empty-string constants and an overlength
rationale. Meaning review additionally finds wrong replacement scope, loss of a
quantity, contextual gloss errors, English meanings in pronunciation fields and
target-script text in romanization fields. Ordinary source wording copied into
pronunciation can be misleading even when JSON is perfectly valid.

The native replay limitation remains separate from these definite frozen-schema
results. Do not label the new checks as native acceptance. Unavailable, partial,
uncertain and failed outcomes remain distinct in the per-response matrix.

## Proposed sequence

1. **Qualification: 84 calls.** One representative input for each of seven tasks
   and six languages, each run once through both arms. Before execution, make
   native replay work and verify request/schema handling. If prompts or transport
   behavior change, freeze a new experiment version; retain the pilot unchanged.
   Prefer qualification inputs covering the observed failure classes.
2. **Existing corpus: 2,688 calls.** Run all 448 synthetic task inputs, both arms,
   three repetitions. Keep all ten scenario families and four encoding controls.
   Randomize and counterbalance model order in task/language blocks. Record run
   order, pacing block, input/output tokens, costs, completion and validation stages.
   Qualification is separately reported; do not quietly reuse it as a balanced replicate.
3. **Independent scenario expansion: up to 8,640 calls.** After Stage 1 review,
   create six genuinely different story seeds per family: 60 story seeds, adapted
   to six languages = 360 exchanges. At most four selected task types, two arms
   and three repetitions give 8,640 calls. Prioritize partner replies; add other
   tasks only when their contract/quality failures have been understood. Translations
   and repetitions stay nested under story seed. Additional same-prompt repetitions
   are for instability, not a substitute for more independent situations.
4. **Recorded validation: separately scoped.** The existing 19 recorded inputs
   would require 114 calls at three repetitions. Refresh the capture if new turns
   are available. Private-prompt destination authorization remains a separate
   prerequisite; synthetic authorization is not a workaround. No real prompts
   are embedded in the new report.
5. **Integrated graph trial.** After per-task gates pass, measure actual whole-turn
   critical-path time, first-token latency, native acceptance, downstream quality
   and speech/UI scheduling with selected substitutions. Keep this outside the
   fixed-input screening counts and cost estimates until its call graph is frozen.

## Cost forecast, not a bill

The pilot's known charge is $0.02311524; two failure costs are unknown. The pilot
reservation was $0.4577704. Reservations use maximum output and conservative input
estimates; they are not measured charges.

| Proposed stage | Calls | Pilot-scaled central proxy | Scope of estimate |
| --- | ---: | ---: | --- |
| Qualification | 84 | $0.04 | Equal-weight task-cost proxy; unmeasured cells remain uncertain |
| Existing synthetic corpus | 2,688 | $1.29 | $0.74 measured-task proxy + $0.55 borrowed proxy for three untested tasks |
| Independent story expansion | Up to 8,640 | $4.16 | All four pilot task types at pilot token use; recalculate if scope changes |
| All three synthetic stages | Up to 11,412 | About $5.49 | Excludes recorded replay, judging calls, integration and repairs |

The Stage 1 central proxy is $1.29390352. A threefold sensitivity scenario is
$3.88171056; it is not a confidence interval or guaranteed upper bound. Longer
contexts, different language tokenization and the three unmeasured task types
may exceed this proxy. Qualification replaces it with observed token distributions
by task and language, including upper-tail output counts.

The saved synthetic maximum-token reservation scales from $15.8267056 at two
repetitions to **$23.7400584 at three**. The recorded reservation separately scales
to $0.9961845. These are stale price-snapshot calculations requiring live price
rechecks. Three repetitions put some existing language batches above the runner's
$5 reservation ceiling; split those batches rather than bypassing the ceiling.

Proposed actual-spend checkpoint: $5 for Stage 1, recalculated after qualification.
The current runner's conservative per-batch reservation is not a whole-study
actual-spend checkpoint. Implement and test that checkpoint, including unknown
billing handling, before relying on it. Pause on a 429 and preserve the failure;
continuations may submit only unattempted jobs. No silent retries.

At ten seconds between serial requests plus approximately 1.3 seconds per response,
Stage 1 would take roughly 8.4 hours before pauses. Rate limits could extend it.
That wall time includes experimental pacing; it is not application latency.

## Evaluation and decision gates

- Freeze task-specific core goals, hard validation rules and severity levels before
  the next run. Separate meaning preservation, linguistic correctness, usefulness,
  pronunciation, romanization, source alignment and instruction compliance.
- Review anonymized pairs with arm, time and cost concealed. Obtain a second
  competent language review of disagreements and harmful findings before claiming
  equivalence. No paid judging run is included in the current budget estimate.
- Report counts and denominators for every stage. Include paired success
  discordances, quality failure classes, cost per accepted result, distributions,
  paired differences and task/language breakdowns. Never use standard as gold.
- Resample by independent story seed, retaining related translations and repeated
  calls. The current three-context intervals are descriptive sensitivity summaries,
  not defensible population confidence or an equivalence result.
- Pause an affected cell for native rejection, new harmful errors, rate limiting
  or budget limits. Fix and version the relevant contract before a new run.
- Propose a maximum acceptable quality loss of five percentage points, subject
  to product review, and require no unresolved severe error classes. Select the
  final margin before seeing the larger study. About 59 independent zero-failure
  cases are needed merely to put a one-sided 95% binomial upper failure-rate
  bound below 5%; that alone does not establish paired equivalence or quality
  across untested contexts. Pilot repetitions cannot supply those cases.

## Artifacts and reproduction

The standalone nine-page PDF, self-contained HTML evidence explorer, response
annotations, summary data and figures are in the ignored directory
`.local/model-comparison-analysis-2026-09-30/`. The explorer retains exact synthetic
inputs and raw outputs next to schema errors and review notes. PDF charts include
the quality matrix, response clouds, histograms, per-observation distributions
and paired-difference uncertainty. The PDF is the shareable report; the HTML is
for inspecting individual responses in a browser.

Offline builders: `analyze_pilot.py` and `build_analysis_report.py` under
`tools/benchmarks/model-comparison/`. Dependencies were installed only under
`.local/report-packages/`. The code reads existing receipts and does not invoke
any paid endpoint. Findings supersede the original limited structural screens,
while the original receipts and initial report remain unchanged.
