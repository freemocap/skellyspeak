# Jev assessment design review — 2026-09-21

Status: implemented review dashboard; experiment design not agreed. Further paid
runs stopped at the user's request. No app assessment behavior or learner data
was changed. No commit was created by this task.

Open [the dashboard](index.html), or serve/rebuild it:

```sh
node tools/benchmarks/conversation-prompts/explorer/explore.ts --study docs/notes/conversation-prompts/jev-design-review-2026-09-21/study.json --port 8773
```

The dashboard reuses the exact prompt explorer and its cached source-space PCA,
t-SNE, UMAP, full-space clustering/similarity, layer highlighting, dividers,
source response and prompt inspection. It adds Design review and Skill decisions.
No new embeddings or projection fits were made. Design controls export proposals,
never execute requests. The preserved source study remains separate and unchanged.

## What happened / what needs review

The agent started an unreviewed 180-call pilot before presenting a concrete
experimental design. The user required design review first. The process was
interrupted after 25 complete receipts (1,125 decisions across only two source
texts). It did not reach Arabic or Mandarin. Known pilot cost is $0.032776;
the interrupted in-flight request may have incurred unreported usage. The exact
stop record is in `../jev-assessment-pilot-2026-09-21/stop.json`.

Earlier smoke directories preserve a preliminary offline-only plan, one Jev
success plus a Gemini HTTP 502, and a revised successful two-model smoke test.
The first Gemini schema repeated 45 object definitions; the revised request
used an answers array with per-ID validation. The retry was a new explicit smoke
run, not automatic retry. The initial error receipt lacks a useful provider
reason; the newer adapter retains redacted provider reasons where available.

The first two scratch files under `tools/benchmarks/skill-decisions/` were removed;
the implementation now extends `tools/benchmarks/conversation-prompts/`.

## Choices exposed in the dashboard

- Which evidence unit: current message versus bounded window; expression versus
  independent ability; actual learner data versus synthetic controls.
- Native sparse-four versus dense LLM versus Jev. Only the latter two currently
  have transports; do not conflate the dense control with the real native prompt.
- Criteria/batch size, criterion order, array position, context length, assistance,
  language, difficulty and instruction wording. Most are proposed, not implemented.
- Label review and held-out evaluation. All-absent role controls are the only
  current expected labels. Model agreement and stable outputs do not prove validity.
- Source maps versus proposed decision-space maps. Source geometry is not accuracy;
  the new probability matrix retains skill identity and shows missing trials.

No acceptance threshold or production adoption decision is implied. The next
step is to review the dashboard and agree a finite first experiment, then label
its controls and freeze its plan before new calls.

## Verification

The assessment test file and four existing runner/explorer test files pass.
Strict TypeScript checking passes for the assessment and explorer sources.
The rebuilt dashboard was inspected in the in-app browser: Design review opens
by default; a heatmap cell opens source-bound evidence and all paired probability
bars; the existing UMAP 3D map renders its points and legend without console
errors. Existing PCA/t-SNE/UMAP settings and cached coordinates are retained.
This verifies the review apparatus, not assessment validity.

## Sources reviewed

Jev question independence, Choice shape and probability/confidence distinction:
[@typesafeChoice2026]. OpenRouter model and pricing: [@openrouterJev2026]. These
are provider documentation claims, not validation of language assessment quality.
Existing map methods and citations remain in the original explorer and study.
