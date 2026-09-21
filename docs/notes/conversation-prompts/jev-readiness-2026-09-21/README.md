# Jev app-contract readiness experiment

Status: completed experiment; candidate failed the predeclared readiness gate. Dedicated viewing
page at http://127.0.0.1:8775/ while the local server is running. Builds on the
existing experiment runner, receipts, Rust prompt exporter, SDT module and viewer.
The original study and its 8774 dashboard remain separate.

## Decision being tested

Can Jev screening plus a narrowly scoped evidence-extraction call produce useful,
valid app assessments at acceptable quality, latency and cost? This is not an
uncapped 45-skill production redesign. Current app outputs require at most four
construct IDs, exact source quotes, demonstrated/partial outcomes and short native-
language rationales. Jev's classification API does not supply that artifact.

72 paired assessments: 18 Spanish messages (six focal skills × absent/partial/full)
× two contexts (none/four preceding partner messages) × two repetitions.
Three displayed paths: current assessor, Jev screening, candidate Jev+evidence LLM.
At most216 inference calls, $2.700032328 conservative reservation. Actual spend
is summed from distinct `calls.jsonl` receipts. Screening is reused within the
candidate, so analytical path-cost totals must not be added as experiment spend.
Candidate latency sums screening and extraction request-through-validation times;
this excludes interleaved comparator work and small local orchestration overhead.
Offline Rust validation time is not included in inference latency.

The actual Rust prompt builder supplies both contexts. All45 criteria come from
the current native catalog. Fixed normal criterion order. Both LLM paths retain
temperature0.7, 2048 output tokens, pinned Google AI Studio, no provider fallback.
Jev shortlist: P(demonstrated)+P(partial) >=0.5, rank descending, ID tie-break,
retain top4. That rule is fixed before this study, not optimized against it.
The evidence LLM gets the unchanged native system prompt and state, with only
criterion list and schema's construct enum narrowed to the shortlist. It judges
outcomes itself. Empty shortlist becomes an empty items array without a second
call. A failed screen fails the candidate; it is not silently replaced by a
baseline call. Independent request failures are retained; no retries.

Each new sentence has one provisional, agent-authored focal reference. Other
skills are unknown/unscored, not negative. Partial phrases deliberately expose
ambiguous partial/full boundaries; an independent reviewer has not adjudicated
them. This is engineering feasibility evidence, not independent accuracy proof.
No parameter tuning on these results; these are fresh cases, not a statistically
representative held-out population. Spanish text only; other languages, speech
transcripts, assistance metadata, long inputs, adversarial instructions and
interrupted-run recovery remain additional validation work.

## Acceptance and integration boundary

A Rust-rejected candidate artifact blocks unattended integration. Validate actual
returned payloads with the real `skill_assessment::validate` in disposable in-memory
SQLite fixtures. It checks field structure, cap, criteria IDs, exact learner quote,
outcomes and rationale prose. Passing proves structural/source-binding compliance,
not whether a quote semantically demonstrates a skill. Focal SDT results expose
hits, misses, false alarms and partial over-credit alongside failures and path
cost/latency. No statistical noninferiority margin or product false-alarm tolerance
has been approved, so no automatic deployment/adoption verdict is justified.

No app routing, credentials, persistent learner records, reward policy or deployment
is changed. Existing assessment publication/one-time-credit tests remain relevant.

Implementation seams confirmed by source inspection:

- `native/src/learning/coaching/skill_assessment.rs`: prompt, schema, validation and
  reward publication. Current four-item and source-binding contract retained.
- `native/src/conversations/execution/dispatch.rs`: captures assessment schema and
  prompt; candidate orchestration must preserve turn ownership and independent failure.
- `native/src/ai/transport/provider/`: existing chat structured-output adapter;
  Jev requires a decisions adapter and explicit request/receipt types.
- `server/app/inference/contracts.py`: hosted contract currently admits chat fields;
  decisions payload cannot be sent through it unchanged. Hosted routing/admission,
  billing and diagnostics need corresponding work before production integration.

