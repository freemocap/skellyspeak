# Reusable exploration — implemented 2026-09-20

[Local explorer](http://127.0.0.1:8769/) · [Study manifest](study.json) ·
[Comparison](comparison.md) · [Grouped responses](responses.md) · [Prompts](prompts.md)

## Agreed workflow

We choose new generations together after each exploration. There is no automated
genetic algorithm, prompt mutation, generation scheduling or production change.
Frozen plans and receipts remain in their original run directories. A cumulative
study manifest assigns runs to rounds, records dates and verifies plan hashes.
A new analysis snapshot names its corpus and reuses compatible cached embeddings.
The viewer keeps all points and texts visible, adding outlines to matches; selectors no
longer remove comparison context. Round highlighting exposes history.

## Reviewed reference and implementation

Read Skellybot Analysis's ai/calculate_embeddings_and_projections.py,
visualize_data/embedding_projections/embedding_projection_viz_main.py and
embedding_visualizer.html. Adopted its precomputed parameter sweep, selectable
coloring and 2 D/3 D inspection pattern. No source was copied wholesale or changed
in that repository. Unlike its 2 D views of 3 D coordinates, these fits explicitly
optimize two and three dimensions separately.

Implemented twelve saved maps: PCA, t-SNE perplexities 15/40, UMAP neighbors 15
with min_dist 0.1 at seeds 42/43, and neighbors 40 with min_dist 0.3 at seed 42,
each in 2 D/3 D. Settings, package versions, corpus signature and coordinates are
recorded in projections.json. Exact duplicate texts share coordinates and do not
multiply density in fitting; all 1440 generation observations remain inspectable.
This changes weighting compared with the old observation-weighted PCA; its
explained variance is labeled separately.

Original-space cosine HDBSCAN (min_cluster_size 10, min_samples 5) finds 17 clusters
and leaves 476/1013 unique texts unassigned. These are descriptive groups, not
validated semantic categories. Clustering is not performed on plot islands.
No causal or significance claim is made from cluster separation.

UMAP/t-SNE can create misleading gaps; parameter and seed changes are exposed
for inspection [@umapParameters] [@umapClustering]. Trustworthiness and ten-neighbor
recall quantify local preservation [@sklearnTrustworthiness]. For this corpus:

| Fit | Trustworthiness@10 | Neighbor recall@10 |
|---|---:|---:|
| PCA 2 D |0.822|14.3%|
| t-SNE 2 D, perplexity 15 |0.979|62.9%|
| UMAP 2 D, neighbors 15/min_dist 0.1/seed 42 |0.976|57.0%|
| t-SNE 3 D, perplexity 15 |0.985|66.7%|

Higher local preservation helps inspection; it is not an improvement in generated
responses. Joint layouts are snapshot-specific: adding a new round can move old
points. Compare outcomes across rounds with fixed numerical metrics, not movement
between separately refitted coordinates.

## Sampling and recommendation

The pinned Google AI Studio endpoint advertises temperature, top_p and seed;
it does not advertise top_k or multiple candidates through this OpenRouter route.
Verified against its endpoint catalog before testing. Temperature and top_p
control next-token sampling, not ranking of complete responses. Multiple complete
candidates would require separate calls here; randomly picking one adds no
benefit beyond sampling once unless candidates are evaluated or screened.

Two new 240-call runs hold temperature 1.1 and prompts fixed, varying top_p 0.8/1.0.
Both completed successfully. Reported generation costs: $0.0094096 and $0.009382.
The study totals 1440 responses across six batches. top_p defaults in the earlier
four batches remain unknown. Batches are sequential and estimates use only ten
samples per cell.

**Recommendation:** choose Prompt 4 (Examples) at temperature 1.1 as the parent
for the next human-designed generation, retaining its prior default-top_p run as
the control. Use explicit top_p 0.8 as a reproducible comparator, not an established
improvement. Do not adopt top_p 1 simply because it reduces cosine.

| No-persona examples condition | Mean within-level cosine | Worst-level length fit |
|---|---:|---:|
| T 1.1, provider-default top_p |0.512|80%|
| T 1.1, top_p 0.8 |0.545|80%|
| T 1.1, top_p 1 |0.442|60%|

Reading all thirty example/no-persona responses in each new run reveals:
- top_p 0.8 still repeats sunny-day walks; “Luz encendida. ¿Cierro?” and
  “Luz apagada. ¿Sueño?” are not coherent conversational openings.
- top_p 1 produces “El correo. ¿Llego ya?”, “Gafas rotas, ¿sí?” and ungrounded
  “Estás en casa. ¿Café o té?”. Lower similarity partly reflects deterioration.
- Intermediate outputs contain more usable decisions, but some ask learners to
  guess unseen colors or assume they heard the same sound.

Neither new setting is a production recommendation. Preserve explicit length
targets as a constraint, inspect within-level diversity, and require natural,
answerable openings. Mean words/sentence and letters/word should not be maximized:
longer words do not establish the selected proficiency level.

Proposed next discussion: keep the four approaches as controls; revise example
selection and grounded invitations in the next generation. The 3–5-word
Absolute Zero budget leaves very little room for both a situation and a question.
We should explicitly decide whether to relax that budget or permit a natural
standalone invitation, then test that change separately. No new prompt wording
has been applied.

## Rebuild and verification

See the maintained explorer README for commands. study.ts performs no paid calls;
embedding new text is an explicit embed.ts operation. requirements.txt pins the
scientific environment. Projection computation and interactive rendering are
separate owners; frontend remains TypeScript.

Strict TypeScript and benchmark/comparison suites pass. Browser checks verify all
1440 responses remain present while 360 match a prompt highlight, and UMAP renders
in 2D and 3D with unchanged surrounding points and no browser console errors. Older analysis artifacts remain available.

Highlight interaction correction: selection is purely additive. Base point positions, colors, sizes and opacity stay fixed; a separate hollow-outline layer marks selected points in 2D/3D and distribution plots. Text and tables retain full opacity and gain outlines only. Prompt blocks retain their original order.
