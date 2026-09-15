# L1 transport/schema review for G1a

Completed 2026-09-11. Reviewed integration checkout at
`002afd42cdc2eedd064f5e2915698e036f4166e2`; source references below refer to that
revision, not Reliability's in-progress changes. Saved in the Language worktree as
requested. Read-only source review plus in-memory serialization calculations: no
source implementation, builds, provider requests, paid calls or Git writes.

## Constraints for Reliability's transport-only G1a

1. Carry structured-output options through the common payload builder used by both
   direct and grouped routes. Do not merely embed the schema in prompt instructions.
2. Supply a named strict schema wrapper and require parameter support for direct
   OpenRouter structured requests; preserve no-fallback routing. Hosted routing is
   server-owned and should not receive direct-route provider controls.
3. Preflight the complete hosted/custom request against its route contract. The
   adapter's messages-only byte ceiling is not the server's admission bound. Include
   schema/framing and Python JSON reserialization overhead, not just compact Rust
   request bytes. Preserve exact inputs; no silent truncation, split or repair.
4. Capture output token/temperature settings as explicit task options. No evidence
   here justifies raising every request's output cap or changing prose defaults.
5. Keep native candidate JSON as a content string until L1's strict decoder sees it.
   JSON parsing of that string into a Value map would discard duplicate-key evidence.
6. Leave contract-selected publication to the execution seam. Transport must preserve
   Completion.finish_reason and usage; truncated output is failure, not valid partial
   assistance. Invalid results must not become chat messages or bypass authority.

## Concrete findings and smallest changes

### Schema is dropped before dispatch — confirmed source incompatibility

`src-tauri/src/linguistics/adapter.rs:37` returns messages plus format/template/policy
and output_schema. `provider.rs:177–192` accepts only model/messages/route and builds
max_tokens=2048, temperature=0.7, disabled reasoning, with no response_format.
`grouped.rs:197–202` calls that same builder for every child. Direct completion calls
it through request() at provider.rs:203. Neither path currently forwards the schema.

Smallest change: an explicit task-output request option consumed by this shared
builder, passed through both routes. Structured payload fragment:

```json
{"response_format":{"type":"json_schema","json_schema":{
  "name":"partner-word-gloss-boundary-v1",
  "strict":true,
  "schema":"<the adapter's actual schema object, not this placeholder string>"
}}}
```

Use the actual schema object and stable format identity; do not infer task type by
sniffing JSON content. No new endpoint or scheduler is needed for this transport seam.

### Server wrapper accepts the shape; model keyword support is untested

`server/contracts.py:69–79` already allows response_format with exactly type and
json_schema, and requires json_schema's exact name/strict/schema keys with strict
true and a dictionary schema. It does not inspect nested keywords. The candidate's
oneOf, const, pattern, minLength/maxLength and maxItems are therefore not rejected by
this application wrapper. That is not proof an actual provider accepts/enforces them.

Direct `provider.rs:189–190` currently sets allow_fallbacks:false only. Add
require_parameters:true for structured requests. Hosted `contracts.py:87–91` already
sets both flags and price ceilings; its inbound provider option, if supplied, must
match exactly {require_parameters:true} (lines 49–51). Do not copy the direct provider
object into hosted/custom requests and cause rejection.

No schema rewrite is justified solely by this review. Offline forwarding tests should
assert the candidate object is unchanged. Any endpoint schema rejection must be
explicit; no silent schema stripping or alternate model. Live keyword support and
linguistic quality remain unmeasured. A server allowlisted model is not a capability
proof; `/protocol` currently advertises models/max_items, not schema-keyword support.

### Input ceilings measure different objects — confirmed incompatibility

| Layer | Current bound / measurement |
| --- | --- |
| Source core | 4,096 Unicode scalars |
| Adapter | 256 KiB of serialized messages only; adapter.rs:18–19,205–212 |
| Native group | 1 MiB complete envelope; grouped.rs:205–210 |
| Server HTTP body | 1 MiB complete JSON body; main.py:441,677 |
| Server text admission | Python json.dumps(payload, ensure_ascii=False) UTF-8 bytes + 1,024, at most 100,000; contracts.py:80–83 |

The hosted bound includes full payload and schema, and Python's default separators
insert spaces. Compact transport bytes are insufficient as an exact proxy. The server
uses this conservative bound for reservation (contracts.py:84–94); it is not a token
measurement or actual charge.

An in-memory Python reconstruction of the current Rust prompt/template/schema and
proposed strict wrapper produced the following. It used 4,096 identical one-grapheme
scalars, native-style compact inner JSON, and the server's exact reserialization
formula. These are synthetic byte calculations, not execution of a model or a new
Rust test. Inputs contain no real conversation data.

