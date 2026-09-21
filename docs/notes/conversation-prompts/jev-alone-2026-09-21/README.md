# Jev-only formulation experiment

Status: completed exploratory experiment. Design was frozen and displayed before
inference. All 432 calls finished; no app integration is implemented.

## Agreed scope and implemented design

Continue the Jev-alone exploration, comparing the current five-category Choice,
clearer structured Choice definitions, and two independent binary Noul questions.
The dedicated dashboard reuses the prompt explorer's visual foundations, split-pane
inspector, Plotly projection renderer, and seeded PCA/t-SNE/UMAP/HDBSCAN pipeline.
It is a new report and fits new coordinates; earlier dashboard artifacts are retained.

36 Spanish messages × 3 formulations × 2 contexts × 2 repetitions = 432 calls.
Each condition has 72 calls. All arms assess all 45 native catalog skills;
Choice has 45 questions, Noul 90. Input states retain the prior native-export shape.
There is no generative evidence/explanation stage and no four-item reporting cap.
The original arm's question wording is unchanged. Structured Choice changes both
category descriptions and explicit field references. Noul changes decomposition
and wording. This is a package comparison, not a controlled attribution of gains
to one isolated prompt feature or primitive. [@typesafeChoice2026] [@typesafeNoul2026]

The 18 earlier fixtures plus 18 new lexical variants cover six focal skills with
full, partial and absent evidence. New cases are not independent samples: their
structures closely resemble the earlier examples. Cases and labels were authored
and reviewed by the same agent against the existing catalog before calls. This is
not independent adjudication. Partial/full boundaries remain contestable. Only
focal targets are scored; all other 44 skill outputs remain inspectable but unscored.
No model results were used to modify this frozen design.

The two contexts use no previous exchange versus the same four earlier partner
utterances. They test source contamination, not longitudinal learner progress.
Formulation order rotates within each case/context/repetition. There are no
automatic retries. Access/rate/contract failures stop the runner. Semantic or
consistency failures are retained as failed outcomes. Plan reservation: $6.006620;
actual cost is taken only from receipts.

## Frozen evaluation choices

- Primary decisions use threshold ≥0.50 for all formulations. Choice evidence is
  P(demonstrated)+P(partial), full is P(demonstrated). Noul uses independent
  evidence and full probabilities. This matches the two binary tasks and differs
  from the prior dashboard's categorical-argmax operating point. Original Choice
  labels/probabilities are retained, not overwritten.
- Primary comparison uses matched valid triples. All-available valid results can
  also be viewed. Failed calls never become correct rejections. Cost includes
  failed calls; unknown billing is unknown. Latency summaries use valid calls;
  individual failure latency remains in the inspector.
- Full-demonstration negatives include partial references. Detecting some evidence
  and avoiding over-credit are separate outcomes. No combined quality score or
  automatic cost/speed/accuracy weighting.
- Independently judged Noul answers may contradict: full ≥0.50 with evidence <0.50.
  Each task retains its actual answer; neither is repaired. Probability ordering
  full > evidence +0.001 is counted separately across all 45 skills. These checks
  are internal coherence checks, not reference-label errors.
- ROC/threshold sweeps are exploratory. There is no held-out threshold tuning,
  population confidence interval, significance claim, validated calibration or
  approved noninferiority margin. Repetitions and contexts share messages.
- SDT d-prime/criterion use the existing log-linear correction; raw rates and ROC
  do not. [@hautus1995] The dashboard exposes task, case-set, context, focal-skill
  and valid-cohort controls plus exact outcome inspection.
- Maps use 90 binary decisions encoded as 180 yes/no coordinates, deduplicated and
  normalized. Shared negative decisions can dominate similarity. Geometric
  separation is not evidence of higher accuracy. All seeds/settings and
  neighborhood-preservation measures remain visible.

## Reproduction

```sh
node tools/benchmarks/conversation-prompts/assessment/jev-alone.ts plan OUT
node tools/benchmarks/conversation-prompts/assessment/jev-alone.ts live OUT
node tools/benchmarks/conversation-prompts/assessment/jev-alone-build.ts OUT --profiles-only
/tmp/skelly-prompt-analysis-venv/bin/python tools/benchmarks/conversation-prompts/explorer/project.py OUT --profiles
node tools/benchmarks/conversation-prompts/assessment/jev-alone-build.ts OUT
```

