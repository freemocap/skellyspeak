# Source-linked annotation contract

Status: deterministic boundary requirements accepted by integration in DATA-MODEL.md;
core registered for normal Cargo tests. Provider output format, durable result schema
and production execution/UI wiring remain separate. No provider evaluation has run.

## Source and ownership

One bounded task proposes short contextual word glosses for one immutable saved
persona message, using Standard and its captured explanation language. The complete
passage supplies context. It does not assess the learner or spawn per-word work.

Capture `message_id`, `target_language_id`, `explanation_language_id` and
`analysis_version = "persona-gloss-v1"`. The immutable message ID identifies its sole
content revision. No synthetic numeric revision is added; editing/regeneration creates
a fresh message ID. Mutable messages would require an authoritative revision and a
new contract. Resolve language IDs and parent ownership natively during integration.

The app attaches operation/attempt IDs, route, concrete model, prompt/schema version
and boundary policy; the provider cannot assert those values. Candidate identity is
bound to the captured source, not whichever message is selected when output arrives.
Validation here compares identities but is not a transactional authority check.

## Deterministic coordinates and grapheme safety

Half-open Unicode scalar coordinates identify source spans. The source is never
trimmed, normalized, case-folded or newline-converted. `SourceMap` derives UTF-8 byte
and UTF-16 boundary coordinates from that exact string. Native code supplies validated
UTF-16 spans to frontend slicing; JavaScript must not use scalar indices directly.

Accepted policy: default Unicode 17.0.0 extended grapheme clusters using pinned
`unicode-segmentation = "=1.13.3"`, policy ID
`uax29-egc-17.0.0-us1.13.3-v1`. `validate()` checks every candidate endpoint;
`validate_grapheme_span()` exposes the same check. Invalid endpoints reject the
candidate without snapping, extending, repair or normalization. Combining marks,
ZWJ emoji, modifiers, flags, variation selectors, keycaps, Indic conjuncts, Hangul
clusters and CRLF are preserved. This is not a linguistic word/sentence tokenizer.

`byte_span`, `utf16_span` and `slice` remain low-level scalar conversion utilities:
they do not themselves certify grapheme boundaries. Use candidate validation or
`validate_grapheme_span` before treating a scalar span as an interactive target.
The distinction permits mechanical coordinate tests without accepting unsafe output.

The boundary catalog includes only allowed grapheme endpoints, including the terminal
endpoint, with stable scalar-derived IDs. For `e\u0301x`, IDs are b0000, b0002, b0003;
b0001 is absent. Exact `resolve_boundaries` lookup rejects absent/noncanonical IDs,
empty/reversed ranges and unknown endpoints. IDs are local to message/contract, not
global words. Source identity is still checked when validating the mapped candidate.

Version changes require explicit policy revision and revalidation of saved references;
reading or revalidation never creates inference. The official pinned Unicode corpus
and application rejection tests verify this policy; see fixtures/README.md.

## Words, phrases and exact coverage

Individual word targets must remain available independently of phrase explanations.
This core's word-gloss layer accepts ordered, disjoint, nonempty word spans plus
literal/unresolved intervals. A word is a linguistic judgment, not a whitespace run:
adjacent Mandarin/Thai spans are supported. Repeated words have distinct occurrences.
A word-only string cache is not context-correct.

`Unit::Phrase` is explicitly rejected with `PhraseRequiresSeparateLayer`; it cannot
substitute a phrase for existing word targets. A separate phrase layer/result is
future work pending UI/result review, not a removed parity requirement. No overlap
repair, sorting, nested targets or cross-layer merge is implemented here.

Supplied span variants are gloss, literal and unresolved. Gloss requires nonblank
short help; literal intentionally has no lexical help; unresolved identifies missing
help. Literal classification outside whitespace remains a semantic judgment. Every
omitted interval is added: whitespace-only gaps are literal; all other gaps are
unresolved. Resolved segments partition the exact original string. Since candidate
endpoints are grapheme-safe, the complementary gaps are too. Any invalid supplied
span rejects the entire candidate, rather than dropping bad items.

Limits: 4,096 source scalars, 512 supplied spans, 256 scalars per gloss. Empty/whitespace
sources are ineligible. Oversized input fails, never truncates or silently chunks.
Transport byte/output-token limits must be enforced before decoding at integration.

## Proposed provider shape and worked example

Strict numeric candidate example for exact synthetic source `Sí, sí! 你好 👋`:

```json
{"spans":[
  {"start":0,"end":2,"kind":"gloss","unit":"word","gloss":"yes"},
  {"start":2,"end":3,"kind":"literal"},
  {"start":4,"end":6,"kind":"gloss","unit":"word","gloss":"yes"},
  {"start":6,"end":7,"kind":"literal"},
  {"start":8,"end":10,"kind":"gloss","unit":"word","gloss":"hello"},
  {"start":11,"end":12,"kind":"literal"}
]}
```

