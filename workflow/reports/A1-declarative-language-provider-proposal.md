# Declarative languages: AI Operations proposal

Proposal only. No source edits, model calls, installations or new evaluation authorization. Current Spanish/Arabic/French/Chinese coverage (plus English in the registry) is an initial set, not a product limit. Language owns linguistic fields and reference review; Integration decides the shared schema and implementation slice.

## Recommended separation

| Layer | What it declares | What it does not establish |
| --- | --- | --- |
| Language configuration | Stable internal identity, display names, varieties/writing systems, prompt-facing names, configured reading-assistance schemes | Model quality or provider support |
| Provider/task capability | Explicit endpoint/model task support, request/output schema, provider-specific language codes, supported voice/format | Correct meanings, pronunciation or dialect fidelity |
| Evaluation evidence | Observed outcomes for language/variety/script/task and exact model/runtime/prompt versions | Universal quality for all speakers, scripts or future model versions |

Avoid one global supported-language flag. Registration makes a language available to shared machinery; a missing speech capability must not imply text conversation is unsupported, nor may an accepted language name imply all reading-assistance operations work. Unknown quality stays unassessed. Availability decisions remain explicit and do not silently change models or routes.

## Shared prompt machinery

Resolve the immutable language/variety configuration and operation settings once, then render shared task templates. Configuration supplies bounded descriptive facts and selected conventions; it should not embed an entire separate chat/gloss prompt per language, executable code, credentials, URLs or pricing. Task templates retain source authority, nontranslation constraints where appropriate, output schemas and validation rules.

Use stable internal IDs independently of prompt-facing language names and provider API language codes. The current ar-MSA variety ID, for example, must not automatically become an ASR language parameter. Writing system and direction belong to the selected configuration, not an id==ar conditional. A new script/variety may use the same generic engine, but a genuinely new task contract still requires implementation.

Romanization, transliteration and pronunciation are distinct requested outputs with explicit schemes and source binding. A registry label such as PINYIN or ALA-LC is a selected convention, not proof that a given model implements it correctly. Preserve exact source spelling/diacritics and mixed-script text. Provider transcript comparison policy remains separate from linguistic annotation/source identity.

## Provider profile and evidence

Keep provider bindings in provider configuration, separate from language declarations. Each binding should identify:

- task: conversation, translation, word gloss, romanization/transliteration, pronunciation explanation, speech synthesis, or transcription;
- route and explicit model; provider-specific language/variety identifier when the API requires one;
- required response mode and limits; audio voice/format only for speech;
- known capability status and source/date of capability evidence;
- evaluated language/variety/writing system, prompt/schema/config versions, fixture revision and observed quality.

For local inference also record runtime/version, model file revision, quantization and context settings. Results from one runtime or quantization are not transferable measurements. Keep account access/quota availability separate from advertised endpoint capability. Never put live secrets into evidence records.

Speaker count is not a sufficient quality proxy. Coverage, training distribution, domain, orthography, dialect, code-switching and the specific task all matter. Schema-valid output is not a correctness score; successful speech transport is not pronunciation quality.

## Finite first slice

1. Extract the five current registry entries into one validated declarative schema with identical IDs, defaults and behavior. Do not simultaneously register dozens of languages or change providers.
2. Make existing shared prompt builders consume resolved labels/conventions. Keep source boundary generation and strict validators generic. Test identical source reconstruction, repeated occurrences, mixed scripts and invalid configuration rejection.
3. Add explicit per-task capability/evidence records initialized honestly from existing evidence; do not label untested tasks qualified. Store a few known synthetic observations rather than invent a broad rating system.
4. Add one further language configuration only after the schema is reviewed. Confirm that existing machinery requires no language-specific code for that addition; record any genuinely missing task implementation as a separate item.

An optional later, separately budgeted evaluation can start with a small fixed fixture set per new language: short dialogue, repeated word occurrences, a negation, numeric/punctuation distinctions, mixed-script input and a language-specific ambiguity reviewed by a competent speaker. Report every first-attempt failure and partial result, tokens/cost, and latency; one successful sample does not qualify the model. Deterministic source-contract violations must never be accepted. No paid run is authorized by this proposal.

