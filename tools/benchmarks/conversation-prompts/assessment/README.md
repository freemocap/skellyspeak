# Skill assessment experiments

## Approved Spanish factorial study

The user approved the 648-request design and a **new dedicated dashboard**.
`spanish-study.ts` executes the frozen native/dense/Jev experiment; `build.ts`
builds its own viewing page from its own receipts. It reuses the explorer's
layout foundations, dividers, document serializer and projection renderer,
not the old study's data or fitted coordinates.

```sh
node tools/benchmarks/conversation-prompts/assessment/build.ts docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21 --profiles-only
/tmp/skelly-prompt-analysis-venv/bin/python tools/benchmarks/conversation-prompts/explorer/project.py docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21 --profiles
node tools/benchmarks/conversation-prompts/assessment/build.ts docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21
python3 -m http.server 8774 --bind 127.0.0.1 --directory docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21
```

Projection inputs must be frozen before fitting. Rebuilding rejects stale maps.
`recover` preserves receipts and marks any attempted call without a receipt as
interrupted/unknown; it never retries that call. Other unattempted jobs continue.
No application runtime provider configuration is changed.

See the [study record](../../../../docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21/README.md).

## Earlier interrupted pilot and design checkpoint

**Historical stage: design review.** The earlier 180-call pilot was stopped;
it is not the approved Spanish study and must not be resumed as part of it.

Reopen the dashboard with the existing explorer command:

```sh
node tools/benchmarks/conversation-prompts/explorer/explore.ts --study docs/notes/conversation-prompts/jev-design-review-2026-09-21/study.json --port 8773
```

This reuses `readRuns`, saved source IDs/hashes, `build.ts`, `renderDocument`,
the exact existing UI shell, source-space PCA/t-SNE/UMAP, full-space similarity,
highlight/pin controls and source text/prompt inspector. `analysisSource` points
at the already fitted source study; it does not generate or re-embed anything.
`assessmentRuns` attaches bounded decision receipts to source IDs. Partial runs
are explicit and the heatmap includes unexecuted planned sources as missing.
Assessment maps are not substituted for source-text embeddings.

The Design review tab exposes choices, limitations, draft stages and success
criteria. Its controls export a proposal only. The Skill decisions tab shows
the 45-skill probability matrix, paired order/repeat/model differences, costs
and latency. Clicking a cell shows exact state, criterion, full five-outcome
distributions and receipts beside the original source text/prompt.

## Source and scientific boundary

The native `inspect-content --catalog` export supplies current criteria; no
parallel catalog is authored here. Source responses come from the frozen
180-response instruction-language study. They were generated as partner text.
Assigning one to a learner in a fixture is a synthetic role manipulation, not
evidence from an actual learner. Requested source difficulty is withheld from
assessment state and is never used as an expected proficiency score.

Jev receives 45 independent Choice questions. The dense Gemini control uses
the same rubric, temperature zero and a compact array schema; native's exact
sparse-four assessment is not connected yet. This isolates some interface
properties, not every model/prompt confound. The five labels are the existing
coaching outcome vocabulary, with an explicit absence category. [@typesafeChoice2026]

The pilot sampled nine source IDs by hash within language × difficulty, without
balancing instruction wording. It paired learner/partner-only, criterion order
and array position among eight saved partner distractors. Array position keeps
chronology fixed; it is not a longitudinal recency experiment. Two repeated calls
do not establish reliability. Only the no-eligible-learner condition has expected
all-absent labels. Human-reviewed semantic labels, errors, native baseline,
calibration, held-out evaluation and decision-space distance remain design work.

## Tooling and verification

```sh
node --test tools/benchmarks/conversation-prompts/assessment/assessment.test.ts
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --allowImportingTsExtensions tools/benchmarks/conversation-prompts/assessment/*.ts tools/benchmarks/conversation-prompts/explorer/assessment*.ts
```

The runner extends the previous offline-plan/live-receipt workflow and reuses
`credential`, `boundedJson`, `checkPrices` and metadata handling. Credentials are
read from `OPENROUTER_API_KEY`, then ignored `server/.env`, then the older ignored
`server/development/.env`. No credentials go into plans or HTML.

Plans retain source hashes, native criteria, exact requests, factors, repetitions
and a conservative reservation. Pilot live execution is sequential, stops on
the first failure, refuses overwrite and has no automatic retries. Actual costs
come from receipts; missing costs are not zero. The stopped run may have one
in-flight request with no receipt. Jev requires the separate OpenRouter alpha
decisions endpoint. [@openrouterJev2026]

Offline planning syntax, for use after agreeing the design:
`run.ts plan OUT STUDY_JSON NATIVE_CATALOG_JSON [--smoke]`.
Paid execution is a separate `run.ts live OUT` action; **not approved for the historical pilot**.

See the [design checkpoint](../../../../docs/notes/conversation-prompts/jev-design-review-2026-09-21/README.md).

## Signal detection analysis

`sdt.ts` owns browser-independent trial definitions, matched cohorts, four-outcome
counts, corrected d-prime/criterion and threshold ROC. `sdt-panel.ts` renders the
new tab and sends selected outcomes to the existing inspector. No new model
calls are needed. Tests: `node tools/benchmarks/conversation-prompts/assessment/sdt.test.ts`.
The [analysis record and proposed follow-up](../../../../docs/notes/conversation-prompts/jev-spanish-factorial-2026-09-21/signal-detection.md)
distinguish implemented reanalysis from the unexecuted next study.

## Jev alone: formulation study

`jev-alone.ts` freezes and runs the original Choice / structured Choice / two-Noul
comparison. `jev-alone-analysis.ts` scores independent binary evidence/full tasks;
`jev-alone-build.ts` and `jev-alone-view.*` build its separate dashboard using shared
metrics, SDT, split-pane and projection machinery. Tests include the documented
Noul response shape, all-skill/state matching and contradictory binary decisions.
See the [frozen study and results](../../../../docs/notes/conversation-prompts/jev-alone-2026-09-21/README.md).

## Jev + Fast exact-quote comparison

`two-stage.ts` extends the final decision study with the production native quote
extractor. `plan OUT PREVIOUS_DECISION_STUDY` reuses its 120 paired Jev/Chat runs,
exports the real Rust prompt/schema/payload, freezes requests, and reserves at most
$3. `live OUT` executes only the required Fast calls and refuses an already-started
run. `replay OUT` validates returned quotes with the production Rust validator and
refuses changed production source hashes. No automatic retries or new Jev calls.

Replay the saved Chat baseline too: copy its `current/replay.json` to
`OUT/baseline-replay.json`, then run the existing `replay_assessment_experiment`
ignored Rust test with `SKELLY_ASSESSMENT_REPLAY` set to that absolute path.

`two-stage-build.ts OUT --profiles-only`, the existing `explorer/project.py OUT
--profiles`, then `two-stage-build.ts OUT` build the dedicated dashboard. It includes
all-pipeline and valid-only SDT, composed latency, actual total cost, paired source
quotes, raw invalid outputs, requests/receipts, projection maps and an unscored
semantic quote-review worksheet. Existing review worksheets are never overwritten.
Run `node tools/benchmarks/conversation-prompts/assessment/two-stage.test.ts` for
five focused regression checks. No valid-only success rate constitutes an adoption gate.

See [the first candidate's No-Go report](../../../../docs/notes/conversation-prompts/jev-two-stage-2026-09-21/README.md).
