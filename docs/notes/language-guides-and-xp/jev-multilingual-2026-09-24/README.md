# Jev multilingual assessment study

Status: complete. 2,304 billed requests, $0.189583968 total, three invalid
distributions retained, no transport failures or retries. This report is an experiment, not an implemented
app contract. No app runtime or generated language-guide rollout is included.

## Product decision after review

The user adopted baseline B and closed this prompt-strategy investigation.
Observed agreement is accepted as sufficient to proceed with development; it is
not an equivalence result or all-skill validation. Rich examples and explanations
remain in static learner guides. See the [adoption decision](../baseline-assessment-decision.md)
and [next development steps](../evaluation-xp-refactor-plan.md). The results and
frozen experimental inputs below are unchanged.

## Scope

Spanish (Mexico), Arabic (Levantine only; no MSA), and Chinese (Mandarin,
simplified). Two skills: possession/relationships and past reference. Each request
assesses both skills, but reference agreement is scored only for the designated
focal skill, on evidence and expression equally. It is not a percentage score for
all 12 proposed skills or general language ability.

48 scenario variants per language form 24 paired scenario clusters. Translations
and repeats stay inside their original cluster. 144 cases × eight conditions ×
two repetitions = 2,304 requests. All scenarios and requests were frozen before
inference. The exact Spanish request bodies and references match the preceding
study's 48 challenge cases. No post-result reference edits or selective reruns.

The default includes all 48 cases per language, including eight preflagged cases.
An explicit filter retains 40 unflagged cases per language. Flags remain provisional
and were inherited from the Spanish scenarios; translated cases have not received
independent native-speaker adjudication. Equivalent intended meanings do not ensure
equivalent difficulty or grammatical ambiguity across languages.

## Conditions

| Arm | Strategy | Language adaptation |
| --- | --- | --- |
| A | Criteria-centered | Shared English criteria |
| B | Concurrent baseline | Language-specific guidance |
| C | Local-language rubric | Spanish, Levantine Arabic or Chinese rubric |
| D | Joint assessment | Shared English joint labels and criteria |
| E | Misleading control | Deliberately incorrect guidance; excluded from candidate summaries |
| F | Concrete questions | Shared English questions |
| G | Decision procedure | Shared English rules |
| H | Examples in criteria | Language-specific examples |

These are bundled strategies, not an orthogonal factorial experiment. Each
request contains four separate Choice judgments, except D's two joint judgments.
D's winning joint category is split into evidence and expression; probabilities
are marginalized separately. Joint structural consistency is not independent
evidence of superior interpretation. Criteria themselves carry substantial task
information even when the surrounding instruction is short.
[@typesafeStructuredChoice20260924] [@typesafeJaggedness20260924]

## Analysis

Each case has equal weight within an arm, each repetition equal weight within a
case. Pooled languages have equal numbers of cases. E never enters candidate
rankings, candidate performance summaries, transitions or repeatability summaries.
It has its own agreement interval. Total experiment spending includes E.

The primary default is all 144 cases across 24 semantic clusters. The dashboard
shows 95% pointwise cluster-bootstrap intervals for agreement and six adjusted
candidate-versus-B comparisons, using 5,000 paired resamples and percentile tails
at .025/6 and 1−.025/6. Coverage is approximate at this small cluster count. Language,
skill, judgment and ambiguity slices are exploratory; the six-contrast adjustment
does not cover searching across those slices. Failure to separate strategies is
not proof of equivalence. No numeric acceptance threshold is being retrofitted.

The separate historical panel uses identical Spanish scenarios and filters in
both rounds. Previous five-repeat and current two-repeat estimates remain separate;
historical responses never enter current estimates. Changes there are descriptive
run-to-run differences, not a prompt treatment effect.

The previous API audit showed occasional choice differences for identical inputs.
This round retains two identical requests per case/arm to measure that stability,
without pretending repetitions add independent scenarios. No temperature parameter
is supplied. [@openrouterDecisionsSchema20260924]

Billed invalid judgments remain recorded without retry. Missing judgments count
as non-matches. Invalid pairs are excluded from repeat-variability calculations;
valid partial judgments remain available. Latency charts show observed percentiles,
not confidence intervals. Billing is provider-reported USD per whole request.
A conservative reservation of $2.216790576 against a $5 cap was checked before
inference; actual spending is reported separately.

## Language content provenance

Inputs and local rubrics were AI-authored for this study, not human-approved
teaching content. Levantine guidance is not substituted from MSA. A primary
teacher's past-tense lesson informed the Levantine scope.
[@nassraLevantinePast20260924]
Mandarin guidance permits context/time expressions to establish past meaning
without demanding tense inflection or a specific particle, and recognizes close
possessive relationships that omit de. [@chineseBoostPastEvents20260924]
[@libretextsChinesePossession20260924] These sources do not validate our individual
translations or reference labels. The same author supplied prompts and cases;
there is no blind external benchmark or independent gold standard.

## Rebuild and inspect

These commands only analyze saved receipts and serve the report; they do not
make model calls:

```sh
node tools/benchmarks/conversation-prompts/assessment/skill-strategies/repeat-audit.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/build.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/serve.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
```

[Dashboard](index.html) · [frozen requests](plan.yaml) · [receipts](receipts.yaml) ·
[summary](summary.yaml) · [repeat audit](repeat-audit.yaml)

## Results

| Candidate | Spanish | Levantine Arabic | Chinese | Pooled |
| --- | ---: | ---: | ---: | ---: |
| A | 82.29% | 77.08% | 82.29% | 80.56% |
| B | 86.98% | 85.94% | 86.46% | 86.46% |
| C | 85.94% | 79.69% | 81.77% | 82.47% |
| D | 79.17% | 73.96% | 82.29% | 78.47% |
| F | 82.29% | 78.65% | 81.77% | 80.90% |
| G | 81.25% | 75.52% | 81.77% | 79.51% |
| H | 86.98% | 82.29% | 84.38% | 84.55% |

These point estimates use all 48 cases per language; the dashboard and summary
provide uncertainty intervals. Pooled B has 95% interval 78.13–93.75%. Every pooled
candidate difference interval includes zero. In the exploratory Arabic slice,
D−B is −11.98 points [−25.00, −1.56] and G−B is −10.42 [−22.92, −0.52], using the
six-contrast adjustment within that slice. This does not adjust for searching
across languages and other filters. It is a signal for case inspection, not a
confirmed cross-language causal explanation.

Matched Spanish B changes from 86.25% to 86.98% (+0.73 points) with identical
cases, references and request bodies. Previous five-repeat data remain separate.
There is no unexplained ten-point improvement in this matched comparison.

Control E: 43.58% [28.99, 58.16], outside candidate summaries. Of 1,005 candidate
groups with two valid identical-input responses, 36 changed a focal answer and
949 changed probabilities. This observed variability does not identify its cause.

[Interpretation](discussion.yaml) records provisional implications. Baseline B
is a reasonable reference for the architecture discussion, not a proven optimum.
Generating all guides, setting XP curves, and runtime integration are deferred.

Verification: 13 relevant automated tests and strict TypeScript checks passed.
Actual saved-data DOM checks found no rendering exceptions or NaN values.
Actual-data checks also exercised every language, judgment dimension, reference
filter and the matched historical panel. A loopback browser load confirmed the
report's rendered content, scope labels, tables and links; this was not a screenshot
review of every panel. Changes remain uncommitted.
