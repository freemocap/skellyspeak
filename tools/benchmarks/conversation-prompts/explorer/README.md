# Prompt experiment explorer

This is an implemented standalone research tool. It reads completed Spanish
no-topic persona-comparison runs; it does not modify application prompts or data.
Frontend and tooling source live here; run data and investigation reports live in
`docs/notes/conversation-prompts/`. Notes are never runtime prompt inputs.

## Repeat the experiment

From the repository root, use a fresh output directory for every paid generation run:

```sh
node tools/benchmarks/conversation-prompts/run.ts --spanish-persona --out docs/notes/conversation-prompts/BASELINE
node tools/benchmarks/conversation-prompts/run.ts --spanish-persona --out docs/notes/conversation-prompts/BASELINE --live
node tools/benchmarks/conversation-prompts/run.ts --spanish-variation --out docs/notes/conversation-prompts/VARIETY
node tools/benchmarks/conversation-prompts/run.ts --spanish-variation --out docs/notes/conversation-prompts/VARIETY --live
```

Each is 240 independent openings: 4 prompt approaches × 3 difficulties × 2
identity conditions × 10 repetitions. Both default to Gemini 2.5 Flash Lite,
temperature 0.7 (override with --temperature 0.3 or --temperature 1.1), reasoning disabled, 512 output-token cap, no automatic retries.
The only variety change is the appended positive instruction exported from
`../spanish-reset.ts`. Persona is the minimal Lucía identity, not the app's full
persona. No topic, prior generated responses, repeated-call index, or seed is
injected into a request. Exact prompts and settings are frozen in `plan.json`.

Sampling overrides must match between offline planning and live execution. Optional
--top-p explicitly sets nucleus sampling; omission leaves the upstream default
unknown. After a failed independent-call run, --live --resume explicitly resumes
unfinished jobs against the unchanged plan, preserving failed receipts. There are
no automatic retries.

## Embed and build

```sh
node tools/benchmarks/conversation-prompts/explorer/embed.ts docs/notes/conversation-prompts/ANALYSIS docs/notes/conversation-prompts/BASELINE docs/notes/conversation-prompts/VARIETY
node tools/benchmarks/conversation-prompts/explorer/build.ts docs/notes/conversation-prompts/ANALYSIS /absolute/writable/path/prompt-explorer.html docs/notes/conversation-prompts/BASELINE docs/notes/conversation-prompts/VARIETY
```

Embedding requests use OpenRouter's embeddings endpoint, `openai/text-embedding-3-small`,
512 dimensions, batches of 32 unique texts. The API may return the provider's
unprefixed model name; both exact names are validated. Credentials come from
`OPENROUTER_API_KEY` or ignored `server/development/.env`, never the viewer.
The conservative embedding reservation must be below $0.10; current prices are
verified before calls. Synthetic outputs are the only text submitted. No prompts,
real app conversations, or user account data are embedded.

Embeddings are cached by exact-text SHA-256; the embedding plan locks corpus,
model and dimensions. A manual rerun of the command resumes missing cache entries
for the same corpus; the tool never retries automatically. Changed corpora require
a fresh analysis directory. Successful batches and failed receipts are retained.
Do not infer zero cost from a failed validation. Unknown or omitted metadata is
marked; raw responses are not dumped to logs.

`build.ts` validates complete runs and compatible vectors, computes deterministic
PCA, saves inspectable `analysis.json`, and bundles a standalone HTML application.
It uses installed esbuild and loads pinned D3 7.9.0 from jsDelivr. The viewer makes
no inference/API calls; search and full-space neighbor ranking run locally.
The build also writes `comparison.md`, `responses.md`, and `prompts.md`.
Serve the output directory with a localhost HTTP server; no application runtime
or visualization host is required.

The reader rejects unrelated languages, reply histories and non-identity scenarios.
Failed attempts are retained in source logs, while each planned trial must have
a successful final result. The standalone build limit is 20 MB; it fails instead
of silently truncating experiments.

## Explore

The left panel contains visible condition tables and blue–white–red heatmaps.
Switch to Distributions for word-count bands, complexity proxies, and PCA.
The independently scrolling right panel groups responses by prompt, difficulty,
and settings/identity, with bullet responses. Exact prompts have their own tab
and per-response buttons. Top filters and clickable tags select conditions;
table rows, heatmap cells and plot brushing select the right-hand inspection set.

Editable minimum length-fit and maximum cosine targets screen complete
30-response conditions across all three levels. They are numerical criteria,
not automatic conversational quality judgments. Selection JSON is collapsed
and prepared only on request; changing selection clears the stale export.

The current four-batch comparison contains 960 responses: original prompts at
temperatures 0.3, 0.7 and 1.1, plus positive variety wording at 0.7. Persona/no
persona remains a crossed factor. This does not cross every wording with every
temperature and does not test top_p.

## Interpretation

- Words: Unicode letter/number groups, accents retained. Sentence segmentation:
  Spanish `Intl.Segmenter`. Mean letters per word and words per sentence are
  descriptive surface measures, **not proficiency or grammatical complexity scores**.
- Distinct text: lowercase word sequence, ignoring punctuation. Opening variety:
  first two normalized words. First-word frequencies are descriptive; no opening
  is blacklisted or automatically scored as bad.
- Embeddings encode semantic similarity. They cannot tell whether a reply is
  interesting, coherent, correctly leveled, or answerable.
