## Hand-back: A · wave 2

Done:

- Authored `config/` YAML is the source of truth for five languages, scripts, orthographies, ordered traits, family metadata, named romanizations, universal scoped guidance, 47 constructs, presentation navigation, feedback policy, six localized starter cards and factual localized selection reasons. `config/README.md` documents local editing and validation.
- `src-tauri/src/config/{types,mod,validation,citations,seeds}.rs` implements strict typed loading and independently owned Registry values. Startup seeds compiled-in files only when the entire workspace-parent/config directory is absent. Existing missing/bad files are never repaired or replaced with defaults. Symlinks, unknown files/fields/scopes/references, dependency cycles, invalid metadata/policy, missing localization, duplicate YAML keys and bad citations fail with ConfigLoadError {path, code, message}.
- Language resolution: universal → ordered traits → orthography (language dependency) → language → variety, filtered by scope. Explanation-writing uses explanation language; other scopes use target language/variety. Optional scalar overrides inherit script settings and resolve through traits → language → variety, with leaf values winning. SHA-256 fingerprints cover canonical typed configuration and parsed bibliography metadata, then resolved context including language/variety/explanation and scalar values.
- Catalog projection fills skill label/description/criterion from canonical constructs; navigation skill entries cannot duplicate those fields. Every construct requires explicit navigation and unique parent-prefixed codes. Migrated IDs/criteria retained, plus ix.self_repair and the plan's initial ar.idafa form entry. Opportunities now describe natural conversation situations, not assessment commands. Both new entries remain needs_review.
- Candidate selection includes chosen focus with recursive prerequisites, due IDs and applicable function/interaction constructs without truncating mandatory coverage. Optional trait/literal-token candidates use band ±1 and the remaining soft cap. Starter selection excludes the latest three IDs and uses real focus/due/contact/general reasons, localized through YAML. Every language has label, preview and translation coverage.
- `schemas/*.json` generated with schemars from the loader types and checked for drift in ordinary tests. `src-tauri/Cargo.toml` adds serde_yaml_ng and schemars; root completed the dependency fetch and Cargo.lock update.
- `src-tauri/src/languages.rs` is now YAML-backed bundled helpers for standalone tools/tests. No duplicate authored language prose remains. B wired Store-owned Registry into live paths.
- `src-tauri/src/linguistics/adapter.rs` adds context-aware prompt/decode/completion entry points. They validate target/explanation identity against the captured context and use captured writing, romanization and segmentation guidance, allowing custom configured languages without consulting bundled defaults.

Exact API seam:

```rust
config::initialize(dir: &Path) -> config::Result<Registry>
Registry::bundled() -> config::Result<Registry>
Registry::load(dir: &Path) -> config::Result<Registry>
registry.resolve(language: &str, variety: Option<&str>, explanation: &str)
    -> config::Result<LanguageContext>
registry.hash() -> &str
registry.language(id: &str) -> model::Result<model::Language>
registry.language_projection() -> Vec<model::Language>
registry.defaults(language: &str, explanation: &str) -> model::Result<PracticeSettings>
registry.validate_settings(language: &str, settings: &PracticeSettings) -> model::Result<()>
registry.constructs() -> &[Construct]
registry.construct(id: &str) -> config::Result<&Construct>
registry.catalog() -> serde_json::Value
registry.feedback_policy() -> &FeedbackPolicy
registry.candidates(ctx: &LanguageContext, band: &str, focus: &[String],
    due: &[String], tokens: &[String]) -> config::Result<Vec<Construct>>
registry.starters(ctx: &LanguageContext, band: &str, focus: &[String],
    due: &[String], contact_tags: &[String], recent: &[String])
    -> config::Result<Vec<SelectedStarter>>
```

`LanguageContext` fields: language_id, variety_id, explanation_language_id, hash,
guidance map, script, direction, font_scale, word_spacing. `guidance(scope)` returns
ordered text. `SelectedStarter` contains starter and already-localized reason.
`recent` is newest-first. Full field definitions are in config/types.rs.

Adapter names append `with_context` and append `&LanguageContext` after the existing
arguments: build_word_gloss_prompt_with_context, decode_word_gloss_with_context,
validate_word_gloss_completion_with_context.

Verification:

- `cargo test --manifest-path src-tauri/Cargo.toml --lib config::`: 10 passed, including independent workspaces, bad YAML/citations/references/cycles/policy, scalar resolution, provenance edits, candidate requirements/bands, starter reason/history rules, captured custom-language gloss and schema drift.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib languages::`: 4 passed, including frozen Arabic guidance and bibliography guards.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib linguistics::adapter::tests`: 21 passed.
- A-owned Rust modules formatted. Clippy initially found one A collapsible-if (fixed) plus B's in-flight lint issues (relayed). Final combined verification belongs to integration; this report does not claim the entire running application is verified.

Learner agency: local rules are named, readable and editable. Invalid edits explain what failed rather than silently replacing the learner's changes. Exact evidence and captured contexts preserve what was actually assessed. Starter choices are immediate mechanical options alongside the live composer; reasons claim only the evidence used for selection. Rules do not turn the partner into an examiner or treat XP as proficiency.

Not done / why / limitations:

- Linguistic criteria, examples, opportunities and localized starter wording remain needs_review; no expert linguistic validation or live provider evaluation happened. Existing research keys support the design basis, not a claim that this content has been validated.
- The migrated catalog is largely functional. Its mandatory function/interaction candidates already exceed 25. This wave preserves them; it does not pretend to have achieved a 15–25 shortlist or silently discard mandatory criteria. Additional form inventories and finer candidate design need a focused content pass. Literal token hints are retrieval aids, not UD tagging; Arabic construct-state and courtesy hints supply bounded actual metadata.
- Due estimates, learner estimator/game YAML, generated coach opener cards, fluency and session-review machinery remain later-wave work. Production callers pass empty due lists until real due evidence exists.
- Current supported feedback mode, protection list and ladder are validated exactly; unimplemented policy variants fail explicitly. This is intentional bounded behavior, not arbitrary policy execution.
- Runtime initialization requires the workspace parent to exist; B owns workspace creation/ownership and startup error projection. Config changes load on restart, not hot reload. Existing configuration can need a deliberate development reset when required schema changes; there is no automatic upgrade or silent reset.

Paid inference: none. Actual data resets: none by A. Git writes: none. Unrelated .idea change untouched.

Contract drift: Registry ownership is per Store rather than a global process singleton, preventing different workspaces from silently sharing one config. The candidate API adds an explicit band argument. Scalar fields were added to captured contexts. RomanizationScheme is now an owned-string YAML type returned by bundled helper reference, rather than a duplicated static prose table. Orthography guidance occupies the language-dependency step in the published resolution order. All seams were relayed through integration.

Change requests: none outstanding for A APIs. Integration should retain the explicit candidate-count/content-review limitation in final docs and distinguish native fixture behavior from a running application.

Read vs inferred: Read the approved philosophical core/language/construct/coaching/start plans, wave-two brief/integration instructions, current catalog and assigned source files. Wave-one primary romanization findings are preserved exactly in YAML; no new romanization claims added. The new ar.idafa definition applies the already-cited Ryding basis and plan example as needs_review expert content. Dependency API verification used primary docs.rs documentation. No live learner data or private provider results were inspected.


Final integration follow-up: starter contact tags now normalize case and whitespace
before exact matching. Saved ` Music ` matches `music`; `Music criticism` does not.
This is exact label matching, not substring inference or semantic tagging. Added
`contact_starter_tags_normalize_case_and_whitespace_but_require_exact_meaning_label`
as a focused regression test.
