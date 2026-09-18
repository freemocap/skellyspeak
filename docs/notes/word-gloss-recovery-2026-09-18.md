# Word-gloss recovery and bounded repair

Status: implemented in source, 18 September 2026, following the user's approval.
Speech recognition and the reported SBN/ESPN transcripts are explicitly deferred.

## Behavior

Native publication now recovers independently valid annotations from a structurally
valid response. Each annotation still passes the strict source/grapheme validator.
Bad rows are excluded; overlapping rows are all excluded rather than choosing a
winner. Disjoint rows can be sorted by their exact source coordinates. No fuzzy
matching, shifted source locations, or rewritten message text is introduced.

Unannotated whitespace and a conservative set of punctuation become literal
source text locally. Thus an omitted final question mark no longer produces a
partial warning. Digits, apostrophes, hyphens, currency/math symbols, emoji and
unrecognized graphemes are not declared translated. Existing valid results remain
visible; annotation errors no longer automatically discard their valid siblings.
Envelope parsing, response/source bounds, identity and normal completion remain
strict. Malformed JSON and provider/transport errors do not trigger repair.

A first successful result with unresolved regions schedules at most one background
repair on the same durable operation, with a separate attempt and the captured
fast model. The original source table and sentence provide context; unresolved
intervals are converted locally from UTF-16 coordinates to exact grapheme row IDs.
The model is asked only for missing meanings. Publication merges only annotations
contained in previously unresolved intervals. Accepted meanings cannot be replaced
or moved. A failed or still-partial repair retains available help and permits a
manual retry. No automatic repair loop exists.

The queue preserves connection ownership, cancellation, pause/hold behavior and
both outstanding-work and per-turn attempt limits. Automatic repair never releases
a hold or grants paused work a permit. Admission-blocked repairs retain the partial
result. The UI shows “Finishing word meanings…” while saved help is being completed.

Attempt diagnostics retain rejected row indices/reason codes, repair admission
outcome and the previous attempt ID when accepted results are preserved. Existing
provider metadata and usage remain retained. Those metadata fields contain no
message or generated translation text. Original and repair attempts remain
separately counted; this is additional bounded inference, not a free local action.

## Boundaries

This improves structural reliability; it cannot prove that a model's translation
is semantically correct. Previously saved results are not silently rewritten;
retrying word meanings applies the new behavior. No schema change, deployment,
application reset, STT changes or live-provider request was made for this work.

## Verification

The complete native library suite passed 395 tests with one existing live-provider
test ignored. Focused UI suites passed 36 tests. Production frontend build passed
with the existing bundle-size warning. Final targeted reruns passed all four
execution-repair tests and five recovery tests, including additional pause/budget,
combining-mark, UTF-16 mapping and duplicate-anchor coverage. Native Clippy with
warnings denied, formatting, generated-contract checks, seven-locale validation,
documentation links and whitespace checks passed.
