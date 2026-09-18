# Topic and language-variety architecture audit

Status: source audit and targeted verification, 2026-09-18. No runtime implementation changes. The working tree contains concurrent unrelated changes; findings describe the source inspected during this audit, not a released build.

Follow-up: [conversation prompt streamlining proposal](conversation-prompt-streamlining-proposal-2026-09-18.md). The user's subsequent direction removes lesson generation entirely; the proposal supersedes recommendations below that would retain and simplify lesson generation. The audit remains a record of the inspected architecture.

## Intended behavior clarified by the user

Topics are conversation instructions, not prerecorded dialogue or dialect-specific curriculum. Selecting a topic supplies an instruction to start a conversation about it. Without a topic, the partner starts a conversation. Language variety modifies language instructions; it must not decide whether a topic exists or can be selected. This clarification takes precedence over conflicting older design text.

## Findings

### 1. Topic availability incorrectly depends on sample-phrase coverage

`native/src/configuration/documents.rs` combines label, preview, translation and supported varieties in `StarterText`. `linking.rs` copies that coverage into `Starter.compatible_varieties`. `Registry::starters` in `mod.rs` requires both the target variety and explanation variety to appear in those lists, before ranking topics by focus, interests and general suitability. Difficulty and the last three topic selections are additional filters.

Arabic defaults to Levantine, while every Arabic starter lists only Modern Standard Arabic. The resulting empty list makes `ui/src/features/conversation/session/ConversationStart.tsx` omit the entire topic section. This also removes suggestions for other target languages when the explanation variety is Levantine Arabic. All six shared topics support every difficulty band, including PreA1; absolute-zero difficulty is not the cause.

The UI displays only label and selection reason, not the preview or translation. Native `openers.rs` nevertheless retrieves those sample fields, checks their presence at absolute-zero difficulty, and returns them in `StarterCard`. Configuration validation requires authored previews/translations. This is an unnecessary dependency between selectable intent and example content.

`configuration/language_audit_tests.rs` explicitly expects zero cards for either Levantine target or explanation variety. `content/README.md` explicitly describes this coverage restriction. It is an encoded architecture mismatch, not a missing accidental YAML entry. The earlier suggestion to add Levantine sample content would treat the symptom while preserving the wrong dependency.

### 2. Conversation generation already uses instructions

Actual path:

1. UI submits `Opening::Starter { starter_id }`.
2. `conversations/openers.rs::accept` validates the selection against current choices and extracts only `partner_brief` from the selected starter.
3. `execution/turns.rs::accept_opening` captures the conversation settings, resolved language context and persona instructions. The brief is an API user-role instruction following the system prompt; it is not inserted as a learner message in the conversation database.
4. A `persona_opening` operation generates the actual partner message. Authored preview/translation text is not used as that message or supplied as an opening example.

Example: the food brief says to act as a café server, greet the learner and ask what they want. Thus some topics also prescribe a situation/role, beyond a bare subject. `opener_kind` is authored and validated but does not select a separate opening execution mechanism.

The no-topic button submits `Opening::Surprise`. Its hardcoded prompt tells the partner to choose from its background/interests and **conceal the topic until asked**, making topic discovery a task. This matches older coaching-plan text but exceeds the user's clarified generic-start behavior. `Opening::Described` supports a custom-topic instruction in native code, but the current start panel exposes only the partner-start button, topic cards and ordinary composer.

### 3. Practical lesson suggestions inherit the same broken gate

`learning/lessons/lifecycle.rs::choices` calls `openers::choices_db`, so practical lesson suggestions share target/explanation coverage and recent-topic exclusions. Custom-topic lesson generation does not need a selected starter and can proceed without these cards.

Unlike conversation opening, selecting a practical lesson serializes the entire starter into `lessonChoice`; `lessons/prompts.rs` sends it as `selectedLessonChoice`, including multilingual example maps and coverage metadata. Lesson generation only needs the topic's semantic brief/objective metadata and resolved language instructions. Removing the gate alone would leave irrelevant sample content entering lesson prompts.

### 4. Core prompt resolution is largely aligned

`configuration/resolution.rs::resolve_pair` independently resolves target and explanation varieties, emits their identities and scoped writing/assessment guidance, and captures a context hash. Assessment instructions distinguish legitimate variation from an error. Conversation, private coach, lesson, translation and reading paths consume captured language context. Partner generation also resolves the selected pair.

Immutable capture is appropriate: queued work should use the settings it was accepted with, even after the learner changes preferences. Retaining variety IDs for provenance does not require partitioning product capabilities by variety.

No dialect-specific topic or feature gate was found in `server/app`; topic selection belongs to native configuration/application code. Shared skill candidate selection uses language traits/material and difficulty, not a dialect whitelist (`configuration/mod.rs::candidates`; `applies` currently returns true).

### 5. Learner estimates are partitioned by variety

`learning/learner/learner_state.rs::fold` groups construct estimates by `(variety, construct)` and also includes variety in repeated-wording deduplication. The learner-model UI filters these separate estimates by variety. Lesson suggestions select due constructs only from the current variety.

