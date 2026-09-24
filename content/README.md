# Content

This folder holds authored language definitions, shared teaching rules and prompts,
together with generated validation schemas. Structured content and schemas use YAML; this
guide uses Markdown. The sections
below follow the **same folder names and order as the files on disk**.

```text
content/
├── languages/         One YAML file per language, including its varieties
├── prompts/           Authored instructions grouped by feature
│   ├── conversation/
│   └── drill/
├── schemas/           Generated schemas stored as YAML
├── shared/            Definitions and policies used across languages
└── README.md          This guide
```

Go to [languages](#languages), [prompts](#prompts), [schemas](#schemas), or
[shared](#shared).
[Working with these files](#working-with-these-files) covers editing and checks.

These are app-owned sources, not learner preferences, credentials or workspace
data. Rebuilding incorporates source changes into the app; editing a file does
not update an already running build.

## languages/

**Purpose:** describe each language and its connected varieties. Each
`<language>.yaml` owns its identity, integrations, local writing definitions,
defaults, variety settings, guidance, learning hints and default partner.

Start with [Spanish](languages/spanish.yaml) or [Arabic](languages/arabic.yaml).
[Hindi](languages/hindi.yaml) and [Malayalam](languages/malayalam.yaml) illustrate
Indic writing and local transliteration definitions.

### Inside a language file

| Field | What belongs here |
| --- | --- |
| `identity` | Language ID, display names, family and review status |
| `integrations` | External language tags and service mappings |
| `definitions` | Language-owned orthographies and romanization schemes |
| `defaults` | Default variety, writing choices, scalars and optional speech preferences |
| `traits` | References to shared language traits |
| `varieties` | Related variety identities, guidance and explicit overrides |
| `guidance` | Language-wide instructions |
| `learning.goal_material` | Lexical hints associated with universal skills |
| `conversation` | Greeting and `default_partner` definition |

### Identities, references and inheritance

- Use readable lowercase identifiers such as `spanish` and `spanish-mexico`.
  IDs are not browser locales. `integrations` optionally supplies standard tags
  and transcription mappings. Speech routing uses the canonical `language_tag`;
  the older `transcription` mapping does not control current model selection.
- `definitions` owns local orthographies and romanization schemes. References
  explicitly use `{local: name}` or `{shared: name}`. Local names are scoped to
  their language. Shared definitions have exactly one owner in the foundations
  document. Missing references and duplicate keys fail; no file-order precedence,
  cross-language imports, deep merging or automatic conflict resolution exists.
- Variety display names identify the region or register without repeating the
  parent language name (for example Arabic → Levantine / Modern Standard).
  Keep the full language-qualified IDs unchanged.
- Defaults select an orthography and romanization. Supported schemes are an
  explicit list; the default must belong to that list. A variety inherits defaults
  unless it supplies an override. `{mode: disabled}` explicitly disables
  romanization; `{mode: scheme, scheme: {local: name}}` selects a complete scheme.
  Learner scheme selection is not implemented in this pass.
- Shared scripts provide scalar defaults. Language `defaults.scalars` and then
  variety `overrides.scalars` override individual values. `font_scale` remains
  independent of learner reading size and must be finite, between 0.5 and 3.0.
  The language browser lets learners override script size per language (50–300%).
  These overrides are stored in learner preferences; Default restores the selected
  variety’s configured scale without modifying the bundled YAML.
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

Speech preferences use the shared capability catalog described under
[shared/speech-routing.yaml](#speech-routingyaml).

### Adding a learning language

Author identity, an explicitly scoped default variety, orthography, reading scheme
(or explicit disabled state), and a default partner.
Add shared script/family facts only when absent. New language files are discovered
by both the build bundler and repository loader; no hardcoded language list or UI
translation is required. Verify every supported target/explanation pairing.
A valid language identity does not guarantee speech-model support. The shared
capability catalog supports Irish through Scribe and Eleven v3; its current
models do not declare Scottish Gaelic support.
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

### Interface language is separate

UI translations remain under `ui/src/domain/localization/locales/` and do not
need to exist for every learning language. The learner chooses an interface
locale independently. Interface number/date formatting uses explicit external
locale mappings; proper language names can come directly from content.
## prompts/

**Purpose:** hold authored AI instructions, grouped by the feature that uses them.
Language facts stay in `languages/` and reusable policies stay in `shared/`.

### conversation/

[instructions.yaml](prompts/conversation/instructions.yaml) contains the
conversation's base instructions, interaction and persona guidance, examples,
opening angles, and five difficulty instructions.

The native composer adds the selected language and variety, optional persona,
topic and time reference. Preview and execution use that same composer. Shared
relationship behavior and difficulty instructions are written in English for all
target languages; resolved language and writing guidance determine the response
language. The shared behavior layer is not translated into per-language prompts.

### drill/

[instructions.yaml](prompts/drill/instructions.yaml) contains the instructions
for generating spoken-practice candidates. It separates requested length from
difficulty, uses the supplied language and variety, and describes candidate
output and labeling requirements. This file is a YAML text block, rather than the
structured conversation-prompt mapping.

Other prompt assembly and execution still live with their code owners; see
[code connections](#code-connections) below.

## schemas/

**Purpose:** describe the shapes accepted by the current authoring models.
**These files are generated; do not edit them by hand.** They use JSON Schema
rules expressed in YAML. In the workbench, **Schema shape** shows an illustrative
instance with its keys, types and required/optional fields.

| Schema | Describes |
| --- | --- |
| [language.yaml](schemas/language.yaml) | Files in `languages/` |
| [conversation-prompt.yaml](schemas/conversation-prompt.yaml) | `prompts/conversation/instructions.yaml` |
| [language-foundations.yaml](schemas/language-foundations.yaml) | `shared/language-foundations.yaml` |
| [conversation-topics.yaml](schemas/conversation-topics.yaml) | `shared/conversation-topics.yaml` |
| [learning-goals.yaml](schemas/learning-goals.yaml) | `shared/learning-goals.yaml` |
| [learning-map.yaml](schemas/learning-map.yaml) | `shared/learning-map.yaml` |
| [speech-routing.yaml](schemas/speech-routing.yaml) | `shared/speech-routing.yaml` |
| [teaching-policy.yaml](schemas/teaching-policy.yaml) | `shared/teaching-policy.yaml` |
| [teaching-guides.yaml](schemas/teaching-guides.yaml) | Preliminary guide model; see the draft status below |

Generated schemas describe document shapes, identities and closed enum fields.
Native semantic validation additionally checks cross-document relationships,
numeric bounds, citation review, policy protections and coverage. Unknown fields,
malformed values, duplicate YAML keys, missing references, invalid policy semantics
and unsupported schema versions fail validation. A schema pass is not a review of
linguistic accuracy.

**Teaching-guide status:** the guide schema and initial loader code were created
prematurely during design discussion. They do not establish an approved content
contract. There is currently no `content/guides/` folder. The readable pilot and
proposed language-core/variety structure remain in the
[planning notes](../docs/notes/language-guides-and-xp/README.md); app integration is
deferred. Do not infer a settled folder structure from that preliminary schema.

## shared/

**Purpose:** keep reusable definitions and policies in one place, referenced by
languages and feature prompts.

| File | What it owns |
| --- | --- |
| [conversation-topics.yaml](shared/conversation-topics.yaml) | Topic identities, localized interface labels and language-independent subjects |
| [language-foundations.yaml](shared/language-foundations.yaml) | Scripts, families, traits and explicitly shared writing definitions |
| [learning-goals.yaml](shared/learning-goals.yaml) | The 45 universal skills: criteria, prerequisites and opportunities |
| [learning-map.yaml](shared/learning-map.yaml) | Navigation hierarchy, display codes and colors; skill text comes from its goal |
| [speech-routing.yaml](shared/speech-routing.yaml) | Provider/model capabilities, language-code mappings and ordered speech alternatives |
| [teaching-policy.yaml](shared/teaching-policy.yaml) | General guidance, feedback, learner estimation and reward policy |

### Shared language behavior

Follow the repository's
[language-independent behavior rule](../AGENTS.md#language-independent-behavior).
Solve general behavior with Unicode properties, shared algorithms and declared
capabilities. Language-specific processing branches and hand-maintained character
lists are not substitutes for a shared policy. A declarative language override is
a last resort requiring evidence and review. Preserve source text; normalization
belongs only to the operation that requires it.

Topics are available across languages, varieties and difficulties. They describe
subject matter, not prewritten dialogue. Topic labels follow the interface
locale; the selected variety informs language instructions. Adding a language
does not require a separate topic pack.

### speech-routing.yaml

`shared/speech-routing.yaml` is the authored source for provider/model capabilities,
provider language-code mappings, and ordered alternatives for `transcription` and
`speech`. These are independent tasks. Model support is a declared capability,
not a claim about recognition quality or pronunciation accuracy.

Languages need no speech configuration. `defaults.speech_routes` optionally contains
`transcription` and/or `speech` lists of preferred model IDs. A variety may supply
`overrides.speech_routes`; each present task replaces that task's language list,
while omitted tasks inherit. Preferences must be nonempty lists of distinct,
declared models for the appropriate task. Unknown references fail content loading.
Use a preference only for a justified language/variety need, documented in notes;
Irish needs none because the shared capability policy already selects Scribe.

Resolution order is the effective language/variety preference list, the learner's
saved global model default, then the shared task alternatives. Incompatible models
are skipped. Recording also filters against the selected service's configured model
inventory before opening the microphone. No compatible model or missing service
configuration produces an explicit error. Access route, endpoint and credentials
are independent of model selection. A custom unrecognized model retains explicit
forwarding and is marked `custom_model_unverified`, not claimed as supported.

The Rust resolver captures the selected model, provider, language code, global
default and decision reason. Adapters validate this choice without replacing it.
`npm run contracts` generates the server capability data from this source;
`contracts:check` detects stale output. Add a provider adapter and its availability
checks before advertising a new model. Current synthesis has one adapter/model,
ElevenLabs Eleven v3; the resolver does not imply that another synthesis provider
has been implemented. Provider voice selection remains service-owned.

## Working with these files

### Read and edit

Run the standalone [content workbench](../tools/content-workbench/README.md):

```sh
npm run content:workbench
```

Its folder tree mirrors this directory. Use Read, Tree or source view to inspect
files, follow references and edit authored content. Save checks YAML/JSON syntax
and refuses to overwrite external edits; it does not run application-semantic or
linguistic validation. VS Code remains an alternative for editing the same files.

### Sources and review

- Bibliography `review` fields accept only `abstract`, `full-text`, or `reviewed`.
  Put explanatory review prose in `note`, and the supported claim in `claim`.
  Startup validates the entire bibliography, including exploration-only entries.
- Root `references.bib` remains authoritative. Existing linguistic material is
  `needs_review`; schema validation does not establish linguistic correctness.
  Conflicting prose under different identities still requires human review.

### Inspect the running app

In the app, choose **Browse languages** beside the compact selector or in **More**.
Browsing is read-only. **Use this language and variety** explicitly saves a choice.
The browser uses the app’s native-language setting for explanation context. Its
teaching sections remain visible as a structured document, with a source viewer
for YAML, schemas and resolved models. The main document shows language-owned guidance and goals, supported
romanization examples, shared topic subjects and the default partner. Shared teaching policy
and complete assembled instructions remain in the source/model viewer, alongside
resolved model, validation schema and the running build's content fingerprint.

### Check repository content

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

### Code connections

These are implementation references, not additional content folders.

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
