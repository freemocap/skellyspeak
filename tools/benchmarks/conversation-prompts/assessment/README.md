# Skill assessment experiments

## Current shared-skill study — completed, baseline B adopted

The 2026-09-24 prompt-strategy investigation is closed. The user selected baseline
B for development. The [decision](../../../../docs/notes/language-guides-and-xp/baseline-assessment-decision.md)
and [current execution plan](../../../../docs/notes/language-guides-and-xp/evaluation-xp-refactor-plan.md)
supersede further-sweep suggestions in earlier reports. No new inference is queued.
These tools are research machinery, not runtime dependencies.

### Source map

| Owner | Responsibility |
| --- | --- |
| `skill-pilot/plan.ts`, `run.ts` | Shared YAML/hash helpers, bounded execution, pricing, receipts and validation; no automatic retries |
| `skill-expanded/` | Earlier repeated three-language study and reusable dashboard |
| `skill-sensitivity/` | Spanish description variants and misleading control |
| `skill-strategies/` | Eight strategic contrasts, paired Spanish cases, joint-choice fixtures and exact-input repeat audit |
| `skill-multilingual/` | Latest matched Spanish/Levantine/Mandarin study; declarative inputs and local guidance, frozen plan generator and bounded runner |
| `skill-expanded/dashboard/` | Saved-receipt builder, joint normalization, cluster statistics, transitions, HTML client, multilingual panels and loopback server |

Each study owns a dated output directory under
`docs/notes/language-guides-and-xp/jev-*-2026-09-24/`. Preserve `plan.yaml`
(exact payloads, references, jobs and hash), `run.yaml` (price/run metadata),
`attempts.yaml` when present, `receipts.yaml` (outcomes, validation and billing),
`repeat-audit.yaml`, `summary.yaml`, `discussion.yaml`, `README.md`, and `index.html`.
Expected labels and review notes stay outside provider payloads. Credentials are
not written to these artifacts. Do not overwrite frozen studies to test a new idea.

### Offline reproduction — no model calls

From the repository root:

```sh
node tools/benchmarks/conversation-prompts/assessment/skill-strategies/repeat-audit.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/build.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
node tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/serve.ts docs/notes/language-guides-and-xp/jev-multilingual-2026-09-24
```

The server prints its loopback URL. The built HTML embeds its data and script and
can also be opened as a file. Linked YAML reports require the server or adjacent
files. The multilingual builder reads the sibling `jev-strategies-2026-09-24`
plan/receipts for the historical Spanish panel; keep that study alongside it.
Missing or incomplete required receipts fail the build rather than producing a
completed-looking report. Rebuilding replaces derived summaries/HTML, not inputs
or receipts. It can reflect later renderer changes; preserve the existing HTML
if the exact historical presentation needs to be compared.

### Future reuse — only when a new question is selected

1. State the question, case population, controls, comparisons and analysis defaults.
   Retain paired scenario clusters across translations and repetitions. Avoid a
   full factorial sweep unless it answers that question.
2. Reuse the relevant case/strategy builder, write to a new dated directory, freeze
   exact requests, references, model, repetitions, control arms and spend bounds.
   Baseline B's exact adopted payloads are `arm: B` jobs in the latest frozen plan.
3. Keep plan generation and paid execution separate. The current multilingual
   `plan.ts OUT` creates a plan; `run.ts OUT` makes live calls. Its wrapper is
   intentionally bounded to 2,304 calls and $5: a differently sized study must
   declare its own reviewed bounds, not bypass those checks.
4. Retain all receipts, including invalid outcomes and unknown billing. No
   automatic retries. Any deliberate continuation must retain prior attempts and
   explain its scope; do not rerun failures until they disappear.
5. Reuse normalization, repeat audit, statistics and dashboard components. Keep
   controls out of candidate summaries, expose case counts/defaults and invalid
   judgments, and compare historical runs only on explicitly matched cases.
   The current baseline-comparison statistics assume B occupies index 1; changing
   arm order or baseline requires updating and testing that assumption.
6. Report observed results and limitations before making another product decision.
   Translated cases and repeats do not increase the independent scenario count.

### Focused verification

```sh
node --test tools/benchmarks/conversation-prompts/assessment/skill-pilot/run.test.ts tools/benchmarks/conversation-prompts/assessment/skill-expanded/study.test.ts tools/benchmarks/conversation-prompts/assessment/skill-expanded/dashboard/page.test.ts tools/benchmarks/conversation-prompts/assessment/skill-strategies/study.test.ts tools/benchmarks/conversation-prompts/assessment/skill-multilingual/study.test.ts
```

The completed round passed 13 tests and strict TypeScript checks. Tests cover
request balance/reference isolation, unchanged Spanish payloads, repeated-sample
clustering, partial validation, joint normalization, adjusted intervals and
multilingual dashboard filtering/control exclusion. Saved-data and browser-load
checks are recorded in the report. These are historical results, not a claim that
merely reading this guide reruns verification.

## Historical investigations

The sections below describe the earlier September 21 system and studies. Their
approval, pending-work and catalog statements are historical, not instructions
to restore the old system or start new calls.


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