Meanwhile practice focus/exclusions and evidence collection in `progression.rs` are language-scoped, and the learner UI describes practice XP as language-wide. Thus switching dialect changes the estimate/review bucket without changing the language-wide focus/XP scope. This is substantive behavior beyond a prompt preference and needs alignment with the user's clarified model. Preserve variety as observation provenance; do not assume independent mastery tracks are wanted.

Older coaching-plan/contracts explicitly prescribe variety-scoped estimates, so implementation and documentation must be reconciled together rather than citing those documents as justification against the user's clarification.

### 6. Variety overrides support non-prompt behavior, currently dormant in content

`VarietyOverrides` supports orthography, romanization selection/support, rendering scalars and provider integration tags. Resolution can consequently change script, direction, font scale, word spacing and transcription mapping. UI `platform/ipc/tauri.ts::languageFor` applies projected variety properties to rendering/reading controls.

Every currently authored variety has `overrides: {}`. No actual Arabic dialect-specific rendering or provider override caused the topic problem. Still, the schema is broader than a prompt-only variety contract. Writing-system/rendering and provider capabilities should have explicit ownership, rather than becoming implicit dialect feature switches. Existing language-level script scale and Unicode shaping behavior are separate from this issue and should be retained.

### 7. Speech and saved lesson behavior need distinct treatment

- TTS uses the captured target language and variety as pronunciation instructions while requiring verbatim reading (`execution/speech.rs`, `ai/transport/speech_provider.rs`). This is consistent with linguistic instructions.
- Transcription resolves the context's provider language tags, but the field named `variety_hint` actually contains the native language name and preceding partner text (`speech/recording/voice.rs`, `transcription_context.rs`). It does not explicitly instruct the transcriber to use a dialect. This is not another availability gate; do not confuse transcription context with a chat instruction.
- Practising a saved lesson is rejected if its captured target variety, difficulty or explanation language differs from current settings (`lessons/lifecycle.rs::control`). This is a stale-generated-artifact check, distinct from gating available topics. The check omits explanation-variety changes despite lessons using captured explanation-variety instructions; consistency needs review.

### 8. Language inspection displays authored samples, not selected-variety generation

`configuration/inspection.rs` returns all authored language starter samples. `ui/src/features/languages/LanguageDetails.tsx` displays preview and coverage IDs, even when inspecting another variety. This is source-content inspection, not proof that those cards are available or generated in that variety. Future removal/separation of starter examples must update this view too.

## Recommended correction boundaries (not implemented)

1. Define topics as language-independent IDs plus semantic partner briefs and selection metadata. Localized card labels/reasons are display text, not eligibility rules. Remove target/explanation dialect coverage gates from both conversation and lesson suggestions.
2. Remove preview/translation/coverage from the topic-selection contract and lesson generation payload. If authored examples remain useful elsewhere, give them a separate owner; their absence must never disable a topic. Do not relabel MSA examples as Levantine or author dialect phrase packs just to restore cards.
3. Make no-topic start a generic natural opening; remove the hidden topic-guessing requirement. Keep selected-topic starts prompt-driven.
4. Align learner estimate ownership with prompt-only variety semantics: language-wide estimates with captured variety provenance, unless the user explicitly chooses a separate dialect-learning model. This requires its own deliberate implementation and evidence tests, not a side effect of repairing topic filtering.
5. Narrow variety configuration to linguistic guidance and provenance, separating any truly required writing-system/provider configuration. Preserve language-level rendering support and accepted-work snapshots.
6. Update authoring schemas, generated contracts, content inspection, configuration tests, README and conflicting coaching design sections together. Existing tests encoding zero-card behavior must be replaced, not merely kept green.

Acceptance checks for implementation: equal eligible topic IDs across target/explanation varieties given otherwise identical inputs; both Arabic varieties at absolute zero and beginner; other target languages with Arabic explanation; conversation and practical lesson paths; a new language without authored sample sentences; prompts retaining selected target/explanation instructions and chosen topic but no canned dialogue; generic no-topic starts; no fabricated learner evidence; settings changes preserving accepted work. Verify estimate ownership separately.

## Verification and limitations

- Ran the existing exhaustive target/explanation-variety starter coverage test: passed. It confirms the unwanted zero-card behavior is intentional in current tests, not correct product behavior.
- Ran the four execution language-context tests: passed, covering frozen settings, independent writing guidance, focus capture and all-language coach guidance. They emitted repeated `Native inference diagnostic could not be saved.` messages; diagnostic persistence is not verified by this audit.
- Ran both partner-opening execution tests: passed, covering real partner history without learner evidence and rejection of late publication after cancellation. Seven targeted tests passed in total. `git diff --check` passed for tracked changes.
- Source audit covered content/schema/linking/validation/selection, opening UI/native acceptance/execution, lessons, learner estimates/progression, language inspection, settings projection, reading/translation guidance, speech, partner context and server dialect references.
- No live provider calls, deployment, database modifications or running-app visual verification. Concurrent source edits were preserved. This is an architecture audit, not a claim that the identified mismatches have been fixed.
