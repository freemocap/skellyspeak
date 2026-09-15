# Language expansion — bounded design recommendation

Proposal only. No runtime/configuration changes, paid calls or Git writes. This
does not block the current checkpoint or claim additional supported languages.

## Intent and current evidence

Spanish, Arabic, French and Chinese are starting coverage; the current registry also
includes English. Additional languages should use declarative configuration and the
same analysis, source mapping, validation, execution and reading machinery. Registry
membership must not imply demonstrated quality for every language pair or speech task.

Inspected current `src-tauri/src/languages.rs`, language adapter/core and deprecated
`old/skellyspeak-app/src-tauri/src/languages.rs` plus `prompts/overlays.rs` for this
specific design question. Integration subsequently recovered the GCP and Python-only snapshots. Their actual
configuration and prompt files have now been inspected read-only; see the recovered
reference review below. The earlier missing-reference limitation is resolved.

## Proposed minimum configuration

| Concern | Finite declarative content | Boundary |
| --- | --- | --- |
| Identity | Stable application language ID, display name, endonym, config version | Do not assume every language has a two-letter code or derive provider codes by splitting IDs |
| Variety | Explicit variety IDs and labels, one deliberate default | Region, dialect, register and writing system are not interchangeable |
| Writing | Supported orthography/script choices and default direction for those choices | Mixed-script text stays exact; a language-wide RTL flag is not a text transformation |
| Reading guidance | Short reviewed guidance on word grouping, clitics, punctuation, forms and usage where applicable | No per-language decoder or whitespace tokenizer; guidance does not establish correctness |
| Romanization | Optional named scheme identifiers and applicable writing/variety scope | Absence means unspecified/unavailable, not proof romanization is unnecessary |
| Task overlays | Bounded trusted additions to shared task templates, with explicit variety/orthography precedence | No executable config or user-supplied text promoted into trusted system instructions |

The configuration must preserve the captured target and explanation language roles.
Speech/transcription provider codes belong to separate task/provider mappings, not
the canonical language identity. UI localization is another capability; allowing a
language as an explanation language does not assert a translated application UI.

The storage format (Rust data, JSON, etc.) is not the first decision. First accept
the fields, ownership and behavior; implementation can choose one typed validated
representation and expose it through existing native contracts without duplicate
frontend language tables.

## Shared machinery stays shared

Every language uses the same immutable source identity, pinned Unicode grapheme
policy, explicit start/end catalog, strict output decoder and source-span validator.
Word grouping remains a linguistic decision. Script/spacing guidance must not turn
character clusters or whitespace runs into universal words. Future word details
should permit task-relevant grammatical properties rather than forcing tense,
gender or inflection fields onto every language or treating their absence as failure.

Capture the selected configuration/version in request provenance so later edits do
not silently reinterpret saved help. Reopening saved results remains read-only and
does not trigger regeneration after a configuration update.

## Reference ideas to adopt or avoid

Adopt one authoritative language registry, shared prompts using resolved names,
explicit romanization schemes, and checks ensuring configured guidance references
resolve. Evaluate these principles intentionally; copy no reference implementation.

Avoid the reference's claims that all pairs are supported merely by construction;
its silent unknown-language defaults (`word_delimited=true`, `inflects=true`); and
its coarse Boolean grammar classification as a switch for whole explanation types.
Unknown configuration must fail explicitly. Guidance can be deliberately absent,
but that is not a silent fallback for a broken reference.

Avoid conflicting variety instructions: the reference base Spanish overlay insists
on Spain usage while also appending a selected-variety line; Arabic similarly embeds
Levantine instructions. Resolve variety once and apply precedence explicitly. Do not
blindly transplant those defaults into the current Arabic MSA starting configuration.

## Admission and evidence, coordinated with AI Operations

Keep three distinct records: configured language facts; documented task/endpoint
capability; measured results for a specific model, route, task, language/variety,
explanation language and prompt/config version. Speaker population is not a measured
quality result. Neither success on Spanish nor a valid JSON response qualifies an
unmeasured language or pronunciation task.

For a future addition, require finite config validation and synthetic fixtures for
its actual writing/reading cases: repeated occurrences, combining text, mixed scripts,
punctuation, selected variety, unknown-ID rejection and exact source reconstruction.
Shared tests cover existing languages too. Model evaluation should separately assess
source alignment, word grouping, contextual meanings and explanation language. Speech
needs separate evidence; transcript equality alone does not validate pronunciation.
Any paid evaluation remains a separately authorized finite run, not this proposal.

## Next finite decision

Integration can adopt the separation and minimum fields without expanding the current
language list or delaying reading assistance. The recovered references inform the design without becoming specifications. The next contract review should cover how a selected variety/orthography
and configuration version enter the existing captured context, plus which richer
word-detail fields are optional/applicable. Do not build a general plugin framework,
new scheduler or per-language pipeline to answer these questions.

## Joint recommendation with AI Operations

