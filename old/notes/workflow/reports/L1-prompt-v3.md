# L1 — Explicit grapheme endpoint catalog

State: source frozen for Integration review; one authorized synthetic live validation
passed after the initial focused checks. Root working tree; no Git mutations.

Integration reported a real `gloss_empty_or_reversed_span`, supplied span index 1,
and authorized this bounded prompt change. AI Operations was notified of Language
ownership of adapter.rs/tests. No speech changes.

## Change

Prompt template is now `partner-word-gloss-prompt-v3`. Each input catalog row is
`{start, end, text}` instead of `[start, text]`. A word selects its first row's start
and last row's end. A single-grapheme word also has distinct endpoints. Instructions
explicitly prohibit incrementing IDs/calculating offsets. The final end_boundary is
retained. Original passage, languages and safe source policy are unchanged.

Named endpoints remove next-row lookup; they do not impose word segmentation or
guarantee model compliance. Model output schema, FORMAT_ID, decoder, bounds and
native acceptance rules are unchanged. No repair or automatic retry was added.

## Verification

All 19 focused adapter tests passed with:

`cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib linguistics::adapter::`

Catalog reconstruction tests now independently resolve every explicit row endpoint,
check contiguous coverage through the terminal boundary, and reconstruct the exact
source across accents, Arabic marks, mixed scripts, emoji and CRLF. New regression
constructs candidates from first.start/last.end for repeated words, repeated decomposed
accent graphemes and a single Chinese character. It verifies actual source intervals
and complete coverage, then confirms equal endpoints remain rejected. Existing schema,
strict decoder and byte-limit tests still pass. Owned rustfmt and whitespace checks
pass. One initial stale prompt-wording assertion was updated to the v3 wording.

Named rows increase prompt bytes/token demand. Existing prompt/transport admission
limits remain in force; 4,096 ASCII scalars still pass the adapter prompt byte guard.
This does not establish admission under the tighter hosted request bound for every
eligible source. Integration should consider payload size when verifying actual
requests. No cost, latency or live-quality improvement is claimed by these tests.

Integration owns combined validation and any authorized live verification. This
addresses the generation task implicated by the diagnostic, not a proven universal
fix for all gloss failures.

## Authorized local provider check

Integration subsequently authorized one actual synthetic inference. Source:
`Sí, sí, quiero un café y una manzana.`; target es, explanation en. The temporary
ignored native test used the actual v3 builder, provider::complete_with_output on
Custom `/v1/operations`, timestamped native attempt identity, captured gloss source,
and validate_word_gloss_completion. Gemini returned a completion accepted as
**Complete: 8 glosses, 0 unresolved scalars**, with **1,242 input tokens and 398
output tokens**. Raw model output and credentials were not printed or persisted.
No monetary cost was returned by this Completion API.

Setup failures were distinguished from inference: sandbox loopback could not connect;
an escalated harness request then used an invalid plain-UUID attempt and was confirmed
HTTP 400 before inference by Integration's server logs. The corrected timestamped
request made the sole actual inference and passed. No automatic retry was introduced.
The temporary harness was removed and owned rustfmt check passed afterward.

This confirms structural acceptance on one synthetic sentence through the local
provider path, not semantic quality, a broad success rate, hosted deployment parity
or in-app QA. No further provider calls are pending from Language.
