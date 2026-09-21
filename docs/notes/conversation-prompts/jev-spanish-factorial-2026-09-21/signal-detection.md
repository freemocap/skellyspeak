# Signal detection analysis and next-study proposal

Implemented: a Signal detection tab in the dedicated assessment dashboard, using
only the existing frozen 648-attempt study. No new paid inference. Original
references, requests and receipts remain unchanged. `sdt-report.json` exports
both detection tasks, with and without the nine-target case, in matched cohorts.

## Definitions and analysis choices

A trial is one labeled message-skill judgment under one condition/repetition.
Signal means evidence in this message, not stable learner competence.
Any-attempt task: demonstrated or partial references are positive; reporting
partial or demonstrated means yes. Full-demonstration task: only demonstrated
is positive; partial references join absent references in the negative class.
Only demonstrated judgments count as yes in this task. Unknown reference targets
are excluded. Uncertain predictions and native omissions mean operationally no
report, not explicit absence judgments; their counts remain visible.

Report hits, misses, false alarms and correct rejections, raw hit/false-alarm
rates, d-prime and criterion. Raw rates pool trials rather than averaging case
percentages. For d-prime and criterion only, add 0.5 to each of the four cells
(log-linear correction; [@hautus1995]). A missing signal or noise class yields
undefined d-prime, criterion and AUC, not a fabricated zero. Normal quantiles use
a numerical CDF approximation checked against known values. d-prime is a
mixed-fixture descriptive index with an equal-variance Gaussian interpretation;
it is not evidence that each skill/model follows that distribution.

Default to matched valid triplets: if one assessor fails, exclude its two valid
counterparts from this quality comparison. Six failed/interrupted outcomes and
12 additional valid responses are excluded by that default. The full-run speed
and cost line still includes all retained billing and displays missing costs.
Controls expose all-available, context, focal skill and cap-case scopes. Filtering
out the nine-target case is not an uncapped assessor ablation: unscored skills
can still compete for reporting slots.

Jev ROC thresholds its P(demonstrated)+P(partial), or P(demonstrated) for the full
task; response yes iff score >= threshold. Include a no-positive endpoint and
every distinct score; tied scores move together. AUC uses trapezoids. Named
operating points preserve original multiclass choices, which can differ from
thresholded binary aggregate scores. No LLM probability scores are invented.
No threshold is selected for production. Repetitions and skills within a message
are dependent; no independent-trial confidence intervals or hypothesis tests.
Easy all-absent controls dominate the pooled noise class, and labels remain
provisional. Per-skill/context controls expose some heterogeneity; generalization
requires new examples and independent label adjudication.

## Next study: proposal visible in dashboard, not executed

12 focal skills × 4 message families × 3 evidence states (absent, partial, full)
= 144 messages. Preserve topic/vocabulary within family, alter focal evidence.
Only reviewed focal targets scored. Four assessors: current max-four, same native
prompt/schema with only cap removed, existing full-list LLM, Jev. Three context
placements and two repetitions yield 3,456 requests. Criterion order fixed;
existing order sensitivity study retained separately. Split whole families 50/50
into threshold-development and held-out sets: 1,728 requests each. Never split
variants or repetitions across partitions.

Before execution: author and independently review references while blinded to
model outputs; document disagreements, exclude unresolved labels; implement
and inspect the uncapped control; freeze a priced manifest. A product-level
false-alarm tolerance remains an explicit decision. Select any operational
threshold only on development data, then freeze it for held-out evaluation.
This proposal does not assert those fixtures/reviews/controls already exist.

## Verification

Four focused tests cover partial over-credit, unknown/missing targets, failure
exclusion, matched cohorts, quantiles, finite extreme rates, missing classes,
ROC endpoints, tied scores and known AUC. Strict TypeScript and whitespace checks
passed. Existing data's aggregate evidence scores are all within [0,1]; no score
clipping is used. Browser verification recorded in the completion message.

Browser checks passed: switching any-attempt/full-demonstration tasks; focal
transfer skill; empty and nonempty false-alarm drilldowns (15 full-demonstration
LLM false alarms for transfer); threshold endpoint changes; excluding the
nine-target case. No browser JavaScript errors logged. No new API spend.
