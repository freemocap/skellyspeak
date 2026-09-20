# Instruction language comparison — fresh study

Completed 2026-09-20. This directory contains only the new Relationship study.
No previous run is loaded. Application prompts and language configuration were not changed.

## Design

180 independent openings: 3 target languages/variants × 2 instruction languages ×
3 difficulties × 10 repetitions. Targets: Spanish–Spain, Arabic–Levantine,
Mandarin–Mainland China. Persona off, no topic, T=1.1, top-p/top-k omitted,
Gemini 2.5 Flash Lite on Google AI Studio through OpenRouter, reasoning disabled.
The fixed English output directive specifies language, variant and writing rules;
the behavior, difficulty, clarification and final task blocks vary between English
and target-language wording. English is the assumed explanation language; other
explanation languages are not tested. This is not a fully monolingual-wrapper test.

Translations are agent-authored adaptations of the selected Relationship prompt,
not independently reviewed native translations. Arabic instructions use colloquial
Levantine without full vowel marks, while both conditions request vocalized output;
that register/orthography priming is a potential confound. The frozen plan preserves
all exact text. This controlled synthetic study does not exercise every app layer.

## Findings and recommendation

Pilot conclusion: no universal winner. English is a reasonable default candidate, but this run does not establish equivalence or acceptable app quality. Spanish shows no clear target-language advantage. Mandarin target-language instructions improve the variety and usefulness of some situations, while increasing length. Arabic target-language instructions often produce more coherent colloquial replies but strongly repeat cat situations and usually omit the requested vowel marks. Both conditions frequently fail to invite a useful reply at Absolute Zero. Do not generate configuration translations for every language on this evidence; validate the promising language-specific effects with reviewed translations and matched app prompts first.

Spanish: mean within-level cosine is 0.382 with English instructions versus 0.407 with Spanish instructions (lower means more semantic spread). Average word counts by level are almost unchanged: 4.9/12.8/21.5 versus 4.7/13.2/21.8. The Spanish condition repeats “Hoy he visto un gato negro. ¿Te gustan los gatos?” three times at Beginner. “Hoy, el sol. ¿Sí?” fits the length target but provides no clear decision or meaningful reply. English is not reliable either: “Compro pan.” is a dead end.

Mandarin: mean cosine falls from 0.403 to 0.361 with target-language instructions; means rise from 5.6/9.7/15.3 to 5.9/13.1/20.7 segmented words. Target-language Intermediate has more concrete choices, such as whether to visit another shop because the peaches look stale, or whether to walk in light rain. English Intermediate often switches from an unrelated observation to asking about the weather. But target-language Absolute Zero includes “冰箱门没关好。” (“The fridge door was not closed properly”) with no invitation; a longer response is not automatically better.

Arabic: mean cosine rises from 0.417 to 0.444 with target-language instructions. Nine of ten target-language Beginner replies concern cats. Some target-language replies have a usable problem, such as coffee turning out too strong/plain and asking for advice, but others ask for guesses about unseen cats. English Intermediate contains visibly garbled wording and mixed registers; target-language wording is often more coherent, yet most replies omit the full vowel marking required by the shared directive. A native review should separate translation/register priming from an instruction-language effect.

Review method: the assistant read all 180 outputs and assessed concrete situation, meaningful invitation, coherence, unseen-scene assumptions, repetition and level burden. This is an unblinded qualitative review, not a validated per-response score. Ten repetitions per cell are too few to establish equivalence. Original response text, exact prompts, API receipts and numerical measures are retained for inspection.

## Measurements

See comparison.md for all cells, responses.md for the requested grouped lists,
and prompts.md for exact instructions. Compare conditions within each language.
Word counts use letter/number tokens for Spanish and Arabic (Arabic marks and
stretching removed only for measurement), and Intl.Segmenter for Mandarin.
Characters per word are script-dependent. Transferred 3–5/6–11/13–23 word bands
are screening targets, not calibrated cross-language proficiency scales.
Cosine is computed in the original embedding space within each condition/level;
2D/3D PCA, t-SNE and UMAP can also cluster by language. Do not read multilingual
islands as conversational quality. Raw text is preserved, including failures of
instruction-following, emojis, missing questions and awkward grammar.

## Resume

From the repository root, reopen just this study:

```sh
node tools/benchmarks/conversation-prompts/explorer/explore.ts --study docs/notes/conversation-prompts/explorer-instruction-language-2026-09-20/study.json --port 8771
```

If its server is already running, visit http://127.0.0.1:8771/ instead.

To repeat into a NEW directory, plan then run the identical command with `--live`:

```sh
node tools/benchmarks/conversation-prompts/run.ts --instruction-language --model google/gemini-2.5-flash-lite --temperature 1.1 --out docs/notes/conversation-prompts/NEW-RUN
```

See the tools explorer README for embedding and study rebuild commands. Preserve
this run and its translations before changing wording. A future third condition
could keep English behavior but translate only difficulty, or compare another
explanation language; agree on that next generation explicitly.

## Verification and cost

180/180 generation calls succeeded, no retries; reported generation cost $0.009687.
178 unique texts embedded. Price bounds were verified against provider catalogs.
Frozen source and payload hashes are in plan.json. TypeScript checks and the
experiment/explorer tests passed. Local UI shows 180 rows and 18 exact prompts.