- PCA uses all observations, including duplicate responses, after unit normalization
  and centering. The map retains two components; explained variance is displayed.
  Coordinates do not change under filters. Duplicates overlap without jitter.
- Neighbors and mean pairwise similarity use full-dimensional cosine, **not 2D
  distances**. Viewer similarities are quantized with error at most 1/65535;
  original vectors remain in the embedding cache.
- Summary groups are run × prompt × level × identity within active filters. Counts
  change when a text/opening filter narrows them. Small cells are descriptive;
  the generation batches ran sequentially, not as a randomized interleaved
  trial. No statistical significance or transfer to larger models is claimed.

Click/drag plots to inspect overlapping points or groups. Find similar ranks
neighbors within current filters using original-space cosine. Table buttons
offer keyboard-accessible group selection. Exact prompts and generation settings
remain inspectable. No credentials are embedded.

## Verification

```sh
node --test tools/benchmarks/conversation-prompts/explorer/*.test.ts tools/benchmarks/conversation-prompts/spanish-reset.test.ts tools/benchmarks/conversation-prompts/run.test.ts
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --allowImportingTsExtensions tools/benchmarks/conversation-prompts/*.ts tools/benchmarks/conversation-prompts/explorer/*.ts
```

Tests verify accent-sensitive counting, independent trial balance and sole-prompt
change, normalization, duplicate projection coordinates, orthogonality, and
rank-two distance preservation. Browser checks cover filtering, empty search,
inspection, similarity ranking, rectangle selection, responsive layout and logs.

## Cumulative studies and nonlinear projections

Current successor: docs/notes/conversation-prompts/explorer-sampling-2026-09-20.
It contains six runs / 1440 responses, including explicit top_p0.8/1.0 at T1.1.
Selectors now highlight while retaining all points, comparison rows and responses.
Round and cluster highlighting, parameterized 2D/3D maps, and a current
human-authored recommendation are implemented. These supersede the earlier
filter-to-hide interaction described above.

Use a fresh analysis directory for an expanded corpus. Copy compatible
embeddings.jsonl and its embedding-receipts.jsonl to reuse paid embeddings,
then explicitly run embed.ts with every intended run directory. It locks that
corpus. Add study.json using the supplied example's schema: version1, id, title,
runs with repository-root-relative path, round, recordedAt and frozen planHash.
Optional recommendation records the human review; it does not trigger generation.
Run from the repository root:

```sh
uv venv /tmp/skelly-prompt-analysis-venv
uv pip install --python /tmp/skelly-prompt-analysis-venv/bin/python -r tools/benchmarks/conversation-prompts/explorer/requirements.txt
node tools/benchmarks/conversation-prompts/explorer/study.ts docs/notes/conversation-prompts/explorer-sampling-2026-09-20/study.json /tmp/skelly-prompt-analysis-venv/bin/python
```

study.ts verifies frozen jobs against their hashes, performs offline projections,
builds the viewer/reports, and records a dated study receipt. It never calls a
generation or embedding API. Preserve old snapshot directories when expanding
the manifest into a new analysis directory. Generation source remains in the
benchmark runner; new prompt generations require explicit human-authored variants
and a new frozen plan, not edits to historical plans.

project.py is scientific analysis, not frontend tooling. It fits unique texts
with cosine neighborhoods, saved seeds and pinned library versions. It computes
2D/3D PCA, t-SNE and UMAP, neighborhood trustworthiness/recall and original-space
HDBSCAN. New corpora refit layouts; coordinates across snapshots are not an
absolute spatial reference. HDBSCAN labels are descriptive and can change with
corpus/parameters. All original observations retain their counts and inspection.

Plotly3.1.0 is loaded from its CDN for lasso-selectable2D and rotatable3D plots;
D3 remains responsible for length distributions and heatmap colors. No paid calls
occur in the viewer. Legend clicks highlight rather than hide traces.

Highlight interaction correction: selection is purely additive. Base point positions, colors, sizes and opacity stay fixed; a separate hollow-outline layer marks selected points in 2D/3D and distribution plots. Text and tables retain full opacity and gain outlines only. Prompt blocks retain their original order.

Highlight groups: combine selectors, then Pin current highlight to retain a group while choosing another. Up to four pinned groups use distinct outline colors; overlapping groups receive nested outlines. Load copies a group into the current selection; Remove drops it. Reset highlights clears all groups. Selection JSON includes pinned group IDs. The divider supports mouse/touch dragging and keyboard arrows, Home/End; double-click restores the default split.

 
## Hybrid generation and direct controls

The successor snapshot is `explorer-hybrid-2026-09-20`: seven saved runs and
1680 responses, including the paired control/hybrid generation. See its README
for quantitative findings and qualitative review. All selection and plot-setting
options are exposed as direct buttons; native dropdowns are hidden. The same
AND selection and pinned additive outline layers remain available. The header
scrolls independently when the options exceed the available height.

Use `--spanish-hybrid` with the benchmark runner for these frozen strategy
definitions, and explicit `--temperature` / `--top-p` to control sampling.
Create a fresh plan for changed settings. The live flag remains explicit;
exploration controls in the viewer do not send paid requests.

The right-hand inspector now defaults to matching content only. Selecting a prompt
immediately shows its response groups and exact prompts at the top; no traversal
of other prompts is required. With no current selection it shows pinned groups,
or the complete report when none are pinned. Show full report is an explicit
inspection-only toggle. Plots and comparison tables retain their full context
and additive highlights. Selecting a new criterion restores the focused inspector.
