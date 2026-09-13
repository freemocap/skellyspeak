# Model routing screen — 2026-09-13

Status: paid synthetic screening completed; production routing unchanged. This is
not a full app benchmark, native-validator certification or language-quality audit.
The user authorized paid experiments using `server/local.env`. No saved learner
conversations were sent. Credentials are read in memory and excluded from artifacts.

## Split-call follow-up

The [smaller-call experiment](SPLIT-CALLS.md) compares whole paragraphs with
parallel sentence chunks using native validation. It measures earlier partial
results and the additional token cost; production concurrency remains unchanged.

## Groq follow-up

The user added Groq during this evaluation. [The Groq follow-up](GROQ.md) records
42 additional attempts, a faster OSS 120B candidate, quality defects and a gloss
schema compatibility blocker. The tables below describe the initial OpenRouter
runs only; see the follow-up for the updated shortlist and combined accounting.

## Measured results

79 HTTP attempts across six models and seven model/provider bindings. 63 completed;
16 returned HTTP 429. All completed generations ended with `stop`. No timeout or
output truncation occurred in this short fixture set. Reported usage totals
**$0.051019**; the 16 errors omitted cost, so they are unmetered, not asserted free.
Conservative reservations for all three runs total **$1.056668**, below the announced
$2 ceiling. Prices were rechecked before each run. No automatic retries were made.

Times below are full non-streaming request-to-response times from this machine,
not time to first token, phone latency or whole-turn completion. Medians exclude
HTTP failures; always read them alongside completion counts. Samples are too small
for useful tail-latency or reliability claims.

| Model / requested provider | Completed | Median completed response | Reported cost for run |
| --- | ---: | ---: | ---: |
| Gemini 2.5 Flash / Google AI Studio | 12/12 | 0.841 s | $0.002917 |
| Gemini 2.5 Flash-Lite / Google AI Studio | 12/12 | 0.534 s | $0.000771 |
| DeepSeek V4 Flash / DeepInfra FP8 | 12/12 | 2.588 s | $0.000427 |
| DeepSeek V4.1 Flash / Fireworks | 11/12 | 2.110 s | $0.001459 |
| Qwen3.8 Flash / Alibaba | 1/12 | 1.798 s | $0.000052 |
| Qwen3.8 Flash / Makora FP4 | 8/12 | 3.587 s | $0.000458 |
| Gemini 3.1 Pro Preview / Google AI Studio | 7/7 | 5.530 s | $0.044934 |

Flash-Lite was 36.5% faster by median and 73.5% cheaper over the same 12 cases than
Flash. These are raw-completion metrics, **not cost per acceptable coaching result**.
The Pro run contains only the seven structured tasks, uses low reasoning and a
4,096-token cap; the other runs use disabled reasoning and a 2,048-token cap.
It is a different configuration, not a controlled model-only comparison. Pro used
2,721 reported reasoning tokens; all completed non-reasoning runs reported zero.

Qwen's first route returned 11 upstream shared-pool rate-limit errors. Its alternate
route completed eight cases, but four still failed. Fireworks returned one rate-limit
error for V4.1. This does not establish that the models themselves are unreliable;
it establishes that these tested routes cannot yet support a reliable app default.
Provider selection matters independently of model branding. [@openrouterRoutingScreen20260913]

## What the outputs actually did

Agent review was not blinded and is not independent expert review. The mechanical
checks validate a supported schema subset, selected source constraints and expected
reaction labels. They deliberately do not claim all parseable output is useful.
The following defects were found by reading the saved outputs:

- Flash-Lite's ambiguous Spanish coaching claimed the Spanish word for home sounds
  like English “home.” That is false. Do not promote it to general coaching based
  on its speed or schema-pass rate.
- Flash's three reaction explanations reversed the interlocutors: “you” referred
  to the partner instead of the person using the app. V4.1 did this in two cases.
  Flash-Lite kept those three roles straight. The app's actual reaction system
  prompt was used; its wording needs an explicit referent definition.
- Flash's Arabic conversation inserted a greeting and said it also likes reading,
  despite the user having just answered the partner's question. That resembles the
  reported self-answering behavior even with correctly ordered role messages.
  This is evidence of a prompt/model issue in this fixture, not proof that the app's
  history wiring is correct in every path.
- DeepSeek V4 and Qwen/Makora tagged every Arabic word as `literal`: valid structural
  coverage, but no word meanings at all. Passing a span/schema check is insufficient.
- Flash-Lite preserved Arabic word boundaries but omitted “I” and “the” in its glosses
  and produced questionable romanization. Flash, V4.1 and Pro were more useful on
  this one Arabic example; none is certified across Arabic varieties.
- DeepSeek V4 leaked the hidden correction in a hint field, called `gato` a false
  friend without support, and marked the whole meaning recovered despite ambiguity.
- Pro gave a more useful correction cue without Flash-Lite's false phonetic claim,
  but still asserted a slip and full recovered meaning without enough evidence.
  Its reaction explanation also said “misheard” for a text fixture. Larger models
  remain fallible; model size is not the validation layer.
