/** Reviewable proposal. No setting here authorizes or dispatches a provider request. */
export const design = {
  status: 'DESIGN REVIEW — paid pilot stopped; no further runs approved',
  question: 'Can independent per-skill judgments produce a more complete, stable, evidence-bound snapshot than our current sparse assessment?',
  distinction: 'Expression in supplied text is not learner mastery. Jev probabilities describe its judgments; they are not proficiency scores. Partner-generated source texts are used only for explicitly synthetic role tests.',
  choices: [
    ['Source corpus', 'Reuse the 180 saved Relationship responses and their original prompts, three languages, three requested difficulty settings, cached embeddings and fitted maps.', 'This is generated partner prose, not authentic learner errors. Requested difficulty is a source condition, not a correct assessment label.'],
    ['First sampling choice', 'One hash-selected source per language × difficulty cell; nine anchors, two repeated assessments.', 'This was my unreviewed pilot choice. It is too small for quality claims and does not balance instruction-language wording. Treat completed calls as instrumentation checks.'],
    ['Skill catalog', 'All 45 current Rust-exported criteria, with five explicit evidence outcomes for each.', 'No four-item cap. Changing the output format is itself an experimental factor; do not attribute all differences to Jev.'],
    ['Model controls', 'Jev versus Gemini 2.5 Flash Lite with the same dense rubric. Native sparse-four assessment is a separate proposed third control.', 'The dense Gemini control is implemented. The exact native assessor control is not yet connected.'],
    ['Order conditions', 'Normal/reversed criterion order; same eligible evidence placed first/last among eight saved partner distractors.', 'The latter changes array position while preserving sequence numbers. It tests serialization sensitivity, not learning/forgetting over chronological time.'],
    ['Ownership control', 'Reassign the same source text entirely to the partner, with no eligible learner records.', 'All 45 should be not_observed. This is a narrow negative control, not a general language-assessment benchmark.'],
    ['Presentation', 'Keep original source-space PCA, t-SNE and UMAP; add a 45-skill heatmap, paired probability differences, timing/cost tables and evidence inspection.', 'Text-map proximity is not correctness. Decision-space projections need a separate distance choice and enough independent cases.'],
  ],
  stages: [
    ['1 · Instrumentation', 'Inspect source provenance, exact requests, complete 45-answer coverage, failures and cost receipts.', 'Some calls completed before review; the partial run is preserved below.'],
    ['2 · Synthetic controls', 'Agree minimal-pair constructions: learner/partner ownership, target/wrong language, absent/present skill, assisted/independent evidence, current-turn/window scope.', 'Draft only. Add reviewed expected outcomes before running; do not auto-label the other 44 skills negative.'],
    ['3 · Stability experiment', 'Cross batch size, criterion order, evidence position, context length and repeated calls while holding the evidence fixed.', 'Draft only. Counterbalance run order; report paired differences within source, then aggregate by source and language.'],
    ['4 · Assessment validity', 'Review genuine learner-like successes, partial attempts and errors; compare Jev, dense LLM and native sparse output.', 'Draft only. Blind review, exact evidence spans, adjudication and a held-out set are needed before calibration/accuracy claims.'],
  ],
  success: [
    ['Transport', '45 valid outcomes per request; explicit incomplete/failed calls; preserved request/model/usage metadata.', 'Passing validates machinery only.'],
    ['Ownership', 'Count non-not_observed results when no eligible learner evidence exists; report requests with any error.', 'Negative-control behavior; no claim about sensitivity to actual skills.'],
    ['Stability', 'Within-source label flips and absolute changes in P(demonstrated), separately for repeat, criterion order and evidence position.', 'Stable wrong answers remain wrong. No acceptance threshold has been agreed.'],
    ['Semantic validity', 'Per-skill confusion matrices, false credit, missed evidence and evidence-span agreement against blinded reviewed labels.', 'Unavailable until labels are reviewed. Model agreement is not truth.'],
    ['Calibration', 'Reliability plots/Brier scores on held-out reviewed cases, stratified by language; uncertainty/coverage curves.', 'Unavailable now. Negative-only controls cannot establish general calibration.'],
    ['Efficiency', 'Latency distributions and known actual costs, including failed attempts and missing-cost counts.', 'Repeated calls share texts; receipt counts are not independent sample sizes.'],
  ],
};