The source has 12 scalars, 21 UTF-8 bytes and 13 UTF-16 units. Emoji [11,12) maps
to bytes [17,21) and UTF-16 [11,13). Whitespace gaps [3,4), [7,8), [10,11) become
literal. Removing the Chinese gloss creates unresolved [7,11), including surrounding
spaces, and a partial result. Concatenating source slices always reconstructs the
source. Provider output never recopies known source strings to attach metadata.

Alternative output uses `start_boundary_id` and `end_boundary_id`, selected from an
app-built catalog, e.g. b0000/b0002 for the first gloss. IDs avoid output arithmetic
but increase prompt/output overhead. Both representations map to the same validator.
[RECOMMENDATION.md](RECOMMENDATION.md) defines a finite format comparison; neither
wire format is benchmarked. The boundary-ID candidate now has a strict pure decoder
and prompt builder in adapter.rs; the numeric example remains an alternative for
evaluation. See ADAPTER-PROPOSAL.md for the implemented minimal tagged shape.
Reject unknown/duplicate fields, wrong variants, malformed JSON, trailing content and
negative/noninteger/out-of-range coordinates before constructing typed candidates.

Pronunciation and romanization are absent in this task, not inferred or failed.
Future slots need scheme/language/variety, status and their own provenance. Deep word
insight has a separate result contract rather than overloading a short gloss.

## Readiness, retry and publication

Structural complete/partial coverage is distinct from available help. Consumers use
`coverage()`, `gloss_count()`, `gloss_scalar_count()` and `unresolved_scalar_count()`.
Complete literal-only output has zero help and must not imply available word glosses.
Counts are not semantic quality, word denominators or proficiency. A structurally
valid literal label on ordinary text still needs linguistic review.

Pending has no newly accepted result; failed has a typed error and no new result.
A valid partial result is terminal and readable, not still running and not a trigger
for automatic retry. A failed explicit retry retains prior valid help and records
its failure separately. A later accepted result replaces the logical result, never
merges ambiguous spans or duplicates evidence. These lifecycle semantics are accepted
requirements; the pure module does not implement a scheduler or storage transaction.

Retry preserves immutable source, operation and captured languages/version; a new
attempt receives new provenance. Input changes require a new operation. Cancellation,
source deletion and revocation must defeat late publication transactionally in the
existing execution owner. Reading saved data never creates inference. No new cache,
credential path, database, admission pool, fallback or retry loop is introduced.

## Consumer compatibility and R2

Main's UI/workflows remain the target. Tap reveals a word gloss, drag reveals several
word glosses, and whole-bubble reveal/hide changes display; drag is not phrase analysis.
Mount/reopen/preferences likewise read saved results. Intentional deep inspection may
itself express a semantic request through the existing scheduler: no extra button is
required. Result availability, deduplication and failure behavior remain explicit.

| Required behavior | Additional ownership/contract work |
| --- | --- |
| Word reveal and selection | Consume native validated word targets without replacing them with phrases. |
| Deep contextual detail | R2 proposes one explicit request for a saved persona-word occurrence, with separate meaning/lemma/POS/form/role/usage output. L1 detail schema remains follow-on work. |
| Punctuation sentence translation | Literal punctuation does not establish sentence boundaries; review sentence anchors while preserving independent whole-message translation. |
| Learner analysis | Preserve speaker and known assistance; do not derive skill credit from aided/persona text. |
| Mechanics/examples/native-language contrasts | Additional structured explanations and captured explanation language, not fabricated gloss metadata. |
| Suggestions and coach reading | Review source lifetimes/identity; suggestions insert into the current draft without sending; coach content stays private. |

R2's selected-word identity is immutable message + scalar occurrence + captured
languages, with native word eligibility/authority at acceptance and publication.
Unannotated words and other source types remain explicit parity follow-ups, not
permanent exclusions. Phrase UI review does not block this deterministic core.

Registered module and its tests are source implementation, not a running assistance
feature. Provider/task wiring, serialized result policy, frontend generation and
cross-domain lifecycle checks remain integration work.

## Consumer note for the approved conversation-reading slice

The pure adapter is complete; integration owns its durable/IPC connection to the UI.
Interaction should consume a saved, source-bound result projection, not call the
adapter or construct provider requests. The projection needs the immutable message
identity, accepted analysis/policy identity, ordered source segments, native-validated
UTF-16 coordinates, optional word gloss text and explicit unresolved coverage.
This lists consumer requirements; it does not create a second generated TypeScript
schema. Integration should derive the actual shared contract from the accepted model.

Render the original message exactly. Each accepted word occurrence keeps its own
source span and reveal state even when wording repeats. Literal and unresolved spans
remain source text, not fabricated word targets. Phrase/detail results must not erase
word anchors. A complete result with zero glosses has no help to reveal; a partial
result with glosses can reveal those glosses while retaining its unresolved status.

Tap, drag across words, whole-bubble reveal/hide, preference changes and reopening
read saved data. Intentional contextual inspection may express an explicit help
request through the reviewed execution action; it must not be inferred from ordinary
reveal or mount. A failed new attempt preserves previously accepted help. UI state
must retain the owning message scope when asynchronous results arrive, and discard
source-owned data when its source is deleted or invalidated. Integration owns those
publication and snapshot rules; this adapter does not implement them.
