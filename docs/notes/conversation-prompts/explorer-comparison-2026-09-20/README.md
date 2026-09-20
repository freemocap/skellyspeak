# Spanish prompt comparison explorer — 2026-09-20

Implemented research viewer; no application prompt deployment.

## Artifacts

- [Interactive explorer](http://127.0.0.1:8768/) (local server).
- [Comparison tables](comparison.md).
- [Responses grouped by prompt and difficulty](responses.md).
- [Exact prompts](prompts.md).
- [Analysis data](analysis.json).

Left and right panels scroll independently. Compare conditions contains visible
tables and selectable blue–white–red heatmaps. Distributions contains length,
surface complexity and semantic plots. The right panel exposes grouped responses,
exact prompts, inspection and full-dimensional nearest neighbors. Filters and
tags select prompt, difficulty, identity, wording and temperature. JSON is collapsed.

## Design and provenance

960 successful independent Spanish openings: four prompts × three levels × two
identity conditions × ten repetitions in each of four batches:

- Original prompts at temperature 0.7: ../spanish-persona-2026-09-20
- Positive grammatical-variety instruction at 0.7: ../spanish-variety-2026-09-20
- Original prompts at 0.3: ../spanish-temp03-2026-09-20
- Original prompts at 1.1: ../spanish-temp11-2026-09-20

Gemini 2.5 Flash Lite, pinned Google AI Studio, reasoning disabled, output cap 512.
top_p was omitted and its upstream value is unknown. No topic, history or
repetition index was supplied. Persona is a minimal Lucía identity, not full app
persona. Exact frozen requests are in each source plan.json. The rejected
word-blacklisting experiment is excluded. These sequential batches are not a
randomized trial and do not establish transfer to a larger model.

The 1.1 run stopped at one HTTP 503. An explicit resume completed the remaining
calls and retained the failed receipt. Reported generation costs for the two new
successful batches: $0.0093728 and $0.0093704. The 503 receipt has no cost; it is
unknown rather than assumed free.

651 exact unique texts use cached 512-dimensional text-embedding-3-small vectors.
362 cached texts were reused and 289 new texts embedded. Embedding receipts retain
earlier paid calls, including an earlier locally rejected response, so their total
is not solely this turn's incremental cost.

## Interpretation and findings

PCA retains 27.2% of embedding variance. Its axes have no intrinsic linguistic
meaning: they are neither difficulty nor quality. Similar points are a reason
to inspect text, not evidence of good or bad conversation. Tables and nearest
neighbors use the full 512 dimensions.

Within-level cosine and text/opening collisions measure repetition. Length
adherence uses 3–5 / 6–11 / 13–23 words. Ordering measures how often a higher-level
sample is longer, with ties worth half. Words per sentence and letters per word
are transparent surface proxies, not calibrated proficiency scores.

The example-based prompt at 0.3 repeats “Hoy hace sol. ¿Salimos?” in all ten
Absolute Zero no-persona trials. At 1.1, that cell includes different situations
and questions. Across its three levels, mean cosine falls from 0.794 to 0.512;
worst-level length adherence falls from 90% to 80%. This is a useful diversity
improvement, with a constraint tradeoff.

Human reading still identifies problems: “La puerta abierta. ¿Entro?” is
fragmentary, and “Hay un pájaro. ¿Lo ves?” assumes the learner can see the bird.
More semantic spread does not solve grounding, naturalness or conversational
usefulness. Some intermediate examples also retain a narrow food-choice pattern.
No configuration is recommended for production solely from numerical scores.

At the viewer's editable 80% fit / 0.65 cosine thresholds, three conditions meet
both targets at every level: examples at 1.1 with/without persona, and contract
with variety wording at 0.7 without persona. These are candidates for qualitative
review, not winners. Ten samples per cell give weak estimates; 45 pairs are not 45
independent observations.

Next useful work: judge promising cells for naturalness, answerability and
concrete conversational invitation; then test multi-turn continuation and repeat
the selected temperature conditions. Isolate top_p in a subsequent experiment
rather than changing it together with temperature.

## Verification

Strict TypeScript checks and benchmark/data/comparison tests passed. Browser
checks verified temperature filtering, heatmap selection, exact prompt inspection
independent panel scrolling, chart rendering and rectangle selection. No browser console errors were observed. Generated reports preserve all 960 observations.
