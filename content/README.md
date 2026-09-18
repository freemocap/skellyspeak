# Language content

These are app-owned teaching definitions bundled into each build. They are not
learner preferences, API keys or workspace data. Editing this directory and
rebuilding updates the app's content; no workspace configuration copy is created.

## Ownership

| Document | Owns |
| --- | --- |
| `languages/<full-name>.yaml` | Identity, varieties, integrations, local writing/romanization definitions, instructions, script scale, learning material and default partner |
| `shared/language-foundations.yaml` | Shared script facts, family metadata, trait identities and explicitly shared definitions |
| `shared/learning-goals.yaml` | Shared skill identities, criteria, prerequisites and opportunities |
| `shared/learning-map.yaml` | Navigation hierarchy, display codes and colors; skill text is projected from its goal |
| `shared/teaching-policy.yaml` | General guidance, feedback, learner estimation and reward policy |
| `shared/conversation-topics.yaml` | Topic identities, localized interface labels and language-independent subjects |
| `prompts/conversation/instructions.yaml` | Authored conversation prose, all five difficulty instructions, persona and time-reference guidance |
| `schemas/` | Generated JSON schemas for the exact Rust authoring models |

Start with [Arabic](languages/arabic.yaml) or [Spanish](languages/spanish.yaml).
[Hindi](languages/hindi.yaml) and [Malayalam](languages/malayalam.yaml) demonstrate
Indic scripts with local writing and orthographic transliteration definitions.
Each YAML includes an editor schema association. Rust authoring models live in
[native/src/configuration/documents.rs](../native/src/configuration/documents.rs);
loading, linking, resolution and inspection have separate modules there.

## Authoring contract

- Use readable lowercase identifiers such as `spanish` and `spanish-mexico`.
  IDs are not browser locales. `integrations` optionally supplies standard tags
  and transcription mappings. Missing mappings do not invalidate a language. Microphone transcription remains
  available without a code, with a model/language warning; the request omits the
  language field and retains native-language context.
- `definitions` owns local orthographies and romanization schemes. References
  explicitly use `{local: name}` or `{shared: name}`. Local names are scoped to
  their language. Shared definitions have exactly one owner in the foundations
  document. Missing references and duplicate keys fail; no file-order precedence,
  cross-language imports, deep merging or automatic conflict resolution exists.
- Defaults select an orthography and romanization. Supported schemes are an
  explicit list; the default must belong to that list. A variety inherits defaults
  unless it supplies an override. `{mode: disabled}` explicitly disables
  romanization; `{mode: scheme, scheme: {local: name}}` selects a complete scheme.
  Learner scheme selection is not implemented in this pass.
- Shared scripts provide scalar defaults. Language `defaults.scalars` and then
  variety `overrides.scalars` override individual values. `font_scale` remains
  independent of learner reading size and must be finite, between 0.5 and 3.0.
- Guidance resolves in this order: generated variety identity, generated variety
  assessment rule where relevant, shared teaching guidance, selected orthography,
  language, variety, selected romanization instructions. Explanation-writing
  guidance uses the independently selected explanation language and variety.
- `learning.goal_material` attaches language-specific lexical hints to shared
  goals. Entries may be words or multiword phrases; they match contiguous Unicode
  words in a derived, case-insensitive NFC view with punctuation boundaries.
  Do not copy a multilingual list into every language. Optional matches have a
  separate allowance of 25 beyond required goals.
  These hints are not a curriculum, tokenizer, or evidence of proficiency.
- Topics are available for every language, variety and difficulty. They contain
  subject matter, not prewritten dialogue. Labels use the interface locale;
  dialect affects language instructions only. New languages need no topic pack.
- Root `references.bib` remains authoritative. Existing linguistic material is
  `needs_review`; schema validation does not establish linguistic correctness.
  Conflicting prose under different identities still requires human review.

Unknown fields, malformed values, duplicate YAML keys, missing references,
invalid policy semantics and unsupported schema versions fail. Generated JSON
schemas describe document shapes, typed identities and closed enum fields;
Rust semantic validation additionally checks cross-document relationships,
numeric bounds, citation review, policy protections and coverage.

