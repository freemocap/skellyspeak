# Drill generation: UI integration handoff (2026-09-22)

Status: backend and platform adapters implemented; Add phrases UI still to wire.
This records the current contract, including the learner-approved length choices.
It complements the main Drill plan's item-source seam.

## Controls and flow

Use the current target/explanation language and variety settings, the shared
`DifficultySelect` and generated `DIFFICULTY_LEVELS`, an optional topic, quantity
(1–20), and a separate length selector. Do not map length to difficulty.
Import `DRILL_LENGTHS` and `DrillLength` from generated contracts rather than
maintaining another enum. Use these functional labels:

| Value | Label | Requested shape | Native maximum UTF-16 units per item |
| --- | --- | --- | --- |
| `word` | Word | One lexical word in the language's normal spelling | 64 |
| `shortPhrase` | Short phrase | One brief expression or clause | 160 |
| `sentence` | Sentence | One complete sentence | 320 |
| `severalSentences` | Several sentences | Two or three connected sentences | 512 |

A reasonable initial selection is `shortPhrase`. The request must explicitly
include `length`; unknown/missing values fail before dispatch. These maxima are
size safeguards, not word counts. Native rejects over-limit candidates using
UTF-16 units, including correct handling of supplementary-plane characters.
The model is instructed about the shape; native does not certify lexical word
boundaries, grammatical sentence completeness or proficiency. `verified.lengthOk`
means the native size bound passed. Difficulty is the existing Chat instruction,
not a second classifier. Requested difficulty/length remain in provenance.

Generate → preview/select → Add to practice. Regenerate is a new explicit request.
Changing controls must not silently start generation or change a pending request's
meaning. Use the returned `requested` input to caption a preview. A late result
must not replace a different language/source's preview. The adapter owns the
begin/run/cancel lifetime; UI owns source selection and presentation.

## Existing adapters to connect

All are in `ui/src/platform/ipc/drill-generation.ts`:

- `previewDrillItems(input, signal)` runs one explicit request. Input includes
  `language`, `variety`, `explanation`, `explanationVariety`, `difficulty`, `length`,
  `topic` (null for level-only), and `count`. It reserves natively before dispatch
  so cancellation can handle even a late reservation result.
- `acceptDrillItems(requestId, candidateIds)` adopts only native candidates. No
  caller text or provenance. Partial acceptance is supported; repeated acceptance
  returns the same items without another AI call. Retrying does not resurrect a
  deleted item. Reload the phrase list after success.
- `getDrillPreview(requestId)` recovers a completed persisted preview.
- `discardDrillPreview(requestId)` cancels pending work and removes unaccepted
  candidates; accepted provenance/idempotence is retained. Unaccepted previews
  expire after one day. The active wholly unaccepted preview cap is 100.
- `conversationDrillCandidates({scope, cursor, limit})` extracts exact source spans
  without AI or rewriting, returning `{preview, nextCursor}`. `scope` is the shared
  ReadingScope, limit 1–50. An empty page can still have a continuation. Accept uses
  the same command; edited/deleted sources are rechecked before new acceptance.
- `drillGenerationActivity()` returns the shared receipt shape filtered to Drill.

Requested, model-reported and mechanically verified properties stay distinct.
`scopeMatchesRequest` means native scope binding, not independent language
recognition. Conversation previews have `requested: null` and `receiptId: null`.
Show a shortfall honestly; do not automatically refill it. Oversized candidates
are omitted, not truncated into broken words/sentences. Text, translation and
model labels remain native-owned preview data.

## Shared machinery and limits

Generation reuses `application/commands/proposal_execution.rs` and
`ai/generation/` with persona generation. It shares difficulty, admission,
authority/cancellation, provider routing, refusals, receipts and existing transport
retry policy. Length affects prompt, output schema, validation, bounded output
allowance and durable requested provenance. Output allowance scales with quantity
and length up to the shared provider limit; it is not measured usage or cost.
No automatic regeneration or paid replacement request is added.

Schema is **37** because persisted request/provenance JSON now requires length.
A development Factory Reset is required when opening an older-schema workspace
with a rebuilt app. No migration or compatibility default invents lengths for
previously generated items. No live provider calls were made for verification.

## Checkpoint

After UI integration, test a word request and a several-sentence request at the
same difficulty, topic and level-only requests, acceptance of only some items,
repeat acceptance, explicit regeneration and switching language during generation.
Check actual linguistic quality with a real provider; fake-provider tests only
establish wiring, bounds, persistence and accounting. Also check Japanese or
another language that does not delimit every word with spaces. Reuse the existing
target card/aids/recording pipeline for accepted items.

No Drill feature UI/style files were edited in this backend length slice. No
commit was made. Pagination Step C remains a separate coordinated change; the
existing additive history contract is left intact.

Automated verification: full native suite 595 passed, 6 existing ignored; after
adding the output-budget refinement, all 8 focused generation tests passed.
Full UI suite 1,142 passed across 168 files. Clippy all-targets, fmt, generated
contracts, TypeScript, preview TypeScript, content/languages, build and diff-check
passed. The new end-to-end test exercises all four lengths through a local fake
provider, rejects over-limit supplementary-plane text, checks requested difficulty
is independent of length, checks the output allowance and checks saved provenance.
