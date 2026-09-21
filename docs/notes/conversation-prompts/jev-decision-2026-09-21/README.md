# Final Jev Go / No-Go challenge

Status: complete. 360 Jev calls plus the user-requested 120 current-assessor
comparisons; 480 calls, $0.251137878 actual billed cost, no unknown billing.
Recommendation: **GO for implementation with Original Jev Choice**, not a
live app switch or deployment. The original absolute-gate result remains NO-GO
as a separate diagnostic; the user superseded that adoption rule.

## Decision scope

The user requested one final experiment followed by a Go/No-Go decision. GO means
proceed with guarded Jev-only app implementation; NO-GO means do not replace the
current assessor with a tested configuration. This is an engineering screening
decision, not deployment authorization or proof of general learner-assessment
accuracy. No runtime integration, account, learner data, release or commit is part
of this experiment.

The thresholds and gates below are agent-selected engineering acceptance criteria,
communicated and frozen before inference. They are not empirically established
universal tolerances or a claim of user-approved statistical noninferiority.

## Frozen design

60 new Spanish-target messages × 3 unchanged Jev formulations × 2 repetitions =
360 calls. All calls classify all 45 catalog skills. Twelve focal skills have
reference labels: courtesy, past reference, future reference, comparison, reason,
condition, negation scope, transfer, concession, reported content, modality and
past sequence. Each skill has two full demonstrations, one partial expression,
one absent trap and one source control. Reference labels remain provisional,
authored and reviewed by the same agent rather than an independent human panel.
No final outputs were seen when the cases, labels and policy were frozen.

Full cases include paraphrases, purpose rather than cause, negation of necessity,
nonstandard verb forms that still express temporal meaning, multiple-event order,
attribution and noncanonical comparison. Negative cases distinguish vocabulary
mentions from actual skill evidence and basic constructs from more advanced ones.
Some partial labels depend on contestable completeness boundaries; the exact
wording and review rationale are displayed without hiding them.

Source controls place focal Spanish evidence only in a partner message, with
ineligible or unrelated learner wording. Five current messages are English-only;
one contains an English instruction to override the rubric. Target language
remains Spanish. Context is part of the case design, not a separate randomized
factor, so the context filter does not estimate a causal context effect.

## Original absolute gates (diagnostic after user amendment)

Original Choice evidence threshold: 0.50; full threshold: **0.80**, selected from
the previous formulation experiment (maximum negative 0.78, minimum positive
0.94). Structured Choice and the two Noul judgments retain 0.50 for both tasks.
No final-set threshold optimization is used in the decision.

Every passing candidate must satisfy all gates:

- ≥95% hit rate and ≤5% false-alarm rate for both some-evidence and full-demonstration
  tasks, on matched valid triples and all available valid responses.
- Zero focal source-control false alarms on either task.
- ≥99% valid responses; ≥90% matched comparison coverage.
- p95 valid request-through-validation latency ≤750 ms.
- Total known spend, including failed calls, divided by valid responses ≤$0.001;
  no unknown billing.
- Zero threshold-level full-yes/evidence-no contradictions across all 45 skills.
  Probability-order violations are counted separately and remain visible.

Each formulation receives 120 calls. Repetitions do not turn the 60 authored
messages into 120 independent examples. Source controls have 24 repeated judgments
per arm, not 24 independent messages. No population confidence intervals or
significance claim. SDT correction and ROC reuse the earlier analysis machinery.
The ROC slider is exploratory; it cannot modify the frozen Go/No-Go result.

The original rule required every gate to pass. The user explicitly superseded
that adoption rule: compare improvements relative to the current assessor even
when aspirational absolute targets are missed. The frozen gates remain visible
as diagnostic results; they do not determine the revised adoption verdict. Frozen policies are
recorded in plan.json and policy-hash.json; request and reference hashes are also
checked. Conservative pre-run reservation: **$4.8872376**, not actual billing.

## Machinery and reproducibility

The final study reuses the existing Jev runner, credential loader (`server/.env`),
transport, receipt validation, SDT, metrics, visualization layout, inspector and
projection pipeline. New code creates the challenge manifest and evaluates the
frozen acceptance gates. Prior results and dashboards are preserved. No retries.

```sh
node tools/benchmarks/conversation-prompts/assessment/jev-decision.ts OUT
node tools/benchmarks/conversation-prompts/assessment/jev-alone.ts live OUT
node tools/benchmarks/conversation-prompts/assessment/jev-alone-build.ts OUT --profiles-only
/tmp/skelly-prompt-analysis-venv/bin/python tools/benchmarks/conversation-prompts/explorer/project.py OUT --profiles
node tools/benchmarks/conversation-prompts/assessment/jev-alone-build.ts OUT
```