AI Operations reviewed the complementary capability/evidence boundary and agrees:
avoid one global `supported language` Boolean. Registration, endpoint task capability
and measured language/variety/script/task quality remain distinct. Use explicit
provider-specific identifier mappings. Synthesis, ASR and romanization require
separate capabilities/evidence. For local models, record model revision, quantization,
runtime and context settings alongside prompt/schema versions; configuring a language
does not establish capability or quality.

The finite implementation follow-up, if assigned, is extracting the existing five
registry entries into the accepted typed configuration with unchanged defaults and
pure contract tests—not mass language expansion or a model benchmark. No storage
format or new provider policy is approved by this report.

Companion: [AI Operations proposal](A1-declarative-language-provider-proposal.md).
Its final review additionally distinguishes advertised endpoint capability from
actual account/route availability. Evidence must include the explanation language
or source/destination pair where applicable and configuration revision, so changing
configuration cannot inherit stale qualification. Resolve contradictory base/variety
guidance as an error rather than concatenating conflicting instructions.

## Recovered GCP and Python reference review

Recovery provenance is recorded in [old/README.md](../../old/README.md): Python-only
snapshot fe6e692 (January 2025), GCP/UI archive ad49645 (August 2026). Only individual
files were read and JSON data parsed; no reference modules were imported or executed.

Inspected artifacts:

- [GCP language data](../../old/skellysubs-gcp-ui/skellysubs-ui/src/language_configs.json)
  and [annotation data](../../old/skellysubs-gcp-ui/skellysubs-ui/src/language_configs_annotation.json).
- [Python configuration model/loader](../../old/skellysubs-gcp-ui/skellysubs/core/translation/language_configs/language_configs.py),
  [annotation model/loader](../../old/skellysubs-gcp-ui/skellysubs/core/translation/language_configs/annotation_configs.py),
  and [frontend schema](../../old/skellysubs-gcp-ui/skellysubs-ui/src/store/slices/translation-config/languageConfigSchemas.ts).
- [Earlier language/scheme models](../../old/skellysubs-python-only/skellysubs/translate_transcript_pipeline/models/language_models.py),
  [subtitle rendering configuration](../../old/skellysubs-python-only/skellysubs/add_subtitles_to_video_pipeline/video_annotator/language_annotation_configs.py),
  [shared translation prompt](../../old/skellysubs-python-only/skellysubs/add_subtitles_to_video_pipeline/full_text_transcript_translation_prompt.py)
  and [word-alignment prompt](../../old/skellysubs-python-only/skellysubs/add_subtitles_to_video_pipeline/segement_word_level_translation_prompt.py).

**What the actual references support.** The GCP JSON has 78 language records with
names, codes, scheme strings and background/sample metadata. The earlier Python
implementation passes language/scheme values into shared translation templates.
These are concrete precedents for data-driven expansion, not 78 bespoke pipelines.
Named schemes and readable examples are useful review inputs. They are not verified
model capability, accuracy or authoritative linguistic facts merely by being present.

**Keep annotation rendering separate.** The GCP annotation JSON has six entries,
containing fonts, colors, buffers and size ratios. The earlier Python version also
contains video-position callables and constructs fonts. These are subtitle renderer
concerns, not source-linked word annotations. Do not make an RGB value, image font,
video coordinate or font-loading side effect a prerequisite for registering a
language in SkellySpeak. Script/font coverage deserves presentation QA separately.

**Strengthen contracts rather than importing permissiveness.** The frontend schema
permits missing codes/schemes/background while the Python language model requires
several of these values; the Python annotation loader even constructs annotation
models from language records. These snapshots are not interchangeable schemas.
Use one native-owned typed contract and explicit cross-reference tests. A scheme
identifier should be separate from the explanatory prompt prose: the older enum
stores complete instructions as enum values and includes IPA under romanization.
Keep pronunciation transcription, romanization and original orthography distinct.
Avoid a string such as `NONE` as a substitute for explicit absence/status semantics.

**Examples need review.** The record named Mandarin Simplified contains sample text
with characters such as `視`, `麗` and `風`; this illustrates why examples must be
checked against the selected orthography rather than becoming unquestioned fixtures.
Background family trees and reference links can remain optional editorial metadata;
they should not expand every model prompt or become admission requirements.

**Do not transplant subtitle alignment semantics.** The Python word-matching prompt
allows one target word to match several source words and asks for a best-effort match
when no match exists, with relative-index guidance for repeated words. That serves a
different cross-language subtitle alignment task. Current glosses attach to exact
occurrences in one immutable passage, preserve unresolved gaps and reject invalid
overlaps. Preserve those rules; future cross-language alignment needs a separate
reviewed relation contract, not a relaxation of the word-gloss validator.

The recovered evidence reinforces the joint proposal and resolves the reference gap.
It does not justify copying the catalog wholesale or enrolling all 78 entries as
tested languages. The finite next step remains the existing-five configuration
extraction when assigned, with one later deliberately reviewed addition and separate
task/route quality evidence. No active implementation changed during this review.
