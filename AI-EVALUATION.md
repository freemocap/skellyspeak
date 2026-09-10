# Provider selection and evaluation plan

Status: proposed implementation targets and evaluation protocol. Source review:
2026-09-09. No model benchmark, paid inference, dependency installation or application
implementation has been performed. [AI-STRATEGY.md](./AI-STRATEGY.md) owns routing
principles; this document makes the initial candidates and selection gates concrete.

## Initial generation targets

Recommend starting with this bounded pair, preserving the requested Gemini baseline:

| Role | OpenRouter model ID | Initial evaluation responsibility |
| --- | --- | --- |
| Standard | `google/gemini-2.5-flash` | Conversation, coaching, linguistic explanations and assessment; comparison baseline for bounded tasks |
| Fast candidate | `google/gemini-2.5-flash-lite` | Titles, reaction labels, literal memory extraction and bounded span/lexical tasks |

Both have published OpenRouter catalog pages:
[Flash](https://openrouter.ai/google/gemini-2.5-flash) and
[Flash-Lite](https://openrouter.ai/google/gemini-2.5-flash-lite). Catalog presence
does not prove availability for a specific account, provider or required schema.
Validate those bindings before a benchmark and again before release. Google's
[lifecycle table](https://ai.google.dev/gemini-api/docs/deprecations) currently lists
both stable Gemini 2.5 text models without an announced shutdown date; this is a
dated observation, not a lifetime guarantee. Use explicit IDs, not floating aliases.

For an initial economic comparison, Google's direct Developer API publishes these
paid, standard-service text rates in USD per million tokens:

| Model | Input | Output, including thinking |
| --- | ---: | ---: |
| Gemini 2.5 Flash | 0.30 | 2.50 |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 |

Source: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing).
These are not an OpenRouter or hosted-app price quote. With equal token counts,
the listed input rate is one-third and output rate is 16% of Flash's. Actual savings
depend on prompt size, reasoning/output usage, retries and route charges. Use live
route prices for benchmark accounting; do not hard-code this comparison in the app.
Lower latency remains a measurement question, not a result inferred from price.

Keep the shortlist at two generation models initially. Add a challenger only if
Fast fails a material task, lacks availability or delivers insufficient savings.
Do not turn model selection into an unbounded vendor tournament.

## Initial adapter scope

Use OpenRouter for server generation and direct own-key generation, and Groq for
transcription. Custom URL locates a self-hosted instance of our server code, using
the same versioned SkellySpeak protocol as hosted access. Arbitrary OpenAI-compatible
endpoint adapters are outside scope.

| User route | Concrete proposed target |
| --- | --- |
| Sign-in | Rust → versioned SkellySpeak hosted generation endpoint → OpenRouter |
| API key | Rust → `https://openrouter.ai/api/v1/chat/completions` using the user's OpenRouter key |
| Custom URL | Rust → self-hosted SkellySpeak server → server-configured providers |

The [OpenRouter API reference](https://openrouter.ai/docs/api_reference/overview)
defines its request/response interface. Reuse domain request concepts across adapters,
but keep provider-specific routing inside the responsible provider adapter.
Native Google-key generation is not included in this initial adapter proposal;
it can be added as a deliberate provider implementation if desired.

A self-hosted server must pass the same SkellySpeak protocol and output-contract
tests as the hosted server. Check protocol version and authentication explicitly;
a provider model-list response does not establish server compatibility.

OpenRouter normally load-balances providers and permits provider fallbacks.
Proposed strict binding: select an explicit provider endpoint for each model,
disable fallbacks and require support for requested parameters. Provider endpoint
selection is part of the release configuration and benchmark identity. See
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
This makes route failures visible instead of allowing an implicit provider change.

For structured tasks, request the documented JSON-schema mode with strict schemas
and parameter support required, then independently validate outputs in Rust.
[OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
documents model-dependent support. Schema support never substitutes for linguistic
accuracy, valid source references or memory permissions.

## Hosted request and accounting boundary

Proposed request fields: request-contract version, logical operation ID, attempt ID,
task contract ID, requested model binding, authorized context payload, output schema
identity and generation limits. Authentication is a separate credential header.
Never put provider secrets in the request body or return them to the device.

The host verifies identity, task/model allowlists, permitted parameters, payload
limits and quota before dispatch. Bind a request receipt to account + attempt ID
and a digest of the request; reject a different body under the same identity.
An unresolved receipt prevents duplicate upstream dispatch. A status query returns
attempt state and available metering without storing learner history as account data.

Record dispatch intent before the upstream request. If the host stops between
dispatch and recording completion, classify the outcome as unknown and reconcile
where the provider permits; never claim exactly-once remote inference. Reconcile
reported usage once per actual attempt, including rejected generated outputs.
This requires a dedicated hosted metering contract and fault tests before release.

Do not durably retain raw prompts/responses in hosted diagnostic or receipt storage.
If a disconnected client cannot recover response content, expose that outcome;
a new paid attempt is explicit. Client and host may each validate output contracts,
but only the device accepts results into its domain records.

## Bounded generation evaluation

Build synthetic, reviewed cases; do not send real learner conversations as test
fixtures. Proposed coverage starts with Spanish, French, English, Arabic and Mandarin,
including native-language assistance fragments and relevant script/variety cases.
These are evaluation coverage choices; passing them does not certify every variety.

1. **Conformance screen:** test both models through the actual adapter for valid
   schemas, Unicode spans, emoji-free accepted prose, length limits, malformed
   output, refusal, authentication/quota failures, cancellation and unknown usage.
   Use deterministic failure injection for transport/storage cases; no need to buy
   provider errors repeatedly. Stop a failing configuration before quality runs.
2. **Fast-task pilot:** 20 cases per language for each of four families: title,
   reaction, explicit memory extraction and bounded span/lexical work. Split each
   family into ordinary, ambiguous, negative and adversarial cases. Run both models
   on the same frozen cases; repeat five designated difficult cases per cell twice
   more to expose variability. That is a planned cap of 1,200 initial generations,
   not a completed benchmark or a statistically definitive sample.
3. **Standard-task pilot:** 20 reviewed cases per language for each of conversation,
   coaching, expression help and skill judgment. Check quality in its own right;
   Standard is never the ground-truth answer for Fast. This adds at most 400 initial
   generations. CEFR calibration needs a separate reviewed rubric/evidence set.
4. **Held-out confirmation:** only candidates that pass the pilot proceed to a
   separately frozen set large enough to support the intended task/language claim.
   Review uncertainty and failure clusters before expanding scope. Do not tune
   prompts on the held-out set and then report it as independent validation.

Before any paid run, calculate its maximum cost from enforced input/output/reasoning
caps and current route prices, set a spend ceiling, and report the selected run.
The 1,600 initial-call cap excludes any separately approved repair or confirmation
run; disabling automatic repair makes first-pass comparison interpretable.
Design authorization does not start these calls or authorize implementation of a
benchmark harness.

### Proposed acceptance gates

| Dimension | Pilot gate and reporting |
| --- | --- |
| Application invariants | Zero accepted invalid schemas, out-of-scope references, forbidden memory writes or emoji-policy violations in the fixture suite; failures block the configuration |
| First-pass valid outputs | At least 95% per task/language pilot cell; report numerator, denominator and confidence interval |
| Semantic acceptability | At least 95% reviewed acceptable results per cell; no severe contradiction, fabricated memory or attribution error accepted |
| Human review | Blind model identity; adjudicate disputed labels; require competent language review, especially for Arabic/Mandarin and assessment |
| Cost | Fast must reduce measured cost per acceptable result by at least 40% on the assigned workload |
| Speed | Fast must reduce median accepted-result latency by at least 20%, without a material p95 regression; measure on the same route/concurrency conditions |

These are proposed engineering pilot gates, not scientific proof or reported
performance. Small pilot cells only screen candidates. Report first-pass failures
separately from application rejection; a validator catching every bad output does
not make a model useful. For vague Vibe/reaction judgments permit sets of acceptable
interpretations and abstention; do not force false single-label certainty.

The decision table emitted by evaluation is `(task, language/scope, contract,
model binding, parameters, accepted/rejected, quality, cost, latency, coverage)`.
Only passing scopes acquire Fast assignments. A failing scope remains explicitly
assigned to Standard before dispatch; there is no hidden failure-driven escalation.

## Embedding evaluation track

Prefer evaluating a local encoder first to avoid a network request per Vibe
observation. Initial candidate: `intfloat/multilingual-e5-small`. Its author model
card specifies 384-dimensional embeddings, input-prefix conventions and a 512-token
input limit. These need explicit preprocessing and chunking rather than silent
truncation. See the [author model card](https://huggingface.co/intfloat/multilingual-e5-small/raw/main/README.md).
Model size in runtime memory, quantization, packaging and mobile latency remain
unmeasured; no local runtime library is selected by this candidate name.

Use `gemini-embedding-2` as a bounded endpoint comparison candidate, with its own
reference table and documented task preparation. Google's
[embedding API](https://ai.google.dev/gemini-api/docs/embeddings) documents this
model's request and vector behavior. It is a separate evaluation route, not an
automatic extra Google connection for users selecting OpenRouter or custom chat.
Shipping endpoint embeddings would require an explicit supported route binding.

Freeze a reviewed emoji vocabulary and compare both encoders on the same literal,
abstract, negated, short, multilingual and long-text cases. Rank acceptable top-three
sets, diversity, abstention and sensitivity to paraphrase; similarity is not proof
that an object or emotion occurred. Measure local cold/warm time, peak memory,
artifact size and quantization quality on desktop and at least one target phone.
Version encoder, tokenizer, preprocessing, pooling, normalization and table together.

A local quality/resource pass makes it the proposed default. Failure leaves an
explicit design decision between another local candidate and a configured endpoint;
do not silently add network inference or replace geometry with generative Vibe.

## Checkpoints toward implementation

- [x] Name initial generation and embedding candidates with primary-source evidence.
- [x] Propose adapter scope for all three connection routes and strict routing rules.
- [x] Define bounded pilot coverage, acceptance gates and accounting requirements.
- [ ] Review adapter scope and proposed evaluation gates.
- [x] Consolidate proposed choices, phases and user checks in [BUILD-PLAN.md](./BUILD-PLAN.md).
- [x] Obtain explicit implementation authorization before scaffolding or harness work.
- [ ] Build conformance checks and reviewed fixtures, then price the bounded model run.
- [ ] Run evaluations and record actual task assignments; choose the embedding deployment.
- [ ] Complete hosted authentication/metering, native lifecycle and device verification.

Research has narrowed the targets; it has not established a winning Fast model or
completed any application/provider test. [The build plan](./BUILD-PLAN.md) ties
these acceptance checks to complete vertical slices of the product.