The plan and runner refuse overwrite. Commands showing live inference are
reproduction instructions, not permission for another paid run.

## Verification before inference

All six assessment test-file groups passed, including tests for exact paired
states, twelve-skill coverage, prior-study thresholds, independent threshold
exploration, rejecting a source-control false alarm, and keeping incomplete runs
PENDING. Strict TypeScript checks passed. The frozen plan and reference cases were
shown at http://127.0.0.1:8777/ before inference started.

## User-requested comparative amendment

Added after Jev inference, before the current-assessor run: 60 identical cases ×
2 repetitions = 120 current-system calls. Actual Rust prompt/schema export,
Gemini 2.5 Flash Lite default fast-model reference, temperature 0.7, no reasoning,
2,048 output-token limit, pinned Google AI Studio provider. User model overrides
were not inspected. Exact learner state and criterion definitions are checked;
native criterion order differs and is preserved as part of its current behavior.
The current system produces at most four quoted observations with explanations;
Jev classifies all 45 criteria without source quotes. This compares system paths,
not models with identical output work. Current native outputs also undergo the
actual Rust validator. No automatic retries. Reservation ceiling: $1.642368.

Pairwise matched valid calls report hits, misses, false alarms, correct rejections,
d′, and individually inspectable improvements/regressions. All-call validity
and cost include failures; all-available and source-control metrics are retained.
The baseline was run in a later time block, so latency differences may include
provider/network conditions. Repetitions are not independent messages.

Decision principles: assess quality, reliability, latency, cost and lost output
functionality relative to the existing path. A missed numerical target is not
a veto. Improvements in recall do not silently cancel additional false credit.
No numerical exchange rate between misses, false credit, latency and dollars
was pre-agreed; any recommendation must make those tradeoffs explicit. No final
set threshold tuning. No additional paid experiment after these 480 total calls.

## Completed comparison and recommendation

Original Choice and current have 109 matched valid pairs. Some evidence: current
57 hits / 9 misses / 8 false alarms / 35 correct rejections; Original 66 / 0 / 1 / 42.
Full: current 42 / 5 / 20 / 42; Original 47 / 0 / 6 / 56. That is 16 improved
some-evidence and 19 improved full judgments, with zero regressions, under the
provisional reference labels. Tasks and repetitions are correlated, not 35
independent improved examples. All-valid results and exclusions are retained
in current-comparison.json; failures are excluded from semantic pairing, not cost.

| System | Valid / 120 | Median / p95 ms | USD / 1,000 valid |
| --- | ---: | ---: | ---: |
| Current fast-model assessor | 113 | 837 / 1,159 | 0.159 |
| Original Choice | 116 | 258 / 339 | 0.469 |
| Structured Choice | 118 | 315 / 415 | 0.851 |
| Two Noul judgments | 120 | 300 / 391 | 0.653 |

Original is approximately 3.24× faster at the median, and 2.95× as expensive per
valid output. Recommend it as the first implementation candidate for its paired
quality improvement, speed, and lower cost than other Jev formulations. This is
an explicit engineering tradeoff, not an inferred user utility function.
Structured Choice reduces full false alarms further (3 on 111 matched pairs) but
introduces more some-evidence false alarms (4), costs more and is slower. Its one
regression per task is the same contestable comparison-label case. Noul increases
some-evidence false alarms versus current (9 vs 8 in 113 matched pairs), although
it improves hits and full judgments. Choice is the preferred direction.

Original still has six full false alarms and one some-evidence source-control
false alarm on all valid outputs. Source controls confound English eligibility
and preceding-partner content: these results cannot isolate a causal borrowing
effect. They are source/target-language boundary failures. The 33 other catalog
skills lack accuracy references in this study. Synthetic case labels were not
independently adjudicated. None of these facts is hidden by the relative gain.

The current contract requires exact quotes and explanations; Jev classifications
are not a drop-in artifact. Implementation must explicitly adapt that contract
without inventing evidence quotes. No production behavior has been changed by
this experiment. recommendation.json binds the recommendation to both plan hashes.

Verification: all 120 current outputs replayed through the real Rust validator.
Seven rejected outputs all failed exact learner-source quote binding, matching
the transport validator. All seven assessment test groups and strict TypeScript
checks passed. The dashboard includes paired-difference charts, SDT tables,
inspectable improvements/regressions and failures, and the existing 12 PCA/t-SNE/
UMAP projections for Jev probability profiles (243 profiles). The current model
does not emit comparable probabilities and is not fabricated into those maps.
