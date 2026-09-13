# Smaller calls and progressive results

Status: a bounded live experiment and proposed integration, not a changed production
scheduler. Native concurrency remains four; no app UI or model binding changed.

## Billing premise

For the plain text Groq models tested, published rates price input and output tokens,
not a flat per-request fee. That does not mean splitting is cost-neutral: repeated
system instructions, schemas and shared context are input tokens every time;
reasoning and output framing can also repeat. Other API products and tools may have
request or tool charges, so this is not a universal claim about all AI APIs.
[@groqModels20260913]

For N independent pieces with shared prompt P, splitting adds roughly (N−1)P input
tokens before caching or provider-specific accounting. Cache eligibility does not
justify assuming zero cost. Separate requests also consume request-rate capacity;
Groq limits both requests and tokens at organization scope. [@groqRateLimits20260913]

## What is already split

`turn_plan.rs` defines separate partner reply, user/partner gloss, translation,
coaching, reaction, suggestions and speech operations. User analysis can start from
local context; partner analysis waits for the actual reply. `server/grouped.py`
executes grouped items concurrently and yields each result independently. Grouped
HTTP transport is not one combined LLM prompt. Native publication preserves completed
siblings. Rebuilding that separation would duplicate existing work.

This experiment instead splits **inside one gloss operation**. Existing gloss
publication is atomic per message, so production chunk publication would require a
new result contract rather than merely increasing the pool limit.

## Experiment

- Same Groq GPT-OSS 120B model, low reasoning, temperature 0.7, no retries.
- Two synthetic four-sentence paragraphs: Spanish and Arabic.
- Three repetitions each, rotating variant order to reduce ordering bias.
- Variants: full paragraph; four sentence chunks serially; chunks with two workers;
  chunks with four workers. 24 conditions, 78 requests total.
- App-native prompt builder and the tested structural provider schema. Every chunk
  receives its own exact grapheme catalog and the full paragraph as context-only
  data. Each chunk has its own source identity; merging into one message is not
  implemented by this test.
- Equal aggregate maximum completion budget: 4,096 for the whole passage versus
  1,024 per chunk × 4. Actual token counts can and did differ.
- Same unchanged native decoder validates saved results; complete coverage and at
  least one gloss are required for timing a usable structural result. This is not
  an expert judgment of linguistic usefulness.

## Results

| Strategy | Fully validated conditions | Median all-validated time | Estimated cost, six conditions |
| --- | ---: | ---: | ---: |
| One whole request | 5/6 | 4.308 s | $0.007455 |
| Four chunks, serial | 5/6 | 6.186 s | $0.014178 |
| Four chunks, concurrency 2 | 5/6 | 3.875 s | $0.013870 |
| Four chunks, concurrency 4 | 6/6 | 2.383 s | $0.014231 |

The all-validated medians exclude conditions with a rejected piece; costs include
all requests. Failures must not be omitted when interpreting speed.

A matched comparison removes the condition where the whole request failed:

- Five identical paragraph/trial pairs fully validated under both whole and split-4.
- Whole request median completion: **4.308 seconds**.
- Split-4 median first *in-order* validated chunk: **1.491 seconds**.
- Split-4 median all-chunks completion: **2.067 seconds**.

This is promising for progressive rendering. These times mark HTTP completion of
pieces subsequently accepted by the native decoder. They do not measure UI paint,
validation wall time, first streamed token or a real phone conversation.

The trade-off was **1.91× estimated cost** for split-4 over all six conditions.
Input tokens rose from 10,614 to 37,655 (3.55×), and output tokens from 9,771 to
14,305 (1.46×). Shared prompts/context and independent generation are not free.
The absolute amounts in this test were small, but the ratio matters at scale.

All 78 HTTP responses completed with stop termination. Three were rejected by the
native decoder for overlapping/unordered spans: one whole request, one chunk at
concurrency 2, and one serial chunk. No retry or silent output repair was used.
No inference that concurrency 4 improves accuracy is justified by six conditions.

Agent review of matched outputs found understandable but imperfect glosses in both
forms (e.g. overly literal Spanish me/gusta and variable Arabic subject information).
The split did not establish better linguistic quality. Full context helps preserve
meaning but cannot guarantee coherent analysis across independent calls. This is
an exploratory sample, not a provider load test or production latency guarantee.
[@openrouterLatency20260913]

## Recommended implementation slice

1. Keep existing independently published reply, coach, translation and reaction
   outputs. Prioritize partner reply and user-triggered work over background glosses.
2. Split **long gloss passages at sentence boundaries**, with a size threshold and
   bounded maximum chunks. Keep ordinary short messages as a single request. Do not
   issue one call per token/word or split through grapheme clusters and Arabic words.
3. Persist a parent analysis identity, source revision, chunk ranges and individual
   operation/attempt receipts. Map validated chunk-local spans to original source
   coordinates deterministically. Reject stale chunks after editing/replacement.
4. Publish validated chunks as they finish, maintaining stable sentence order and
   explicitly incomplete regions. Keep successful chunks if another fails; retry
   only the failed piece. A partial result must not masquerade as complete analysis.
5. Start with at most two background chunk calls within the existing pool; allow
   more when no foreground work is waiting. Reserve capacity or priority for reply,
   recording/transcription and explicit user actions. Raising a global limit alone
   can make interactive work slower. Test provider RPM/TPM, server admission, native
   permits and queue waits together before considering six/eight total slots.
6. Keep a coherent partner reply as one generation (streaming can be evaluated
   separately). Keep error interpretation/evidence together in coaching; any later
   split between analysis and learner-facing explanation needs an explicit evidence
   contract so helpers do not invent contradictory diagnoses or duplicate XP.

Small calls are therefore a useful latency strategy for selected work, with a real
cost/consistency trade-off. “Faster first useful result” and “everything finished”
are separate targets. Chunking and model routing should be independently configurable
and measured, rather than assuming that more calls plus more concurrency always win.

## Artifacts and verification

`split-fixtures.json`, `split-run.json`, `split-results.jsonl`,
`split-native-validation.jsonl`, `split-summary.json` preserve the full experiment.
The manifest records a fixture hash and output budget. Summarization refuses missing
or duplicate attempts rather than claiming a partial run succeeded.

```sh
cargo run --offline --manifest-path src-tauri/Cargo.toml --bin benchmark_gloss -- export-split
node scripts/benchmarks/split-calls.ts
cargo run --offline --manifest-path src-tauri/Cargo.toml --bin benchmark_gloss -- validate workflow/benchmarks/model-routing/split-results.jsonl
node scripts/benchmarks/summarize-split.ts
```

The request command above is dry-run; `--live` is explicitly paid and refuses to
overwrite existing results. Native fixture validation and strict TypeScript checks
passed. No production codepath, concurrency configuration or UI has changed.

Estimated Groq cost for these requests: **$0.04973385**, from reported token usage
and the dated official prices; not a billing receipt. Conservative reservation:
$0.1404135. All evaluation rounds together now contain 211 attempts and reserve
$1.445630575 at most, within the previously announced $2 experiment ceiling.