- The Mandarin task had several plausible outputs, but Flash merged “read books”
  despite the request for word spans. The simplified gloss prompt did not include
  the app's pronunciation policy, so IPA-like output here is not a production-policy
  regression measurement.

## Proposed division of work

| Work | Candidate tier | Why / promotion gate |
| --- | --- | --- |
| Reaction label and short explanation | Fast: Flash-Lite | Best initial mix of latency and role fidelity; confirm on adversarial, ambiguous and multilingual cases using native validation. |
| Titles, short formatting, explicit fact extraction | Fast candidate | Not tested here. Preserve evidence binding and user control; no inferred memories. |
| Everyday partner reply | Fast candidate with Standard comparison | Five short examples looked promising. Need longer histories, negation, persona consistency and actual app replay first. |
| Literal sentence translation | Fast candidate | Not tested here; measure preservation of negation, politeness and ambiguity before promotion. |
| Word glosses / segmentation | Standard initially | Script coverage and useful gloss coverage need separate gates; do not use “small task” as a synonym for easy linguistic judgment. |
| Coaching, error interpretation, language assessment | Standard; optional stronger model for hard cases | Cheap candidates made misleading guidance. Pro merits a bounded harder evaluation, not automatic deployment or silent paid escalation. |
| Long-context coaching and learning-plan synthesis | Strong candidate, explicit operation | Not tested here. Run outside the immediate conversation-response path. |
| Grapheme boundaries, source spans, XP, statistics, audio FFT/spectrogram | Local deterministic code | These calculations should not require an LLM. Model-produced language analysis still needs local validation. |
| Transcription and speech synthesis | Dedicated audio providers | This text benchmark says nothing about their speed or accuracy. Keep audio timing separate. |

Shortlisted fast candidate: `google/gemini-2.5-flash-lite`.
Retain `google/gemini-2.5-flash` as the current comparison baseline rather than calling
it a proven best coach. Consider `google/gemini-3.1-pro-preview` for a separate hard
coaching evaluation. Qwen and DeepSeek should stay in the evaluation pool, not be
selected merely from price or general coding benchmarks.
[@openrouterGeminiLite20260913] [@openrouterGeminiPro20260913]
[@openrouterQwen38Flash20260913] [@openrouterDeepseekFlash20260913]

## App wiring and unfinished-response investigation

Source inspection found:

1. `access.rs::resolve(Chat)` selects the Standard model. `fast_model` is stored and
   exposed in configuration but is not selected by task dispatch. A real task/model
   binding must be captured per operation with the existing receipt/provenance and
   retry rules; changing a settings label is not enough.
2. Hosted and grouped contracts currently restrict generation to Gemini 2.5 Flash.
   A native routing change needs corresponding server allowlist/capability changes.
3. `provider.rs` supplies `max_tokens: 2048`, `stream: false`, and disabled reasoning
   for generation. Structured coaching/gloss output shares that limit with short
   prose. Test representative large outputs before assigning task-specific caps.
4. The native HTTP client has a 90-second timeout; server generation work can last
   180 seconds. Investigate cancellation and receipt reconciliation at this boundary.
   This is a possible incomplete-response path, not a reproduced cause of the user's
   latest phone failure.
5. The native pool has four slots, shared with audio; hosted admission permits eight
   in-flight operations. Whole-turn latency includes queueing, dependent calls,
   validation and audio, not just the short model latencies above.

Next implementation slice: preserve per-operation timing (queue, dispatch, first
content if streaming, completion, validation, render), record finish reason and
validation category separately, clarify role references, then wire task-specific
model bindings consistently through native and hosted routes. Maintain independently
published results and explicit failed/unknown states. Do not hide failures with
unbounded retries or publish truncated structured output.

## Reproduce and extend

- `node scripts/benchmarks/model-routing.ts` prints the dry-run bound.
- `node --test scripts/benchmarks/model-routing.test.ts` tests rejection checks.
- `npx tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --allowImportingTsExtensions scripts/benchmarks/model-routing.ts scripts/benchmarks/model-routing.test.ts`
- Paid flags: `--live`, optionally `--qwen-alternative` or `--strong`. Existing result
  files prevent accidental reruns. Archive results under a new run identity before
  deliberately scheduling another paid comparison; do not overwrite this evidence.

`fixtures.json` is frozen synthetic input; run files record its SHA-256, requested
bindings, limits, concurrency and reservation. JSONL files preserve output, provider,
usage, errors and timings. `summary.json` contains aggregates. Catalog snapshots are
dated evidence, not a permanent pricing configuration. Exact provider tags are
requested; provider-family slug behavior and load conditions limit reproducibility.

Reaction prompts match the current app prompt. Coaching uses the app's main task and
voice instructions but only two synthetic candidate constructs, not a full captured
registry. Conversation and gloss prompts are simplified representative tasks, not
exports from the running app. No native Rust acceptance or end-to-end app claim is
made. Next runs need actual captured synthetic app payloads, native validators,
repeated trials, larger realistic contexts and a held-out multilingual set.
