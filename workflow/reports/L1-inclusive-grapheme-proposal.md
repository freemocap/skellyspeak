# Recurring span failure: inclusive grapheme selection

## Implementation handoff

Integration approved and Language implemented adapter.rs, adapter_tests.rs and
languages.rs only. FORMAT_ID is partner-word-gloss-grapheme-v2; TEMPLATE_ID is
partner-word-gloss-prompt-v4. Input is graphemes [{id,text}], no terminal row. Exact
first/last membership and ordering derive unchanged native safe exclusive spans.
Strict shape, bounds, core acceptance and termination rules remain. Historical v1
live output stays verbatim in its fixture and is explicitly rejected by v2; no
compatibility decoder or new live-quality claim.

writing_guidance(language_id, optional_variety) resolves selected/default variety and
returns trusted current zh Simplified guidance, None for the other four. Metadata is
currently per language because zh has one configured variety; selecting a foreign
variety fails. Gloss prompt adds guidance only for its explanation destination.
The adopted text distinguishes verbatim excerpts from requested translation:
“When reproducing a source excerpt verbatim, preserve it exactly. This does not
prevent translating text when translation is requested.”

21 adapter tests and 4 language tests pass, including singleton/multiscalar/repeated
selection, exact multilingual reconstruction, gap/terminal/alias/reversed rejection,
old-wire rejection, strict JSON/bounds, destination guidance and unchanged registry.
Owned rustfmt and diff whitespace pass. Clippy found root-owned execution.rs:305
collapsible_if during concurrent integration; root notified, no full-Clippy pass
claimed by Language for this run. AI Operations and Code Quality reviews requested.
Root owns other fixture consumers, generic execution guidance and rollout checks.
No paid calls or Git writes; owned source frozen pending review.

Original proposal below; implemented status and verification are recorded above.
Integration reports a real empty/reversed span at supplied index 4 on an Arabic QA
turn (15:37:56, failure logged 15:37:58), with siblings successful. Its explicit retry
stored Partial, not Complete. The three prior saved results were Spanish Complete,
Spanish Complete and Arabic Complete; a later Chinese turn was Complete. These are
reported lifecycle/coverage observations, not raw-field evidence or quality rates.

## Replace model endpoint arithmetic with row selection

Use a new output format `partner-word-gloss-grapheme-v2` and prompt template v4.
Input catalog rows are `{id,text}` for each complete grapheme, in source order.
IDs use a distinct prefix, e.g. `g0000`, derived from the row's scalar start; IDs
are opaque and need not be consecutive. Do not expose a terminal row, because the
terminal boundary identifies no grapheme.

Candidate variants:

```json
{"spans":[
  {"first":"g0000","last":"g0003","kind":"gloss","gloss":"hello"},
  {"first":"g0004","last":"g0004","kind":"literal"}
]}
```

For exact source `Hola.`, this selects H through a and then the period. Both ends
are inclusive **grapheme IDs**. For a single-grapheme word, first equals last by
definition. Prompt wording: “Choose the first and last grapheme rows belonging to
the word. For one row, use its ID for both. Copy IDs exactly; do not count characters
or calculate boundaries.” Preserve whole-passage context and AI linguistic grouping.

Native code builds a private ordered lookup from each row ID to the existing safe
scalar span. Validate first and last membership; require first row index <= last
row index. Construct `[first_row.start, last_row.end)` and pass it to the unchanged
core validator. Multi-scalar graphemes use their actual stored end, never ID+1.
Keep overlap/order, gloss bounds, source binding, strict JSON and termination checks.

Unknown IDs, terminal IDs, old start/end fields, malformed rows and reversed first/
last selections fail explicitly. No sorting, endpoint swapping, snapping or accepting
old malformed boundary candidates under new semantics. Equality is valid only in
the new row-selection format; this is a new contract, not repair of an old error.
An inclusive single-grapheme selection may still be linguistically incomplete: native
source integrity does not establish correct word grouping.

## Finite implementation seams, if assigned

Language: adapter.rs/tests for row catalog, strict wire fields, mapping and diagnostics;
core mapping/validation policy unchanged. Existing numeric core spans and saved UTF-16
projection stay unchanged. Update FORMAT_ID/template provenance consistently in schema,
prompt and saved result projection through existing constants. Integration reviews
pending/retry behavior so a change cannot silently reinterpret an old wire response.
Existing persisted accepted results remain readable without re-decoding.

Preserve authentic v1 model fixture as v1 historical evidence, not relabel it v2 or
silently convert it into a purported new live fixture. Tests for old wire rejection
and new equivalents are separate. No new inference, provider fallback or automatic
retry is implied by rollout. One future bounded live check needs explicit authorization.

Required regressions: single Latin/Chinese grapheme; repeated words; decomposed accent;
Arabic marks; emoji ZWJ; first/last reversed; unknown/noncanonical/terminal ID; overlapping
words; valid partial/literal-only/empty results; exact source reconstruction; existing
size/strict shape/termination limits. Include a generated valid single-row candidate
with equal IDs and prove old start=end boundary JSON remains rejected as wrong shape.

## Independent Simplified Chinese gap

Current registry resolves zh to Mandarin and zh-CN to Mainland China. Inspected
execution.rs partner prompt says to use the configured variety, but only serialized
settings provide zh-CN; no explicit Simplified Chinese instruction is present.
Configuration extraction alone did not change these prompt bytes.

Propose a minimal trusted variety-owned generation instruction for current zh-CN:
“Write newly generated Mandarin text in Simplified Chinese characters. Preserve any
quoted source text exactly; do not rewrite quotations to change their script.”
Other current varieties need no new instruction in this slice. Resolve selected
variety once and append the trusted instruction to partner/coach generation prompts,
including target-language examples. Capture it in the existing persisted prompt
messages and update the relevant prompt version. Do not insert a zh-specific branch
in provider transport or add a generic grammar hierarchy.

This is generation guidance, not a source normalizer or a claim of deterministic
script enforcement. Do not modify saved text, require the gloss model to recopy source,
or reject shared Chinese characters as evidence of wrong orthography. Translation
into Chinese and Chinese gloss explanations should use the destination language's
own resolved default writing guidance when no destination variety is captured. For
the current sole zh variety this explicitly means Simplified Chinese. Never borrow
the conversation target's variety to govern a different explanation language. If
multiple zh orthographies are added later, their destination selection needs a
separate explicit contract rather than an inferred preference.

Minimal getter proposal: `writing_guidance(language_id, variety_id: Option<&str>)
-> Result<Option<&'static str>>`. Resolve supplied variety against that language;
otherwise resolve its explicit default. Only current zh-CN carries trusted guidance,
the other current entries carry None. Execution uses this generic getter, with no
language-ID branch. Partner/coach target generation uses selected target variety;
gloss explanation and translation destination use their own captured destination
language/default. None means no added instruction, not unsupported generation.

Proposed ownership: Language languages.rs trusted variety metadata/helper if assigned;
Integration execution.rs prompt capture/version and task scope; AI Operations reviews
wording and bounded verification. Keep this separate from the inclusive-span change
so its result can be assessed independently. No source changes made in this review.

AI Operations independently agrees with the same g-ID inclusive selection and native
mapping design, simple structural schema, format/template revision and root-owned
in-flight/retry policy. It also confirms the current missing explicit script guidance.