| Synthetic source | Serialized adapter messages | Server input_bound with schema |
| --- | ---: | ---: |
| x repeated 4,096 times | 79,670 | 81,683 |
| double quote repeated 4,096 times | 104,246 | **106,259** |
| 界 repeated 4,096 times | 96,054 | 98,067 |
| Deseret letter U+10400 repeated 4,096 times | 104,246 | **106,259** |

All fit the adapter byte ceiling; the last-column values above 100,000 are rejected
by the current server. Quote/astral-letter examples do not rely on forbidden emoji or
NUL source. Hence source scalar bounds alone cannot establish hosted eligibility.

Smallest change: a request-level preflight after constructing the exact schema-bearing
payload, before network dispatch. Either implement the server's size accounting
exactly with cross-language fixtures or use a documented conservative bound. Reject
oversized work explicitly without changing the saved source. Keep group envelope
preflight too; valid child limits and valid group size are separate checks. No blanket
increase of server limits or hidden per-word requests is recommended.

### Output-token budget is prose-shaped — confirmed configuration, unknown adequacy

Native provider.rs:188 always requests 2,048 output tokens. server/local_server.py:52
sets MAX_COMPLETION_TOKENS=2048; server/cloudbuild.yaml:45 specifies 32768, while actual
service configuration is loaded from environment. These files do not establish the
live deployment's current cap. contracts.py:32–35 rejects requests above its configured
maximum; a native increase alone can break local/custom execution.

The adapter allows up to 512 spans and 256 scalars per gloss subject also to 128 KiB
response content. Those maxima do not promise completion within 2,048 tokens. No token
counts were measured in this review, so neither an adequate universal output cap nor
a required higher number is established. Smallest change: explicit captured task
settings, endpoint cap validation, and unchanged stop-termination rejection. Preserve
valid incomplete coverage only when a properly terminated/decoded result actually
contains omissions. Do not salvage length-truncated JSON as partial success.

### Response ceilings differ — boundary-test requirement, not automatic cap increase

- Adapter accepts at most 128 KiB of decoded content (adapter.rs:18,147).
- Direct transport caps the whole provider response at 262,144 bytes
  (provider.rs:236–240).
- Server caps upstream JSON at 4 MiB (main.py:653–655).
- Native grouped line limit is 4 MiB + 4,096; stream limit is eight such lines + 1,024
  (grouped.rs:9–10). These are transport limits, not annotation-content allowances.

Escaped candidate strings, response metadata and reasoning fields consume outer
response space independently of the decoded content limit. Do not equate 128 KiB of
content with 128 KiB of transport. Preserve separate caps and add boundary fixtures
with escaping and metadata before changing them; no observed valid production reply
was shown to exceed a limit in this review.

Grouped processing parses the outer response as a Value and reserializes it
(grouped.rs:25,110); the server similarly parses outer JSON (main.py:125). Candidate
content remains a string, so duplicate keys *inside* that string survive these steps
and can still be rejected by the strict adapter. Do not add an intermediate inner-JSON
Value parse in G1a.

### Execution validator is still prose-only — adjacent seam, not G1a transport scope

execution.rs:834–838 requires finish_reason=stop then invokes validate_prose on the
entire content. The prose policy rejects over 12,000 characters and is inappropriate
for validating the outer annotation JSON. provider::decode preserves finish_reason
and usage (provider.rs:133–155), which is the appropriate transport behavior.

Smallest later execution change: select prose versus structured validation by captured
output contract, keep stop checks and usage retention, then publish validated analysis
to its own result slot. L1 already validates prose policy on each generated gloss;
source/literal text must remain exact. This should inform the execution seam without
expanding transport G1a into scheduler, storage or UI work.

## Suggested offline checks for G1a

- Same structured options reach direct payload and grouped child; prose payload stays
  unchanged. Strict wrapper/schema and direct require_parameters are asserted.
- Hosted inbound provider fields obey server-owned routing; no direct-route object leaks.
- Boundary admission fixtures exercise full schema-bearing requests around the server
  input bound, escaped content, non-ASCII bytes and group envelope bounds.
- Completion.content retains duplicate-key JSON as a string for later adapter rejection.
- Stop/length and usage remain unchanged across both transports, even when the later
  structured decoder rejects a candidate. No automatic retry or schema downgrade.
- Local 2,048 cap versus configured higher server cap is treated explicitly; no claim
  that the candidate's maximum output size fits a given token budget.

No new tests were executed against the implementation in this review. Existing
integration check totals belong to integration; this report makes no new test-pass
claim. Recommend implementing the narrow payload-options/preflight seam first, then
reviewing the separately owned output-validator/publication seam. UI CSS cleanup has
no dependency on this read-only analysis.
