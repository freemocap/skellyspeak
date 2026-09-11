# Current-five language configuration contract

## Implemented first source slice — provenance extension remains proposed

Integration subsequently assigned languages.rs only. The compiled current-five table,
private exact resolver, explicit direction/scheme/default-variety fields and existing
IPC projections are implemented there. Public signatures, IDs, labels, ordering and
all valid defaults remain unchanged. Validation runs once on first registry/resolver
use via OnceLock; invalid compiled programmer-owned data fails immediately. There is
no lib.rs initialization edit in this assigned slice.

Three focused language tests pass, including exact registry projection, default
settings for all 25 target/explanation pairs, malformed tables and explicit default
independence from variety order. All 19 existing adapter tests pass. Owned rustfmt
and diff whitespace checks pass. `cargo clippy --offline --locked --manifest-path
src-tauri/Cargo.toml --lib --tests -- -D warnings` passes. Code Quality review requested
for the completed diff. Code Quality subsequently completed its bounded source review:
no actionable findings; serialized values/order/defaults and rejection boundaries
preserved. Source remains frozen for Integration.

No turn-context version, pre-dispatch gate or new runtime behavior is implemented.
In particular, the proposed tightening of defaults(explanation_language) below is
NOT adopted: it still copies the input; validate_settings rejects unknown explanation
IDs as before. All later sections describe the broader proposal, not completed work.
No active files outside languages.rs were changed for implementation.

The original design proposal below remains subject to Integration review beyond the
implemented table slice. No new catalog, UI, capability database, plugin framework
or paid calls. This is configuration extraction, not a gloss-coverage repair.

## Minimal native types

Use a compiled, immutable typed table in languages.rs first. No JSON loader or new
dependency is required to make language differences declarative.

```rust
const LANGUAGE_CONFIG_VERSION: &str = "language-config-v1";
enum Direction { Ltr, Rtl }
struct VarietyConfig { id: &'static str, name: &'static str }
struct LanguageConfig {
    id: &'static str,
    name: &'static str,
    native_name: &'static str,
    direction: Direction,
    romanization: Option<&'static str>,
    varieties: &'static [VarietyConfig],
    default_variety_id: &'static str,
}
```

The single version covers the complete small table and resolution semantics. Bump
it for any meaning-affecting configuration change; do not tie it to prompt, provider
or analysis versions. Existing Language/Variety IPC shapes remain unchanged.

| ID | Name / endonym | Direction | Romanization | Ordered varieties; default first |
| --- | --- | --- | --- | --- |
| en | English / English | ltr | None | en-US: United States; en-GB: United Kingdom |
| es | Spanish / Español | ltr | None | es-ES: Spain; es-MX: Mexico |
| fr | French / Français | ltr | None | fr-FR: France; fr-CA: Canada |
| ar | Arabic / العربية | rtl | ALA-LC | ar-MSA: Modern Standard Arabic |
| zh | Mandarin / 普通话 | ltr | PINYIN | zh-CN: Mainland China |

Preserve registry ordering exactly. default_variety_id explicitly equals today's
first entry, so future presentation reordering cannot silently change defaults.
Direction and scheme move from current ID-specific branches into table entries.
No new orthography options, grammar flags, task overlays or background fields are
needed by today's consumers. Add such fields only with their next concrete feature.

## Resolver and existing consumers

Proposed internal API:

```rust
fn resolve(id: &str) -> Result<&'static LanguageConfig>;
fn resolve_variety(language_id: &str, variety_id: &str)
    -> Result<&'static VarietyConfig>;
fn validate_config_table(configs: &[LanguageConfig]) -> Result<()>;
```

`resolve` is exact and case-sensitive: no splitting language tags, aliases, trimming,
lowercasing or unknown-language fallback. IDs such as ar-MSA are current application
variety identifiers, not a promise of provider-standard identifiers.

Preserve current `registry() -> Vec<Language>`, `language(id) -> Result<Language>`,
`validate_settings` and `defaults` public signatures. Registry/language simply project
resolved table values to the existing owned IPC structures. Settings resolve the
target, explanation and target-owned variety. Defaults use explicit default_variety_id;
they should also reject an invalid explanation-language ID rather than returning
invalid settings. That is a deliberate validation tightening to test, not a change
to any valid current default.