Potential implementation after evidence review: a development-only shadow path,
with separate stage receipts and no reward writes; then review false alarms and
source evidence before enabling publication. This is a recommendation, not an
implemented feature or authorization for deployment.

## Artifacts

`plan.json` freezes fixtures, native-derived request templates and shortlist rule.
Actual narrowed requests are saved on call/assessment receipts as `executedRequest`;
empty shortlist means no extraction request. `attempts.jsonl` records dispatch,
`calls.jsonl` records actual paid calls, `results.jsonl` records three analytical
paths per pair. Full bounded parsed native outputs are retained for rejected-output
inspection and Rust replay. All text is synthetic. Credentials remain in server/.env.
`replay.json.validated.json` will record the actual Rust validator outcomes.

Reproduce: `readiness.ts plan OUT NATIVE_EXPORT`, then `readiness.ts live OUT`.
The exporter accepts `SKELLY_ASSESSMENT_FIXTURE` and `SKELLY_ASSESSMENT_EXPORT`.
The ignored `replay_assessment_experiment` Rust test reads `SKELLY_ASSESSMENT_REPLAY`.
Use assessment/build.ts and explorer/project.py --profiles for the viewing artifacts.


## Final result

214 distinct inference calls; $0.04887556 actual recorded spend; no unknown call
billing. 216 analytical path outcomes (screening is reused, not paid twice).
Current assessor: 68/72 valid, 779ms median, $0.000150538/valid.
Jev screening: 70/72 valid, 271ms median, $0.000468624/valid.
Candidate pipeline: 69/72 valid, 949ms summed-stage median, $0.000559985/valid.
Costs per valid assessment include known failed-path spend.

Rust replay: 68 baseline outputs accepted, 4 rejected for unbound learner quotes;
69 candidate outputs accepted, 1 rejected for an unbound quote. Two candidate
paths produced no artifact because screening failed. Every replayable output's
Rust result agreed with the benchmark validity classification. The candidate's
rejected output quoted partner wording “Si tengo tiempo, te llamaré” while the
learner had said only “Si tengo tiempo...”. This is source contamination, not
just JSON formatting. See the App contract tab for exact failure inspection.

On provisional focal labels and valid outputs, case-macro any-attempt recall:
current97.9%, screen100%, candidate88.2%; absent-focal false credit: current4.17%,
screen0%, candidate0%. Inspect full-demonstration SDT separately for partial
over-credit. These small, authored references cannot establish population accuracy.
No empty shortlist occurred; that branch is not live-validated by this dataset.

Candidate decision: do not enable this hybrid for learner credit. Its cost and
latency advantages over the current assessor did not materialize. Screening
remains interesting, but the quote/rationale contract and top-four selection
introduce a distinct integration problem. Next product choice is whether to keep
immediate generated quotes/rationales or design a separately reviewed classifier
evidence contract; neither change is implemented here.

The two Jev responses were rejected by the existing sum/argmax consistency check.
TypeSafe Choice docs specify sum1 and maximal-probability choice [@typesafeChoice2026].
The decoder did not retain those rejected distributions, so their exact numerical
cause cannot be reconstructed; do not claim a diagnosed provider defect. Improve
bounded rejected-answer capture before investigating this failure class further.

A reporting correction derives two failed-pipeline costs from the retained screen
call receipts and calls-log proof that no extraction was dispatched. Original
pipeline aggregates had null cost; raw receipts remain unchanged, and the analysis
marks this derivation explicitly. All actual billable calls have known cost.

Verification: three shortlist/fixture/extraction tests, existing transport/scoring
checks, strict TypeScript, real native exporter and replay, three native skill-
assessment behavior tests. 85 unique output profiles generated 12 new seeded
PCA/t-SNE/UMAP projections. No app defaults, stored learner data or rewards changed;
no commits or deployment.
