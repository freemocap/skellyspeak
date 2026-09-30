# Recorded and synthetic model comparison

## Completed pilot analysis

The [expanded analysis and next-run plan](../../../docs/notes/model-comparison-expanded-plan.md)
distinguishes the 48 paid pilot attempts from the unexecuted larger corpus.
`quality-review.json` contains explicit post-hoc, unblinded annotations for each
pilot response. `analyze_pilot.py` applies frozen JSON schemas and limited shared
source/field checks, then computes paired descriptive statistics. It does not
substitute these checks for native acceptance or expert semantic validation.
`build_analysis_report.py` produces a PDF, statistical figures and a standalone
HTML evidence explorer from that analysis, without paid calls.

Run both scripts from the repository root with a Python environment containing
numpy, jsonschema, matplotlib and reportlab. The analysis also uses Node for
Unicode script-property checks. Local report dependencies can be placed under
the ignored `.local/report-packages/` directory. Outputs go to the private
`.local/model-comparison-analysis-2026-09-30/` directory.

## Expanded synthetic and recorded suite

`scenarios.ts` supplies fictional authored data only: ten semantic situations in
Spanish, French, Arabic, Mandarin, Japanese and Hindi, with four source-encoding
variants. The 64 exchanges represent 60 semantic scenarios, not 64 independent
meanings. Four difficulty settings are represented. The Arabic fixtures explicitly
select the existing formal variety; fixture variety is data, not a runtime
language-specific behavior exception.

Situations cover correct wording, deliberate form errors, negation, clarification,
topic changes, ambiguous references, closing, quoted directives, transcripts and
longer context. Review criteria are provisional expectations, not independently
reviewed gold labels. Adaptations are semantically related across languages;
translations, encoding variants and repetitions are not independent replications.
Linguistic expertise is still needed for defensible semantic scoring.

Each exchange becomes seven actual task requests: partner reply, coaching
feedback, learner gloss, partner gloss, brief, assistance and explanations.
The native generator seeds disposable workspaces through real application
commands, creates current captured contexts, and calls the owning prompt builders.
Partner answers used to seed history and downstream tasks are authored fixed
fixtures, not paid model responses. No real workspace is opened by that native
generator. Fictional transcript inputs contain text only, without audio.
Synthetic settings disable persona details and automatic topic selection to keep
randomly selected persona fragments and coaching focus from confounding canonical
source pairs. Recorded prompts retain their original context. This suite does not
isolate synthetic persona or automatic-focus effects.

Generate an expanded suite from an existing recorded capture and previously
price-checked plan, without network or paid calls:

```sh
node tools/benchmarks/model-comparison/generate.ts .local/model-comparison-suite-YYYY-MM-DD .local/model-comparison-YYYY-MM-DD/capture.json .local/model-comparison-YYYY-MM-DD/plan.json
```

Use a fresh output directory. Open its `index.html` for per-batch plans and exact
inputs. The resulting `suite.json` records fixture hash, semantic counts, batch
reservations and price-snapshot time. Each batch gets a separate frozen plan and
is checked against the existing $5 ceiling. The whole suite can exceed $5;
the manifest reports that total explicitly. Prices are a snapshot, not a fresh
quote; the live command always rechecks them. Generation never launches a batch.

Recorded requests form their own batch; synthetic batches are split by language.
The report preserves source, family, language, task and semantic-case identifiers.
Do not pool away a task or language regression, or treat canonical variants as
independent evidence. History windows differ by task; judge only supplied context.
Native export reconstructs gloss contracts with language context so script-aware
output fields match the app. Previously exported plans remain frozen; regenerate
into a fresh directory to use a changed exporter or fixture revision.

The full suite currently has 448 synthetic task requests plus 19 recorded ones,
or 1,868 planned calls at two models and two repetitions. New synthetic coverage
does not include fresh opening, private-coach or repair-retry scenarios; those
remain represented only by recorded cases. Speech, integrated graph timing and
free-running multi-turn rollouts remain outside this screen.

Additional offline tests:

