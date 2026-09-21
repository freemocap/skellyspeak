# Jev Spanish skill assessment experiment

Status: approved design, implemented apparatus, completed execution with retained failures.
Dedicated dashboard: http://127.0.0.1:8774/ (local server required).
This is separate from the earlier source-prompt design dashboard on port 8773.

## Agreed design

12 synthetic Spanish cases × 3 assessors × 3 placements × 2 criterion orders
× 3 repetitions = **648 requests**, 18 conditions with 36 requests each.
Four case families, three cases each: clear evidence, partial attempts, absent
skills, partner-only evidence. All assessors see the same current learner text
and 45 current native meaning-based criteria. References were authored before
inference. They are provisional agent-reviewed labels, not human ground truth.

Assessors: actual native sparse-four system prompt and schema exported by Rust;
Gemini 2.5 Flash Lite answering all 45 criteria; Jev 1.13 on OpenRouter's separate
alpha decisions API. Both LLMs use temperature 0.7 and Google AI Studio with no
fallback. Native returns quotes/rationales (2048 output-token limit); dense
returns labels only (4096 limit); Jev returns native probabilities. Thus this
is an end-to-end pipeline comparison, not an isolated model-only experiment.

Alone has no preceding context. Before/after moves the current learner message
relative to the same partner distractors in JSON serialization; chronology and
ownership are preserved. This tests field-position sensitivity, not real-time
forgetting. Normal/reversed changes criterion order. Sequential execution rotates
assessor and case order. Three repeated calls are not three independent learners.

## What is visible and what is not claimed

- Quality: case-macro positive-evidence recall and false credit separately;
  partial-versus-demonstrated agreement by case and individual target inspection.
  Unlisted reference targets are unknown/unscored. All-absent controls score all45.
  Missing native items mean **unreported**. For absence references, an omission
  counts as no false credit, never as an explicit model absence prediction.
- Reporting ceiling: the nine-positive-target case allows native at most4/9.
  Inspect this separately from smaller cases; no hidden ceiling adjustment.
- Speed: median and nearest-rank p95 request-through-validation milliseconds,
  plus distributions. Successful calls only, failures displayed explicitly.
- Cost: provider-reported receipt cost, totals and known USD per successful
  assessment, including known spend on failed calls. Missing billing is unknown.
  The $8.113047264 pre-run reservation is a conservative bound, not actual spend.
- Stability: paired criterion order, paired before/after, and all three repeat
  pairs within a condition. Pair distributions are descriptive, not independent
  samples for significance claims.
- Geometry: new assessment-output maps, not source-text embeddings. Each of45
  skills contributes a three-component one-hot reporting vector: demonstrated,
  partial, neither reported. The last component combines other judgments and
  native omissions without claiming skill absence. Cosine geometry is normalized,
  unique profiles are deduplicated for fitting, repeated observations overlap.
  Same PCA/t-SNE/UMAP implementation/settings and full-space HDBSCAN as prior
  explorer; seeds, trustworthiness and neighbor retention exposed. Islands are
  not quality/proficiency scores. No calibration claim for Jev probabilities.

The full frozen requests, catalog, case references, receipts (including validation
failures), source hashes, provider metadata and projection settings remain
inspectable. No quality/cost/speed weighted score or production recommendation.
Spanish only; tiny authored case set; partial-reference semantics need human
review before broader conclusions. The three partner-only fixtures share the
same learner punctuation and differ only in partner wording; they are not
independent learner samples.

## Execution and recovery

The first process was interrupted after140 completed receipts, with call141 in
flight. Its outcome, latency and billing are unknown; it was marked interrupted
and was not retried. `recoveries.jsonl` records recovery. The runner source changed
to support explicit recovery after the original plan was frozen; frozen request
hash/content, reference labels and conditions were not changed. Independent
validation failures are retained and do not stop remaining unattempted jobs;
authentication, credit or rate-limit errors stop the run. No automatic retries.

## Files and reproducibility

`plan.json`: authoritative frozen requests and pre-inference references.
`offline-draft-plan.json`: superseded offline draft, never executed.
`native-export.json`: real Rust prompt/schema export for each case/condition.
`attempts.jsonl`, `results.jsonl`, `run.json`, `recoveries.jsonl`: execution record.
`analysis.json`, `profiles.json`, `projections.json`, `index.html`: derived reports.

Build and serving commands are in the assessment tooling README. Credentials
come from the environment or ignored `server/.env`; no credentials are embedded.
Plotly 3.1.0 loads from its existing CDN; data are embedded locally in the HTML.

## Verification

Native skill-assessment tests: 3 passed; export test is explicitly ignored in
ordinary runs and was run successfully to generate this study's native export.
Assessment transport/reference tests and strict TypeScript checks passed during
implementation; final checks and result counts are recorded below when complete.

## Final execution record

648 unique attempts; 642 valid responses, 6 failed/interrupted outcomes. No retries. Recorded spend $0.370347; 1 request has unknown billing. See `verification.json` for checks and failure details.

| Assessor | Valid | Positive recall | False credit | p50 ms | p95 ms | Known $/valid |
|---|---:|---:|---:|---:|---:|---:|
| sparse | 212 | 69.2% | 0.23% | 576 | 1106 | 0.000127 |
| chat | 215 | 77.5% | 6.46% | 2805 | 3155 | 0.001139 |
| jev | 215 | 92.8% | 0.15% | 272 | 370 | 0.000458 |

Final verification: 9 assessment tests passed (5 transport/pilot, 4 Spanish/reference/scoring); strict TypeScript passed; 3 native assessment tests passed; git diff whitespace check passed; credential exclusion check passed. Browser checks confirmed matrix-to-probability inspection, design view and selection/reset with no logged JavaScript errors. Rejected item content was not retained, so failed-call raw-response reconstruction is unavailable.

Final projections: 159 unique reporting profiles; 12 new fitted views (2D/3D
PCA, two t-SNE perplexities, three UMAP parameter/seed combinations). Browser
verification confirmed UMAP 2D and 3D rendering, criterion probability inspection,
Jev group selection (216 attempts), pinned highlights, and reset. No browser
JavaScript errors were logged. The dedicated dashboard was left open on the
completed quality/speed/cost comparison. Changes remain uncommitted.