Partner/coach prompt construction currently consumes resolved target name/ID and
serialized conversation settings. Gloss prompt construction validates target and
explanation IDs and sends their IDs with exact source and boundary rows. Preserve
all those prompt bytes for valid inputs: no name substitution, overlay insertion,
schema change or prompt-version bump for this extraction. Romanization/direction
remain registry metadata, not a claim those tasks are implemented or measured.
Speech models/voices and other PracticeSettings defaults stay outside this table.

## Version capture in current turn context

Integration adds one required field for newly created partner and coach turns:

```json
{"languageConfigVersion":"language-config-v1"}
```

It sits beside existing targetLanguage, translationLanguage, settingsRevision and
templateVersion in `turns.context`; no table/schema migration or result rewrite.
Existing captured settings/prompt messages already carry selected variety context.
Do not reread current conversation preferences to resolve a pending operation.

Before preparing/dispatching any pending language-dependent child or explicit retry,
Integration checks that captured version equals the installed version, before network
submission/admission. Missing or unknown versions fail with a fixed configuration
error; do not silently assume v1 or regenerate under current settings. Saved messages
and accepted help remain readable without this dispatch gate. No backfill, data
conversion, automatic retry or compatibility layer is proposed. Integration should
explicitly account for existing pending unversioned turns in checkpoint/QA: these
cannot be claimed to retain dispatch eligibility after this gate is installed.

This equality gate is deliberately finite. It does not implement historical config
registries. A later requirement to resume operations under older config versions needs
its own contract. Existing in-flight source/authority/publication checks remain owned
by execution; the extracted table must not replace them.

## Validation and verification

Validate the compiled table once during native initialization, failing initialization
on malformed data rather than warning. Pure validation accepts an injected table in
tests; public registry projection then operates on the validated static configuration.
Reject empty/duplicate language IDs, blank names/endonyms, empty variety collections,
empty/duplicate variety IDs within a language, blank variety labels, empty scheme
strings, or a default variety absent from its language. Direction is a closed enum.
Do not impose a two-letter ID rule or require Latin-script languages to lack schemes.

Focused tests:

- Exact current five-entry registry projection, order, names, schemes and varieties.
- Exact valid PracticeSettings defaults for all five, including existing speech values.
- Bad config tables fail; unknown target/explanation IDs and cross-language varieties fail.
- Reordering a fixture's varieties does not change its explicit default selection.
- Existing partner/coach/gloss prompt inputs remain equal for valid configurations;
  existing Unicode/strict decoder tests still pass.
- Integration tests new turn version capture, missing/mismatched version rejection
  before any dispatch, valid same-version retry, and unaffected saved-result reads.

Relevant native tests, Clippy, formatting and generated-contract check complete the
source slice; no live evaluation is needed for a behavior-preserving extraction.

## Proposed exact future ownership

| Owner | Files / work |
| --- | --- |
| Language, only after assignment | src-tauri/src/languages.rs: typed table, resolver, projection, pure tests (keep tests local initially) |
| Integration | src-tauri/src/lib.rs: initialization validation; src-tauri/src/execution.rs: captured version and dispatch/retry gate plus lifecycle tests |
| AI Operations | Read-only review of unchanged common prompt/capability boundary |
| Interaction | No UI edits expected; existing generated Language contract unchanged |

No changes needed in linguistics/adapter.rs, its decoder/tests, model.rs, provider,
speech, database schema or frontend for the extraction itself. If Integration chooses
to expose version externally later, assign that separately rather than growing this
slice implicitly. Root owns DESIGN/BUILD-PLAN updates.

## Relationship to the active span issue

Extraction removes scattered per-language registry branches and makes the next
language addition reviewable. It does not improve model endpoint choice, repair
empty/reversed spans or increase gloss coverage. Those remain separate diagnostics,
prompt/quality work and source-validation tests. Prompt v3's one synthetic complete
result is not evidence for this proposal or for additional languages.