```sh
node --test tools/benchmarks/model-comparison/scenarios.test.ts
node tools/benchmarks/model-comparison/verify.ts .local/model-comparison-suite-YYYY-MM-DD
```

## Recorded capture and execution

Private fixed-input screening of the app's selected standard and fast models.
Run from the repository root with Node 24 and the native Rust toolchain.
The workspace is opened read-only, inside a consistent read transaction.
Access settings and credentials are excluded from captured context. Saved request
messages and source text remain private: always use an ignored `.local/` directory.
Never commit a captured plan, outputs, review CSV, or generated HTML.

```sh
node tools/benchmarks/model-comparison/study.ts capture .local/model-comparison-YYYY-MM-DD
node tools/benchmarks/model-comparison/study.ts plan .local/model-comparison-YYYY-MM-DD
node tools/benchmarks/model-comparison/report.ts .local/model-comparison-YYYY-MM-DD --plan
```

An optional database path follows the capture directory. The default is the
Windows application-data location. Capture selects the latest successful attempt
for each task/language, at most two languages per task, only where the recorded
model matches the current standard selection. The standard model is compared
with the current fast selection. This selection is exploratory, not random or
representative; review exact inputs in `plan.html` before interpreting coverage.
Use a fresh capture directory to include later turns. No recording is transcribed
again and no source audio is uploaded by this tool.

Planning calls the explicit ignored native test to assemble output contracts
using current app schema builders and captured turn context. Recorded messages
are retained verbatim. Historical schemas and sampling settings are not stored
with those messages: the experiment uses current task settings (including output
limits), so it is a current-contract replay, not an exact historical replay.
The exported contract is frozen before requests start.

Planning performs public price lookups but no paid calls. It pins the same
provider endpoint for both arms, disables fallback, and refuses a reservation
above $5. The reservation bounds input by serialized UTF-8 bytes plus overhead
and output by the configured maximum, without assuming caching discounts.
The live command rechecks prices, requires an unchanged plan hash, and exclusively
creates receipts. It never resumes or retries a failed or interrupted run.

After authorization to send these private prompts through the experiment endpoint:

```sh
node tools/benchmarks/model-comparison/study.ts live .local/model-comparison-YYYY-MM-DD
node tools/benchmarks/model-comparison/study.ts replay .local/model-comparison-YYYY-MM-DD
node tools/benchmarks/model-comparison/report.ts .local/model-comparison-YYYY-MM-DD
```

The existing conversation experiment credential loader reads the local environment
or ignored server configuration. Never pass credentials on the command line.
Native replay validates successful responses without publication or app writes.
Replay/report can also inspect partial runs; missing cases and costs are explicit.
The generated report contains exact inputs, anonymous output samples, optional
measurement reveals, and a blank human review sheet. Do not overwrite a completed
review sheet by regenerating the report.

Each task keeps its prompt, schema, output budget, reasoning and sampling settings
between arms. Two repetitions reverse model order. Independent per-call replay
isolates the model difference but does not propagate alternative partner replies
through dependent nodes. Latency is full direct-response duration; response-header
time is not time to first token. It excludes hosted-service queuing, app scheduling,
speech and UI publication. A later integrated trial is needed to measure those.

Native acceptance is structural/source validation, not a quality score. Coaching
validation can discard unusable observations, so inspect the retained validated
artifact as well as the raw response. Gloss coverage and unresolved scalars remain
visible. Do not count rejected or missing outputs as successes, or missing costs
as zero. The standard output is not ground truth.

Score meaning preservation, linguistic correctness and task usefulness from 0
(fails) through 2 (satisfies), with concrete harmful-error notes. Review matched
cases, variability within each model, and cost per valid response. Increase case
diversity and repetitions before claiming equivalence or changing app routing.

Offline checks:

```sh
node --test tools/benchmarks/model-comparison/study.test.ts
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --allowImportingTsExtensions tools/benchmarks/model-comparison/study.ts tools/benchmarks/model-comparison/report.ts tools/benchmarks/model-comparison/study.test.ts
```

The native boundary is exercised by plan/replay and never runs in an ordinary
test invocation. The active study status lives in `docs/notes/model-comparison.md`.
