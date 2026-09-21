# Jev + Fast exact-quote experiment — 2026-09-21

**Observed result: No-Go for the first two-stage candidate.** The reusable experiment
harness and dashboard are implemented. This is not approval to adopt the candidate
or a claim that model quality passed because implementation tests pass.

## Design and provenance

Reuses the frozen final Jev decision study and its Chat assessment comparator:
60 synthetic cases, two runs each, 12 provisionally labeled focal skills, all 45
catalog skills available to the models. The original alone/before context allocation
is preserved; there are 120 pairs, not a newly balanced factorial design.

Jev answers are replayed through the actual native adapter. Its thresholded positive
skills feed the production `skill_evidence` prompt/schema. The benchmark exports the
production OpenRouter payload and pins the provider to Google AI Studio to match
the previous baseline. Fast model: `google/gemini-2.5-flash-lite`, temperature 0.7,
2,048 output tokens. No app settings or credentials are written by this experiment.

109 fresh extractor calls; seven valid Jev assessments have no implicated skills;
four earlier Jev failures remain failures. Every completed extractor response and
the saved baseline are replayed through the corresponding native validators.
The reservation was $1.491818; actual new extraction spend was **$0.0107931**.
All receipts have reported cost. No retries or replacement samples were used.

## Results

| Measure | Chat assessment | Jev + Fast candidate |
|---|---:|---:|
| Valid complete pipelines | 113/120 | 41/120 |
| Failed pipelines | 7 | 79 |
| Delivered focal hits | 59/72 (81.9%) | 13/72 (18.1%) |
| Delivered focal false alarms | 8/48 (16.7%) | 1/48 (2.1%) |
| All-attempt median latency | 808 ms | 981 ms |
| All-attempt p95 latency | 1,142 ms | 1,530 ms |
| Total pipeline cost across 120 rows | $0.01796001 | $0.065200656 |

The two-stage total includes historical Jev cost plus fresh extraction cost.
Its latency is the sum of historical Jev and new extractor measurements, not
an interleaved contemporaneous end-to-end timing comparison.

Of 109 extractor outputs, **75 fail native validation**: 63 fail exact/unique quote
binding (including empty quotes), and 12 contain unknown or duplicate skill IDs.
The current candidate rejects the whole assessment when one implicated skill cannot
be localized. Example: a response supplies several plausible exact quotes but an
empty quote for `complex_transfer`; all credit in that message is blocked.
This all-or-nothing publication policy was introduced by the candidate, and is a
major reason for the regression. It must not be confused with Jev losing its earlier
assessment performance.

Valid-only Jev + Fast hit rate is 100% on the 13 surviving positive focal trials;
that is severe selection bias if read without 79 failures. The dashboard shows both
valid-only SDT and delivered SDT. In the latter, a failed pipeline delivers no
positive evidence; this is a service-output measure, not an inferred model judgment.

## What is and is not validated

Native code retains scores, probabilities, adapter provenance and original assessment
attempt identity; the extractor cannot change outcomes or XP policy. Graph dependencies,
Fast routing, retry-only extraction, diagnostics on validation failure and one-time
credit are tested. The first candidate defers credit until all spans validate.

Exact-source matches are mechanical validity. We have **zero completed semantic
quote reviews**. `quote-candidates-review.csv` includes raw candidates (including
rejected pipelines) beside baseline quotes for review against each criterion.
`quote-review.csv` is an earlier valid-output-only worksheet; use the candidates
worksheet instead. Character overlap measures agreement, never correctness.

The dashboard reuses the original split-pane shell, Plotly, metrics, SDT, seeded
projection and original-space clustering machinery. It fits new PCA/t-SNE/UMAP
coordinates over 103 unique valid published skill profiles. Failed pipelines are
excluded from geometry and remain explicit in quality/completion tables.

## Next design decision

Revise the treatment of an ungrounded individual skill before adopting this path.
Do not silently fabricate a quote, change Jev scores, or discard every valid span
because one skill is ungrounded. Whether unlocalized skills retain assessment-only
credit or withhold only their own credit is a product-policy choice still to settle.
The current candidate should not be deployed or treated as a successful replacement.

## Verification

- Production native regression suite: 501 passed, six explicitly ignored.
- Both actual Rust validators replay the saved experiment outputs.
- Five focused experiment analysis/transport tests pass; TypeScript checks pass.
- UI reward/settings tests, UI build, preview type check and style check pass.
- Browser verified summary, raw rejected quotes, split-pane inspector and projection map.

No commits or deployment were performed. Candidate source changes remain uncommitted.
