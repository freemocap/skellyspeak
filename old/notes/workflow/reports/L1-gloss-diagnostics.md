# L1 — Safe gloss failure diagnostics

State: Language source frozen for Integration review. Root working tree; no Git writes.

## Finding and implemented change

The adapter already distinguishes content-free rejection reasons, but gloss.rs erased
them with `map_err(|_| validation_error())`. Historical failed response content was
not retained; token counts and generic errors cannot identify those failures.

Added these pure methods in linguistics/adapter.rs:

```rust
pub fn diagnostic_code(&self) -> &'static str
pub fn span_index(&self) -> Option<usize>
```

Codes are explicit static strings, never Debug output or parser messages. Index is
the zero-based supplied span index, when available, not a source coordinate. Mapping
covers termination, response/prompt bounds, JSON/shape, source eligibility, boundary,
ordering, gloss text and serialization failures. No decoder, schema, prompt, acceptance,
repair, request or retry behavior changed. AI Operations confirmed no competing edits.
Integration owns gloss.rs propagation and combined verification.

Preserved diagnostic granularity: the existing wire boundary resolver reports
UnknownBoundary for absent, noncanonical, out-of-range or unsafe endpoint IDs. The
code `gloss_unknown_boundary` does not distinguish these retrospectively. Existing
InvalidJsonOrShape also includes wire item-count overflow; no parsing of serde error
strings or second permissive parse was introduced.

## Verification

`cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib linguistics::adapter::`
passed all 18 tests (152 other tests filtered). New synthetic regression covers
unknown fields with private sentinels, unknown endpoints, empty intervals, split
combining-grapheme IDs, overlaps, invalid gloss text, excessive gloss length and
non-stop completion. It asserts code/index distinctions and retained completion
usage/content. Existing strict acceptance and partial-result tests still pass.
Owned files formatted with rustfmt edition 2024. This is focused native verification;
no live calls, native UI QA or full combined test claim.

## Prompt investigation, deferred

AI Operations proposed including each grapheme's end boundary in prompt catalog rows
to remove successor-row lookup. This is a plausible generation aid, not a diagnosed
fix. Current endpoints remain AI-selected linguistic words, with no whitespace-based
word tokenizer. Wait for an actual safe reason code before changing the prompt;
boundary, ordering, shape and gloss-text failures need different responses. Any later
catalog change requires prompt-version update and exact-source reconstruction tests.

Speech is unchanged. No automatic retries or relaxed validation were introduced.
