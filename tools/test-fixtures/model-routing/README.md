# Native gloss contract fixtures

`native-gloss-fixtures.json` is generated from the **current native adapter** by
`native/src/bin/benchmark_gloss.rs`. It includes four synthetic passages: Arabic
with and without combining marks, Chinese and Spanish. No archived fixture or
provider output was copied. The existing native case definitions were reviewed
for current `SourceIdentity`, prompt construction, `word_gloss_v1` schema shape
and source-bound endpoint IDs before adopting their export for these tests.

From the repository root:

```sh
npm run benchmarks:fixtures
npm run benchmarks:fixtures:check
npm run benchmarks:test
```

The exporter resolves the output relative to its Cargo manifest. Consumers resolve
it relative to their source modules, so it does not depend on the shell directory.
CI checks freshness against Rust before accepting changes. Do not edit the JSON
by hand. Review regenerated diffs when native prompts, language configuration or
schemas change.

Server routing tests use every schema to verify endpoint relaxation without
mutating the canonical input. Offline screening tests exercise structural rejection
and ordered source coverage. The native decoder remains the authority for full
gloss acceptance. Passing these tests is not a model-quality result.

The small reaction and coaching inputs in `tools/benchmarks/screening-fixtures.ts`
are newly authored helper tests. Their reduced schemas are intentionally not
presented as current provider contracts or a representative evaluation corpus.
