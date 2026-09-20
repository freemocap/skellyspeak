> **Decision update:** User selected Prompt 2 (Relationship), temperature 1.1, on 2026-09-20. This supersedes the Prompt 6 recommendation below; the earlier analysis is retained as history. See [resume guide](../../../../tools/benchmarks/conversation-prompts/README.md).

# Round 5: calibrated hybrid exploration

Implemented experiment and human review, 2026-09-20. [Viewer](http://127.0.0.1:8770/).
[Exact prompts](../spanish-hybrid-2026-09-20/prompts-preview.md) ·
[Grouped responses](responses.md) · [Comparison](comparison.md) ·
[Round metrics](round-05-metrics.json) · [Cumulative study](study.json).

## Design

240 successful calls: four strategies × three difficulties × two persona
conditions × ten repetitions. No topic, Spanish, Gemini 2.5 Flash Lite on Google
AI Studio, temperature 1.1, explicit top_p 0.8, reasoning disabled, max output 512.
No automatic retries; all calls succeeded. Reported generation cost $0.0127292.

Strategies:
- Prompt 2 Relationship: unchanged control.
- Prompt 4 Examples: unchanged control.
- Prompt 5 Relationship + examples: complete Relationship prompt plus three
  calibrated examples and grounding/variation guidance for the selected level.
- Prompt 6 Examples + capability: a shorter relationship frame, explicit learner
  capability descriptions, the same calibrated examples, and continuation rules.

Controls are byte-identical to the prior prompts; persona ablation changes only
the identity prefix. Hybrid demonstrations satisfy the existing 3–5 / 6–11 / 13–23
word targets. New cases are interleaved through the existing balanced runner.
This is a small stochastic sample, not a significance claim.

The cumulative viewer has 1680 observations from seven runs. It reuses prior
embeddings and adds 178 unique texts. Old snapshots remain intact. Projections
are refitted jointly for this corpus; movements across snapshots are not outcomes.

## Findings

No-persona results, ten samples per cell:

| Strategy | Mean words AZ / B / I | Length fit AZ / B / I | Beginner cosine |
|---|---|---|---:|
| Relationship |5.1 /12.8 /21.8|70% /10% /70%|0.532|
| Examples |4.1 /5.9 /19.8|90% /90% /90%|0.824|
| Relationship + examples |4.6 /9.9 /24.9|80% /70% /40%|0.580|
| Examples + capability |3.8 /7.1 /25.1|100% /100% /20%|0.421|

Persona results:

| Strategy | Mean words AZ / B / I | Length fit AZ / B / I | Beginner cosine |
|---|---|---|---:|
| Relationship |5.8 /12.9 /24.4|40% /20% /30%|0.455|
| Examples |4.3 /6.6 /23.3|90% /100% /60%|0.698|
| Relationship + examples |5.1 /9.8 /25.8|70% /90% /60%|0.405|
| Examples + capability |3.4 /7.8 /23.6|100% /100% /50%|0.455|

Prompt 6 resolves the lower-level length overlap in this sample: every Beginner
response is longer than every Absolute Zero response, with all 40 lower-level
outputs within their targets. Its Beginner content is also less semantically
repetitive than the Examples control in both persona conditions. However,
Intermediate fits only 7/20 times, versus 15/20 for Examples.

Prompt 5 substantially improves Relationship's Beginner length fit, but
no-persona Beginner responses still fixate on cats, and Intermediate runs long.
It does not offer a clear overall advantage over Prompt 6.

## Human reading

Read all 120 hybrid responses, not just structural flags. Selected observations:

- Prompt 6 Beginner: “Me apetece pasta. ¿Qué salsa pongo?” offers a concrete,
  answerable decision. “Hoy hace mucho calor. ¿Abro la ventana?” similarly gives
  context and a relevant choice.
- Prompt 6 Absolute Zero still includes “Veo un gato. ¿Es negro?”: the learner
  cannot know. “Sol. ¿Vamos playa?” drops needed grammar. “Hola. Compro pan.
  ¿Quieres?” adds a greeting despite the intended opening behavior.
- Prompt 5 asks “Acabo de ver un gato en el tejado. ¿Será suyo?” without a referent
  for “suyo”, and asks the learner to identify an unseen bird's species.
- Prompt 5 Intermediate invents prior history (“el libro que me recomendaste”)
  in an opening. Prompt 6 also produces “Pues vaya, qué lío lo del tiempo…” as
  though replying to an existing discussion.
- Prompt 6 Intermediate has richer material, but repeated shoe/weather topics
  and long replies show that it has not solved diversity or level calibration.

Thus 100% length fit at the low levels is not 100% conversational quality. This
review is qualitative and documented through specific evidence; no unvalidated
automatic “interestingness score” is substituted for it.

## Recommendation and next discussion

Choose Prompt 6 as the strongest new parent for Absolute Zero and Beginner.
Keep Prompt 4 as the Intermediate control. Hold temperature 1.1/top_p 0.8 for
comparisons rather than changing sampling again. This nominates a level-specific
candidate, not a deployed configuration.

The next proposed generation should preserve Prompt 6's lower-level shape and
focus on two defects: natural, grounded invitations at Absolute Zero, and
Intermediate length/false-history behavior. Keep the current candidates unchanged
as controls. A short continuation test is required before adopting a prompt:
can it actually use the learner's answer rather than starting another vignette?
No further generation or production prompt change has been performed.

## Tooling

All selectors now expose direct option buttons: prompt, difficulty, identity,
wording, temperature, top_p, round, cluster, plot measures, projection and coloring.
They retain the same AND combinations, pinned highlight layers, additive outlines
and resizable panels. API calls remain in the explicitly invoked benchmark runner;
viewer controls explore existing results and do not incur costs.

Reusable generation command (use a fresh output directory; plan before live):

```sh
node tools/benchmarks/conversation-prompts/run.ts --spanish-hybrid --temperature 1.1 --top-p 0.8 --out YOUR_RUN_DIRECTORY
node tools/benchmarks/conversation-prompts/run.ts --spanish-hybrid --temperature 1.1 --top-p 0.8 --out YOUR_RUN_DIRECTORY --live
```

The study manifest, frozen prompts/results, vector cache, projection parameters,
package versions, grouped reports and recommendation remain inspectable. Frontend
button state reuses the existing selection handlers. Tests verify balanced trials,
unchanged controls, sole identity ablation, and length-valid demonstrations.
