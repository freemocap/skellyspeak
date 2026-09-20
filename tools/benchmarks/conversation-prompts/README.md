# Conversation prompt experiments

## New isolated study: instruction language

The [English versus target-language study](../../../docs/notes/conversation-prompts/explorer-instruction-language-2026-09-20/README.md) contains **180 new responses only**, with Relationship/T=1.1 across Spanish, Arabic and Mandarin. Reopen it with:

```sh
node tools/benchmarks/conversation-prompts/explorer/explore.ts --study docs/notes/conversation-prompts/explorer-instruction-language-2026-09-20/study.json --port 8771
```

The comparison itself made no app changes. After reviewing it, the user chose
English shared instructions for simpler maintenance; these are now adopted in the app.

## Current decision and resume point — 2026-09-20

**Selected by the user: Prompt 2, Relationship, temperature 1.1.** This supersedes
the earlier numerical recommendation of Prompt 6. Top-p and top-k remain unset.
The app keeps its configured model; the screening model was Gemini 2.5 Flash Lite.

Run from the repository root:

```sh
node tools/benchmarks/conversation-prompts/explorer/explore.ts
```

Open http://127.0.0.1:8770/. This rebuilds the viewer from saved results and starts
a local server. It makes **no paid calls**. If a server is already running there,
use it, or pass `--port 8771`. Stop this command with Ctrl+C. Requires Node 22.22+
(or 24), installed repository npm dependencies, and Python 3 for the local server.

The current study is `docs/notes/conversation-prompts/explorer-hybrid-2026-09-20/study.json`:
7 frozen runs, 1,680 responses, cached embeddings, PCA/t-SNE/UMAP fits, full-space
similarity and clustering, exact prompts and grouped responses. Pass `--study PATH`
to reopen another saved study. Keep entire study and generation directories;
the HTML alone is a convenient viewing snapshot, not the reproducibility record.

Use the top-level prompt, difficulty, persona and sampling buttons to highlight
conditions. Highlights add outlines; the plots retain all observations. Pin sets
to compare multiple layers. The right panel shows selected responses or exact
prompts; use **Show full report** to inspect all conditions. Both panel dividers
are resizable. Click Prompt 2 and T=1.1, then Exact prompts to inspect the winner.

### Runtime source and adoption

The app reads `content/prompts/conversation/instructions.yaml` through the Rust
builder (`native/src/conversations/conversation_prompt.rs`), version
`conversation-37-relationship-english`. It never reads a notes-folder prompt.
Relationship behavior and the three difficulty descriptions use the English wording
from the instruction-language comparison, with 3–5 / 6–11 / 13–23 word guidance.
English is the instruction language, not a fixed output language;
app language/writing-system guidance, persona projection, topic and tense controls
remain available. No example bank or fixed opening-situation rotation is active.
Advanced/Fluent retain their existing descriptions. Languages without word spaces
use the same intended simplicity; those adaptations were not tested in this study.

Conversation openings/replies select T=1.1 in
`native/src/conversations/execution/dispatch.rs`; shared dispatch payload assembly
carries it through direct, streamed and grouped requests. Other tasks keep T=0.7.
Prepared inference diagnostics record temperature. No top-p/top-k override is added.
The app integration is not a byte-for-byte copy of the synthetic Lucía request.

Start a **new conversation** in a rebuilt app to assess fresh openings. Existing
messages remain context and can perpetuate old behavior. Content edits trigger
native rebuilds during `npm run tauri dev`; packaged apps need a fresh build.

### Steer the next round

1. Review actual responses alongside measurements. A question mark, low similarity
   or correct word count alone does not establish quality. Check meaningful details,
   answerability, grammar, agency and whether a reply can develop the exchange.
2. Agree on a new generation together. Keep Relationship/T=1.1 as the control.
   Do not silently optimize prompts or ban specific ordinary words such as “hoy”.
3. Add a separately named candidate set; preserve existing builders and frozen plans.
   The reviewed four prompts are in `spanish-reset.ts`; the last hybrids are in
   `spanish-hybrid.ts`. Change one hypothesis at a time when possible.
4. Plan into a fresh directory first, inspect `plan.json`, then explicitly run `--live`.
   Sampling flags must match the plan. The runner exposes `--temperature` and `--top-p`; these sample **tokens**, not a ranked list of complete responses. Top-k is
   not currently exposed by the runner; add it as a separate reviewed factor if needed.
   Use the same 3 levels × persona on/off × 10 repetitions for comparable rounds.