UI translations remain under `ui/src/domain/localization/locales/` and do not
need to exist for every learning language. The learner chooses an interface
locale independently. Interface number/date formatting uses explicit external
locale mappings; proper language names can come directly from content.

## Adding a learning language

Author identity, an explicitly scoped default variety, orthography, reading scheme
(or explicit disabled state), and a default partner.
Add shared script/family facts only when absent. New language files are discovered
by both the build bundler and repository loader; no hardcoded language list or UI
translation is required. Verify every supported target/explanation pairing.
A transcription tag is a request mapping, not proof of model quality. Italian has
a Whisper mapping; Irish and Scottish Gaelic keep correct ISO language identities
but omit the unsupported model code and show a warning while allowing recording.
See the [addition and phrase-matching audit](../docs/notes/italian-irish-scottish-gaelic-2026-09-17.md).

Preserve source text exactly: native gloss spans use Unicode grapheme boundaries,
then convert to UTF-16 for the UI. Arabic, Devanagari and Malayalam annotation
presentation keeps the whole source word in one shaping run, even when saved
semantic anchors are smaller. This presentation protection uses Unicode script
detection, including mixed-script passages; new shaping scripts need renderer
coverage as well as YAML metadata. Device fonts supply Indic glyphs. Script scale
stays at 1.0 until visual review justifies a language-specific override.

ALA-LC Hindi and Malayalam are spelling-based reading aids, not phonetic
transcriptions. Pronunciation remains a separate output. Speaker review of
generated conversation language, romanization quality and device rendering is still required.

## Inspection and checks

In the app, choose **Browse languages** beside the compact selector or in **More**.
Browsing is read-only. **Use this language and variety** explicitly saves a choice.
The browser uses the app’s native-language setting for explanation context. Its
teaching sections remain visible as a structured document, with a source viewer
for YAML, schemas and resolved models. The main document shows language-owned guidance and goals, supported
romanization examples, shared topic subjects and the default partner. Shared teaching policy
and complete assembled instructions remain in the source/model viewer, alongside
resolved model, validation schema and the running build's content fingerprint.

Repository inspection uses the same loader without opening a workspace:

```sh
cargo run --manifest-path native/Cargo.toml --bin inspect-content -- --check
cargo run --manifest-path native/Cargo.toml --bin inspect-content -- arabic arabic-levantine english english-united-states
npm run languages:check
npm run contracts:check
```

After changing authoring models, regenerate schemas with
`SKELLY_WRITE_CONFIG_SCHEMAS=1 cargo test --manifest-path native/Cargo.toml --lib configuration::tests::export_schemas`.
Ordinary tests check schema drift without writing. Generate UI contracts with
`npm run contracts`; never edit generated outputs by hand.

The development database schema is 22. Older databases require explicit reset;
there is no ID migration or silent data deletion. Obsolete workspace `config/`
files are neither loaded nor included in current workspace exports.

## AI behavior still implemented in code

Conversation prose is authored in `prompts/conversation/instructions.yaml`; its pure native composer supplies selected language, optional persona, topic, time reference and named difficulty. Preview and execution use that same composer. Other feature prompts keep their existing owners.

| Responsibility | Current owner |
| --- | --- |
| Conversation instructions | [conversation_prompt.rs](../native/src/conversations/conversation_prompt.rs) |
| Persona generation instructions | [persona_prompt.rs](../native/src/partners/persona/persona_prompt.rs) |
| Coaching requests, evidence and deterministic help policy | [coaching.rs](../native/src/learning/coaching/mod.rs), [coach_observation.rs](../native/src/learning/coaching/coach_observation.rs), [coach_policy.rs](../native/src/learning/coaching/coach_policy.rs) |
| Turn capture, dispatch and result publication | [execution/](../native/src/conversations/execution/), [turn_plan.rs](../native/src/conversations/turn_plan.rs) |
| Native access and model selection | [access.rs](../native/src/ai/connections/access.rs), [model_routing.rs](../native/src/ai/connections/model_routing.rs) |
| Hosted model routing | [server/app/inference/model_routing.py](../server/app/inference/model_routing.py) |
| Configuration types and validation | [native/src/configuration/](../native/src/configuration/) |
| Research citations | [references.bib](../references.bib) |