## Current evidence limits

Current root languages.rs hardcodes five entries, direction via Arabic ID, optional scheme labels and default alloy voice. Existing adapter already validates registered IDs and uses generic grapheme-safe source boundaries. The immediate reading-assistance milestone should continue; adopting a declarative registry is a bounded follow-on implementation decision, not a prerequisite to finishing the current checkpoint. The recovered GCP/Python configuration sources have now been inspected directly; the findings below replace the earlier reference-availability gap. No reference code was executed or copied into active implementation.


## Recovered reference review

Reviewed the provenance in old/README.md and actual sources in both recovered snapshots: Python-only language_models.py, language_annotation_configs.py, full_text_transcript_translation_prompt.py and segement_word_level_translation_prompt.py; GCP UI language_configs.json and language_configs_annotation.json; GCP backend language_configs.py and annotation_configs.py, plus translation-subtask call sites. These are historical design evidence, not active requirements or verified runtime behavior.

**Ideas worth retaining:** The GCP registry supplies language names, codes and romanization methods as data, and generic translation tasks consume those records. A separate annotation configuration recognizes that script/font presentation is distinct from translation instructions. The Python-only model also makes a selected language/method pairing explicit. These directly support declarative registration and shared task templates.

**Concrete refinements for the proposal:**

- Use one canonical validated configuration source with generated/derived consumers. The GCP UI uses name-keyed JSON, the backend expects a language_configs.yaml that is absent from its recovered configuration directory, and the Python-only version uses uppercase enum identities. This is a drift risk, not a reason to reproduce multiple independent registries.
- Distinguish language, selected variety and writing system. Historical names combine Arabic with Levantine and Mandarin with Simplified. Keep their identities explicit and separately selectable where supported; a broad API code ar or zh does not encode those choices.
- Treat sample text and scheme labels as claims requiring review. The UI entry labeled Simplified Chinese contains traditional-form characters, and frontend background data includes sample_romanized_text while the displayed backend model does not declare that field. Declarative data is not automatically reliable just because it parses.
- Give schemes stable typed IDs and keep method instructions in a reviewed scheme registry. The Python enum combines an ID and long instructions in one string, while the UI stores short strings such as NONE, ALA_LC and PINYIN. Do not infer provider support or phonetic accuracy from either representation. Separate pronunciation transcription from transliteration/romanization.
- Keep fonts, color, pixel buffers and video placement out of model prompts and linguistic configuration. The earlier annotation model includes callable vertical placement and loads fonts in object construction; the GCP version also performs font checks at import time. Only relevant script/layout needs should inform the current UI domain. The active registry should be data that can be validated without executing renderers or touching runtime assets.
- Validate relationships without copying the historical loaders. The recovered GCP annotation loader constructs LanguageAnnotationConfig from both language_configs and annotation_configs, even though the displayed language records have different fields. This source inconsistency reinforces schema checks and canonical IDs; it is not an active application defect to fix here.
- Preserve source data separately from task instructions. Historical word alignment asks the model to do its best when it cannot find a match and uses nearest positional occurrences. Those are suggestions from a subtitle pipeline, not grounds to relax current exact source/occurrence validation or convert uncertainty into invented help. Shared machinery must retain explicit partial/unknown outcomes.
- Project only task-relevant fields into prompts. Family trees, sample passages and informational links may support browsing/help but need not be sent on every inference request. Avoid adding tokens or presenting sample facts as instructions merely because they share a configuration record.

These findings strengthen the finite extraction proposal rather than enlarging its implementation scope. Registration remains separate from per-task endpoint capability and versioned measured quality. For translation/gloss evidence, record the target and explanation/source-destination pair; UI localization is independent. Selected-variety rules take explicit precedence over base-language defaults, with conflicts rejected during resolution instead of combining contradictory overlays.