5. Create a new study directory, preserve prior snapshots, extend the manifest with
   run paths/round labels/plan hashes, and reuse cached embeddings with receipts.
   See [explorer workflow](explorer/README.md) for embedding, projection and study commands.
6. Record both numerical evidence and human judgment in the study recommendation.
   Inspect length/complexity separation and within-condition similarity together.
   PCA/t-SNE/UMAP are exploratory views; compare full-space distances and seed/settings
   stability rather than treating a 2D island as proof of a meaningful category.

Next validation: new app conversations at all three selected levels, followed by
choice, clarification, refusal, topic-change and goodbye continuations. Spanish
openings support the decision; multilingual and multi-turn quality remains to be
assessed. No new paid experiment was run during this adoption step.

## Earlier screening workflow and reference fixtures


Active standalone text-only screening tool. Initial batches use synthetic Spanish
conversations, the frozen Lucía persona and working-tree snapshot in `fixture.json`.
Broader batches use `validation-fixture.json`: the full conversation-23 reference
and Spanish, Arabic and Mandarin starter personas, with source hashes.
It does not read conversations, modify app data or change production prompts.
The fixture records source hashes. Its current baseline includes the edited `.`
ceiling and `..` opening; it is not the previously approved conversation-23 prompt.
Historical candidate studies assemble prompts independently in TypeScript. For
implementation verification, `--native-prompts FILE` consumes the real Rust builder
export and bypasses the independent candidate assembly.

Run from the repository root with Node 24 (also verified with local Node 22.22.3):

```sh
node tools/benchmarks/conversation-prompts/run.test.ts
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --allowImportingTsExtensions tools/benchmarks/conversation-prompts/*.ts
node tools/benchmarks/conversation-prompts/run.ts --out docs/notes/conversation-prompts/my-experiment
node tools/benchmarks/conversation-prompts/run.ts --out docs/notes/conversation-prompts/my-experiment --live
node tools/benchmarks/conversation-prompts/review.ts docs/notes/conversation-prompts/my-experiment
```

The first command creates an exclusive, inspectable offline plan. `--live` requires
that plan, verifies current provider price ceilings, and refuses to overwrite any
existing results. Configure `OPENROUTER_API_KEY` in the environment or the ignored
`server/development/.env`. Never put a credential in an argument or tracked file.
Network access may require sandbox approval. An interrupted/failed run is never
retried automatically; inspect saved results before authorizing a fresh run.

Use the same study flag for planning and execution:

| Flag | Calls | Purpose |
| --- | ---: | --- |
| none | 40 | Current, verbose, direct, compact; five levels; opening and fixed reply |
| `--repair` | 12 | Full/compact/no persona with strict final constraints; two low levels |
| `--factors` | 108 | Six one-block alternatives; three levels; opening/confusion/topic switch; two repeats |
| `--validation` | 135 | Full approved baseline versus compact candidates; three languages, five levels, three scenarios |
| `--dialogues` | 48 | Baseline/examples candidate; three languages, two levels, four linked turns |
| `--revision` | 48 | Examples versus ownership/grounding revision; four probes, three languages, two repeats |
| `--revision-dialogues` | 24 | Revised candidate through the same six four-turn scripts |

Use a fresh `--out` directory per batch. Linked plans contain scripted learner
messages and system prompts; `results.jsonl` also records `requestMessages` with
the actual generated history used for each call. Missing/out-of-order history fails
before a request; histories never cross candidates. Dynamic requests must remain
within the same input reservation. A failed call stops the chain and batch.
No AI learner or paid judge is used.

Pinned Gemini 2.5 Flash / Google AI Studio, temperature 0.7, reasoning disabled,
512 maximum output tokens, sequential execution, no retries or provider fallback.
The app currently allows 2,048 output tokens; the smaller experimental cap is
recorded and every tested result must end normally. No inference is made about
other providers/models, untested languages or long conversations.

Each batch reserves less than $1 using a conservative input-byte token bound plus
output maximum. Prices for unused modalities/search are excluded; cache reads and
reasoning rates must remain within text rate ceilings. There are no explicit cache
writes. Reservations are not actual costs; reports sum provider `usage.cost` and
explicitly count missing values. Unknown nonzero price fields fail closed.

