# Groq follow-up screen

The user requested Groq while the OpenRouter screen was in progress. Direct Groq
access with the existing local key worked through Node fetch. Python urllib was
rejected with HTTP 403; this was not treated as evidence that the key was invalid.
The authenticated model list is saved as `groq-models.json`. The familiar Llama
models were not in this account's returned list, so the run used available models.

36 original requests plus six explicitly separate schema-portability probes.
Same frozen fixtures, temperature 0.7, non-streaming, 2,048-token cap and two workers.
Qwen3.8 27B used reasoning `none`; GPT-OSS 20B and 120B used `low` because their
Groq interface does not offer off. This configuration difference is material.
[@groqModels20260913] [@groqReasoning20260913]

## Subsequent schema fix

The [native schema proof](SCHEMA-FIX.md) now resolves the HTTP schema blocker:
12/12 app-generated gloss requests completed, and 11/12 passed the unchanged Rust
decoder. The remaining rejection was a duplicate JSON field. This is a benchmark
adapter fix; production text routing is still unchanged. The original failures
and unsuccessful anyOf probe below remain part of the evidence.

## Comparable non-gloss results

These rows use the **same ten** conversation/reaction/coaching cases; gloss requests
are excluded from every row because Groq rejected their schemas before inference.
All ten requests completed for each row. This is completion, not a quality score.

| Model / service | Median full response | Cost of ten cases |
| --- | ---: | ---: |
| Current Gemini 2.5 Flash / OpenRouter | 0.823 s | $0.002057 reported |
| Gemini 2.5 Flash-Lite / OpenRouter | 0.500 s | $0.000543 reported |
| GPT-OSS 20B / Groq | 0.175 s | $0.000617 estimated |
| GPT-OSS 120B / Groq | 0.283 s | $0.001440 estimated |
| Qwen3.8 27B / Groq | 0.221 s | $0.004327 estimated |

GPT-OSS 120B was 65.7% faster by median and approximately 30% cheaper than the
current baseline over these ten requests. It costs more than Flash-Lite. Groq Qwen
was fast but more expensive than either Gemini model; Groq is not synonymous with
cheaper. Groq Qwen3.8 **27B is a different model** from OpenRouter Qwen3.8 **Flash**.

Groq reports completion time and token counts. Median completion-token throughput
was approximately 961 tokens/s for OSS 20B, 470 for OSS 120B and 479 for Qwen.
Those counts include reasoning where present and are not visible-text-only speed.
Full-response latency above includes HTTP overhead and queueing; neither measure
is a phone or complete-app latency measurement. These sequentially conducted small
runs are not randomized independent trials or a robust tail-latency estimate.

## Output quality and compatibility

Agent review, not blinded expert review:

- OSS 120B kept the three reaction explanations in the right perspective and
  matched the expected categories. Its ordinary conversation outputs looked
  useful in this small set. It is the strongest new candidate for the next
  actual-app conversation/reaction comparison.
- OSS 20B was faster, but coaching addressed “the learner” and proposed cooking
  *with the cat* as the correction. It also chose understood rather than concerned
  for the Arabic reaction. That last category is debatable; the bad coaching and
  voice mismatch are concrete defects. Do not turn the small-model speed result
  into a general coaching recommendation.
- Groq Qwen labelled a clearly confused partner `understood` while its own prose
  said confused. It gave an empty observation for clear Spanish, and invented a
  claim that `gato` is commonly confused with stove/oven because they sound similar.
- OSS 120B coaching was better than those two but not clean: it inferred a slip and
  full recovered meaning, and used taxonomy-like phrasing. Preserve uncertainty
  and the user's intended meaning; it is not a certified assessment model.
- **All six original gloss calls returned HTTP 400**, with
  `discriminator_multiple_candidates` at the union of span shapes. The failure
  concerns the simultaneous `first`, `last`, and `kind` enums, not a bad generated
  gloss. It affects the app-shaped source-bound schema and blocks drop-in use.
- An explicitly separate six-call probe changed the disjoint `oneOf` to equivalent
  `anyOf`; all six still returned the same error. Both sets of failures are retained.
  The test proves the transformation preserves the alternatives; it does not prove
  Groq accepts them. Further adaptation needs a real contract review and native
  validation. No weakening or silent fallback was applied in the app.

Groq's documented strict-output support is a starting point, not evidence that
our particular schema is accepted. [@groqStructured20260913]

## Updated task split and next implementation

1. Compare **Groq OSS 120B** and **Flash-Lite** through actual app-generated synthetic
   conversation/reaction requests. OSS 120B leads this latency screen; Flash-Lite
   remains the cheapest of those two in this sample and already fits OpenRouter.
2. Keep glossing on the existing path until schema compatibility and useful gloss
   coverage pass. Retain the saved failure cases as adapter regressions.
3. Keep coaching separately routed and judged for uncertainty, exact evidence,
   useful second-person wording and non-invention. Neither cheap models nor Pro
   earned blanket promotion in this screen.
4. Direct Groq text generation requires an explicit provider binding and adapter:
   current Groq use is transcription, while text generation is OpenRouter/hosted.
   Wire native credentials, hosted allowlists, per-operation receipts, budgets,
   capabilities and error handling together. No endpoint or model switch has been
   made in the production app by this benchmark.

## Accounting and artifacts

Groq estimated successful-request cost: **$0.00638385**, calculated from token usage
and dated official rates. This is not a billing receipt. Twelve schema-error calls
omitted usage; do not represent them as confirmed zero-cost calls.
Reservations: $0.15580375 original plus $0.02627650 schema probe. Combined with the
OpenRouter runs, all **121 attempts** reserved at most **$1.23874765**, within the
announced $2 ceiling. OpenRouter reported $0.051018758; adding the Groq estimate
suggests about **$0.0574** for metered successes, excluding unmetered errors.

Raw data: `groq-results.jsonl`, `groq-compatible-gloss-results.jsonl`, corresponding
run manifests and `groq-comparison-summary.json`. No credential is saved in these
files. Full TypeScript checking and four offline harness tests passed.

Dry-run command: `node scripts/benchmarks/groq-routing.ts`.
Paid execution adds `--live`; the separate probe adds `--compatible-gloss`.
Existing result files block accidental paid reruns. Prices are a dated explicit
Groq table, not an automatic current-price lookup; recheck before another session.