Live execution reads the existing key through the shared credential loader
(`server/.env` supported); never place it in a command argument or dashboard.
The plan and runner refuse overwrites. Rerunning live commands spends money and
requires a new study directory and authorized scope, not an automatic retry.

## Sources and limitations

- [Choice](https://docs.typesafe.ai/primitives/choice): structured categories and parallel questions.
- [Noul](https://docs.typesafe.ai/primitives/noul): binary probability, optional true/false criteria, independent questions; 0.5 is uncertainty, not proficiency.
- [State](https://docs.typesafe.ai/concepts/state): structured inputs; English is the primary training language and non-English accuracy is lower.

This remains a small Spanish synthetic study. It does not establish learning
validity, multilingual accuracy, quoted-source grounding, longitudinal assessment,
real learner robustness, or safe unattended reward publication. No provider route,
app output contract, learner data, account, deployment or Git commit is changed.


## Observed results

Actual recorded spend: **$0.28077336**, no unknown billing. 427/432 responses valid;
5 consistency failures retained, no retries. 139 matched triples (5 failed calls
and 10 valid counterparts excluded from primary quality). 36 distinct messages,
not 139 independent examples. The 18 new cases remain close lexical variants.

| Formulation | Full hits / positives | Full false alarms / negatives | Valid | Median / p95 ms | Recorded USD / valid |
|---|---:|---:|---:|---:|---:|
| Original Choice | 46/46 | 13/93 | 142/144 | 270 / 341 | 0.000462035 |
| Structured Choice | 46/46 | 0/93 | 141/144 | 325 / 406 | 0.000857146 |
| Two Noul judgments | 46/46 | 0/93 | 144/144 | 302 / 391 | 0.000654908 |

All three detected some evidence with 91 hits, zero misses, zero false alarms,
and 48 correct rejections in the matched comparison. Full-demonstration ROC AUC
is 1.000 for all three on these fixtures. Thus the fixed-threshold improvement is
not evidence of better ranking discrimination. Original Choice's full scores range
up to 0.78 on negatives and start at 0.94 on positives in all-valid data: another
threshold could separate these same cases, but choosing it here is post-hoc.
Structured Choice's corresponding bounds are 0.31 / 0.93, Noul's 0.49 / 0.88.
These are descriptive ranges, not approved app thresholds.

On the new-case matched subset, Original Choice over-credits 8/47 full-negative
judgments; the other two over-credit 0/47. All three detect 24/24 full positives.
No new-case model-based prompt/label tuning occurred. No independent held-out
calibration claim is made.

Noul had zero threshold-level contradictions across all 6,480 skill evaluations,
but 16 cases where P(full) exceeded P(evidence) by more than 0.001. These are
retained internal probability-order violations, not reference-label errors. The
five failed Choice responses selected a category 0.01 below the largest returned
probability. The conservative existing decoder rejects these near-ties; numeric
distributions are now retained for inspection. No assertion about internal vendor
rounding or cause is justified from these outputs alone. None was silently repaired.

## Interpretation and next decision

Noul is a promising implementation candidate: equal focal quality to structured
Choice at 0.50, lower measured latency/cost, no rejected responses in this run.
Original Choice remains fastest and cheapest and has equal empirical ranking.
This does not justify a final selection. The fixture set is too easy for ranking,
scoring only six of 45 skills. The next useful test is independent review plus
structurally diverse ambiguous and source-confusable learner messages, with a
calibration/evaluation family split and thresholds locked before evaluation.
An eventual classifier-first app contract can retain the learner message as source
without generating a quote or explanation; that design is not implemented here.

## Verification

All five assessment test-file groups passed, including four new Noul/study tests.
Strict TypeScript checking passed. Twelve new seeded 2D/3D PCA, t-SNE and UMAP maps
were fitted to 178 unique 180-coordinate decision profiles, using the existing
projection machinery. Old studies were not rerun. UI inspection and final source
checks are recorded at completion below.

Final browser verification: completed totals and primary quality table matched the
saved analysis; full-demonstration false-alarm drilldown selected 13 original-arm
requests; new-case filtering showed 8/47 versus 0/47; the 16 probability-order
violations selected their 15 containing requests. UMAP 2D rendered with 178 unique
profiles, trustworthiness 0.990 and 80.3% ten-neighbor retention. Inspector layout
and map highlights were checked visually. The local viewer server was restarted
after its process stopped; the completed dashboard was reopened and verified.
`git diff --check` passed. No commits were created.
