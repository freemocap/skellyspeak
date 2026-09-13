# Provider grammar versus native acceptance

Status: live proof of the provider-schema fix, using app-generated prompts and the
unchanged native decoder. Production provider/model routing is not changed.

## Fix and evidence

Groq's `discriminator_multiple_candidates` error came from repeating source-ID
enums (`first`, `last`) alongside the actual span discriminator (`kind`) in each
union branch. Changing `oneOf` to `anyOf` did not fix it.

The successful adapter removes only the repeated source-ID enums from the
provider-facing gloss grammar. It retains required fields, types, closed objects
and `kind` enums. The original source catalog stays in the prompt. The canonical
schema and native decoder retain source binding, Unicode boundaries, duplicate-field
rejection and semantic constraints. This is intentionally a less restrictive
*generation grammar*, not less restrictive *acceptance*. Do not use the provider
schema as the app's sole validator.

`groqGlossShape` implements the benchmark adapter. No production source schema or
validator was modified. Before integrating Groq text generation, carry this
capability-specific choice into the native/hosted provider adapter; leave existing
providers' schema policy alone unless independently tested.

## Real app prompts

`src-tauri/src/bin/benchmark_gloss.rs` exports four synthetic cases through
`build_word_gloss_prompt`: Arabic, Arabic with combining marks, Mandarin and Spanish.
It is an offline helper that neither opens app state nor accesses credentials.
The provider requests use these actual prompts and schemas, including native
zero-padded grapheme IDs. This supersedes the earlier simplified-gloss probe as
an adapter-compatibility test, but does not supersede an end-to-end app test.

Twelve direct Groq calls (four cases × three models), no retries, 2,048-token cap:

| Model | HTTP/schema completed | Native accepted | Median full response |
| --- | ---: | ---: | ---: |
| GPT-OSS 20B | 4/4 | 3/4 | 0.614 s |
| GPT-OSS 120B | 4/4 | 4/4 | 1.180 s |
| Qwen3.8 27B | 4/4 | 4/4 | 1.021 s |

All eleven accepted results had complete coverage according to the native decoder.
The rejected OSS 20B Spanish output repeated the `kind` property in one JSON object.
JavaScript JSON.parse and the mechanical schema check missed that; the real Rust
decoder correctly rejected it. This demonstrates why native validation is necessary
rather than treating a provider's strict-output claim as proof of correctness.

Agent review still found quality limitations: some Spanish word glosses were too
literal/misleading, some Arabic glosses omitted grammatical meaning, and pronunciation
approximations varied. Native acceptance is not expert linguistic approval. A cheap
model can generate a structurally valid but unhelpful explanation.

The richer real app prompt also produced actual Arabic glosses where an earlier
simplified prompt produced only literal spans. Prompt context changed along with
the schema, so attribute HTTP compatibility to the schema change, but do not
attribute the improved linguistic content to that change alone.

## Verification and accounting

- 12/12 passed the original canonical fixture schema checks after generation.
- 11/12 passed `validate_word_gloss_completion`; one correctly rejected duplicate JSON.
- All 21 existing native adapter tests passed, including invalid IDs, Unicode span
  safety, malformed/duplicate data, source constraints and policy checks.
- Five offline TypeScript harness tests and strict TypeScript checking passed.
- Groq estimated token cost for this pass: $0.0108673; conservative reservation:
  $0.066469425. Combined reservations for all 133 requests so far: $1.305217075,
  still below the announced $2 ceiling. Estimated costs are not billing receipts.

Saved evidence: `native-gloss-fixtures.json`, `groq-native-gloss-run.json`,
`groq-native-gloss-results.jsonl`, `groq-native-validation.jsonl`. The new fixture
hash is separate from the original screen's fixture hash.

Reproduce offline:

```sh
cargo run --offline --manifest-path src-tauri/Cargo.toml --bin benchmark_gloss -- export
cargo run --offline --manifest-path src-tauri/Cargo.toml --bin benchmark_gloss -- validate workflow/benchmarks/model-routing/groq-native-gloss-results.jsonl
cargo test --offline --manifest-path src-tauri/Cargo.toml --lib linguistics::adapter::tests
node --test scripts/benchmarks/model-routing.test.ts
node scripts/benchmarks/groq-routing.ts --native-gloss
```

The last command is a dry run. Adding `--live` spends tokens and refuses to overwrite
existing results. Price tables need rechecking before a later evaluation session.
