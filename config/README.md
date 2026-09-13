# SkellySpeak configuration

These YAML files are the authored source for languages, constructs, starter cards
and coaching policy. Rust embeds this seed for packaged application builds.
On first workspace initialization, the app creates `config/` beside the workspace
SQLite file only if that entire directory is absent. It also writes the current
root `references.bib` into that directory. Existing configuration is validated;
missing or malformed files stop workspace startup with a path and error. The app
never replaces an existing directory with bundled defaults.

Edit the workspace copy and restart to load changes. Each workspace owns its
registry; changing one workspace cannot silently alter another. A turn captures
its resolved language context and configuration hash. Hashes use canonical typed
content plus parsed bibliography fields, so whitespace changes alone do not change
the hash. Changing a rule, example, source claim or review status does.

## Files

- `languages/`: scripts, orthographies, named romanization schemes, ordered traits,
  family metadata, universal rules and per-language varieties. Rules resolve by
  scope: universal, ordered traits, orthography, language, variety. The orthography
  is a language-level dependency. Optional `scalars` on traits, languages and
  varieties inherit script defaults; a later `direction`, `font_scale` or
  `word_spacing` value wins. Explanation-writing rules use the explanation
  language's default variety; other scopes use the selected target variety.
- `constructs/`: stable construct identities, criteria, natural conversation
  opportunities, prerequisites, band/lens/applicability and citation metadata.
  `navigation.yaml` owns presentation hierarchy/code/color. Skill label,
  description and criterion there must stay empty: the projection fills them from
  canonical construct definitions. New constructs need explicit navigation nodes.
- `policy/feedback.yaml`: the supported correction policy. Unknown policy modes,
  moves, intensities and missing learner-agency protections fail validation.
- `starters/`: localized labels, target previews, equivalent translations and
  selection metadata. `reasons.yaml` contains factual localized reason labels.
  A starter is selected from focus/due, contact interests and a general topic;
  the most recent three explicit starter selections are excluded. The caller
  supplies actual due IDs; this wave does not invent due estimates.

All linguistic content is `needs_review`. Marking content `reviewed` while its
citations remain `abstract` fails. Structural validation and prompt fixtures do
not establish expert linguistic review or provider quality.

JSON schemas under `schemas/` derive from the loader's strict Rust types. The
loader additionally checks references, cycles, localization coverage, citation
metadata and supported policy semantics. `cargo test --manifest-path
src-tauri/Cargo.toml --lib config::` verifies them. To intentionally regenerate
schema files after changing types, run the `export_schemas` test with
`SKELLY_WRITE_CONFIG_SCHEMAS=1`; ordinary tests check for drift without writing.

Candidate selection preserves focus and its prerequisites, due IDs, and every
applicable function/interaction construct. The current migrated catalog has more
than 25 mandatory candidates; it is retained without truncation. Optional literal
token/trait matches within one neighboring band fill remaining room up to 25.
Literal hints are retrieval aids, not UD parsing. The existing catalog mostly
contains functional criteria; the Arabic iḍāfa entry supplies one initial form
criterion for focused review. Estimator/game policy and richer per-language form
content belong to later waves.
