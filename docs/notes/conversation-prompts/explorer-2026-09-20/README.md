# Spanish variety comparison and explorer — 2026-09-20

Status: implemented research explorer and completed experiments; no app prompt changes. This report is an unblinded qualitative assessment, not a validated grading model.

The main comparison contains the existing 240 minimal-identity/no-identity responses and 240 new responses with this sole appended instruction:

> Use varied grammatical structures and ways of opening a conversation. Draw on a broad range of everyday situations. Keep the language natural and appropriate to the selected difficulty; variety should not require longer or harder language.

No word, topic, or grammatical structure is banned. An earlier blacklist batch finished before the correction was processed; it is retained under `spanish-variation-2026-09-20`, marked rejected and excluded from this explorer. The corrected run is `spanish-variety-2026-09-20`.

## Observations

| Measure | Baseline (240) | Positive variety instruction (240) |
|---|---:|---:|
| Distinct normalized responses | 189 | 189 |
| Mean words | 11.96 | 12.50 |
| Responses within requested word range | 162 | 150 |
| Absolute Zero within 3–5 words | 47/80 | 39/80 |
| Beginner within 6–11 words | 62/80 | 62/80 |
| Intermediate within 13–23 words | 53/80 | 49/80 |

These descriptive results do not support adopting the additional instruction yet. Different texts and first words alone would not demonstrate meaningful grammatical variety. The instruction may change some choices, but repeated conversational templates and level failures persist. Ten draws per cell, sampled in sequential batches, cannot establish a stable effect or statistical significance.

## Reading the actual responses

- The corrected examples prompt, Absolute Zero with persona, still produces “Hoy hace sol. ¿Vamos?” in eight of ten responses. The failure is the repeated same situation and invitation, not the validity of “Hoy.”
- “Hoy he visto un gato. ¿Era negro?” asks the learner about an animal only the partner saw. It creates a question syntactically but no answerable invitation.
- “Qué lío. El gato se ha metido en el tendedero.” has a concrete situation, but at Absolute Zero it is too demanding and offers no question. A different opening does not rescue the level or turn-taking failure.
- “Lucía está en el mercado. ¿Quiere manzanas o peras?” shifts into third-person narration and a question about Lucía's unknown preference. This is a role/grounding problem, not a length problem.
- At Intermediate, “Hoy he comprado unas naranjas estupendas, pero ya no me caben en el frutero. ¿Las dejo en la encimera o las guardo en la nevera?” offers a real choice with context. The sentence is longer than the requested range, but the conversational mechanism is substantially better than a generic preference survey.
- “Acabo de ver una gaviota intentando robarle un bocadillo a un turista en la playa, ¡qué espectáculo! ¿Sueles ir a la playa cuando hace bueno?” has a lively detail, then drops it for a generic beach question. Interesting setup and conversational follow-through need separate judgment.

No candidate is designated a production winner. The next proposed experiment is to vary an explicit, simple conversational situation or speech act across independent openings while holding the linguistic level fixed. That would test controllable diversity rather than assuming repeated identical requests can coordinate with one another. This is a proposal, not implemented app behavior.

## Explorer and provenance

Source and rerun instructions: [explorer guide](../../../../tools/benchmarks/conversation-prompts/explorer/README.md).
The linked map uses 512-dimensional OpenRouter `openai/text-embedding-3-small`
vectors for 362 unique exact texts, reused for 480 response observations. PCA's
first two components retain 26.47% of centered variance. Similarity search uses
full-space cosine, not visual distance. Responses and exact prompt texts remain
inspectable; filters never recompute or rotate the projection.

`analysis.json` preserves each row's run, trial, model, temperature, source plan
hash, response, measures, coordinates and cost. Raw vectors are in
`embeddings.jsonl`; batch metadata and failures in `embedding-receipts.jsonl`;
corpus/model/dimension lock and reserved budget in `embedding-plan.json`.

The first embedding request succeeded at the provider but was rejected locally
because the service returned `text-embedding-3-small` rather than its prefixed
route ID. The validation was corrected to allow that exact alias and the command
was explicitly resumed. Both receipts and their costs are retained. No automatic
retry or silent substitute embedding model was used.

## Cost

- spanish-persona-2026-09-20: $0.009362.
- spanish-variety-2026-09-20: $0.010394.
- spanish-variation-2026-09-20: $0.010867.
- Embeddings including the locally rejected first response: $0.000184.

Costs are provider-reported, not the conservative reservation. The rejected generation batch is accounted for separately from the primary comparison.

## Verification

TypeScript checking and the runner/matrix/analysis tests passed. Browser checks verified filtering, response inspection, full-space nearest-neighbor ranking, empty text-search results and drag selection of a 55-response cat cluster. Desktop and 360px layouts rendered; no browser console errors were observed. The UI does not claim CEFR scores, grammatical parses, or automatic semantic quality grades.