`plan.json` preserves exact messages and settings. `run.json` also captures checked
prices and start time. `results.jsonl` retains generated synthetic prose separately
from bounded metadata (IDs, model/provider, finish reasons, usage, cost, timing and
selected HTTP headers). Unreviewed metadata/free text omissions are marked. The
runner stops on the first failed or truncated response and retains prior results.

`samples.md` groups outputs for reading. `blind-review.csv` hides variant names and
provides empty human scoring columns; `blind-key.csv` maps samples back to variants.
The included qualitative report is an unblinded reviewer analysis, not a completed
blind study. Sentence segmentation is a mechanical hint, never a CEFR assessor.
Segmentation uses the trial's locale. `metrics.ts RESULTS_DIRECTORY` generates
`metrics.json` with prompt/output token means, costs, latency percentiles and
punctuation screens; it refuses missing numeric usage instead of assuming zero.

For each human score use 0 = fails, 1 = partial, 2 = satisfies: difficulty fit,
concrete reply opportunity, responsiveness to learner intent, persona consistency
(N/A without persona). Record the failure, not just the score. Prefer paired
comparisons of the same scenario. In confusion trials, check simplification of the
same meaning; in topic switches, check whether the old subject is actually left.

See the [initial results](../../../docs/notes/conversation-prompts/experiment-2026-09-19/README.md).
The [broader recommendation](../../../docs/notes/conversation-prompts/recommendation-2026-09-20/README.md)
adds multilingual comparisons, actual generated histories, targeted revision,
per-case ownership review and an exact pilot candidate. Its production adoption
gates remain separate from the passing experiment-tool checks.

## Native implementation checks

Export the actual composer with
`cargo test --manifest-path native/Cargo.toml --lib export_pilot_prompts -- --ignored`.
The test writes `docs/notes/conversation-prompts/implementation-2026-09-20/native-prompts.json`.
Pass that path with `--native-prompts` for both planning and live execution.
This runs 48 calls: repeated openings across three languages and five levels,
plus six linked short-answer/confusion conversations. Plans record native version
and content hash. Exports are test artifacts, never application inputs.

Native runs record invitation failures and exit unsuccessfully if any response
fails the mechanical question screen, even when every API call succeeds. This
screen is insufficient on its own: manually review concrete answerability,
difficulty, topic continuity and simplification of the same question after
confusion. Repetition and topic drift remain failures despite question marks.

## Engagement review

`--engagement --native-prompts FILE` runs 30 fresh-opening samples and eight
fixed Arabic Absolute Zero meaning probes (choice, rejection, confusion,
reciprocal question, tiredness, topic change, repetitive history and ending).
When present, native `openingAlternatives` are real composer outputs for distinct
conversation IDs. Earlier exports without them repeat identical inputs.
`SKELLY_PROMPT_WITHOUT_PERSONA=1` with the ignored exporter exercises the existing
no-persona setting. Review intent stays out of the requests.

Read and judge the actual text: concrete interest, accessible language, an
answerable invitation, role ownership, response to intent and variety across
repeated starts. Question counts do not determine semantic acceptance. Ending
cases deliberately do not require a question. Native results are research
artifacts, not a claim that a candidate is ready to ship.

`--minimal-reasoning` compares Gemini minimal effort with a 2,048-token cap.
`--model google/gemini-3.8-flash` and `--model openai/gpt-5.4-mini` select bounded
comparison models; the latter omits unsupported temperature and does not accept
minimal effort. The Arabic-only reference model `--model openai/gpt-6-astra`
limits engagement to 16 cases, low effort and 2,048 output tokens; its reservation
ceiling is $5 rather than $1. All actual settings and provider costs are recorded.
These flags do not change app model or provider settings. Price tiers above the
conservative input bound cannot apply; no discount is used to reduce reservation.

`--level-pairs --native-prompts FILE` compares Absolute Zero and Beginner using
the same four starting-situation keys in Arabic, Spanish and Mandarin (24 calls).
Compare language demands and meaning as well as length. A shorter unanswerable
question still fails.

## Spanish identity and variety explorer

`--spanish-persona` runs 240 Spanish no-topic openings on Gemini 2.5 Flash Lite
(4 prompts × 3 levels × identity/no identity × 10 repeats). `--spanish-variation`
uses the same matrix and appends a positive grammatical-variety instruction;
it does not ban words or subjects. These flags use the shortened word targets.

See [the explorer guide](explorer/README.md) for cached OpenRouter embeddings,
linked semantic/length plots, group inspection, exact prompts, similarity search,
and reproducible build commands. These experimental prompts do not change the app.
