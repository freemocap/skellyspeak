---
sidebar_position: 4
title: Ontology
---

# Domain model

This page describes current entities. Proposed learner–language profiles, durable
contacts, relationships and annotated passages are defined in the
[architecture redesign plan](./architecture-redesign); they are not yet implemented.

The persisted entities are settings, language pairings, conversations, tutor
memory, explicit lesson choices, custom personas and the private coach thread. Model-call traces describe
execution. Type definitions live in Rust and `src/types.ts`; the graph is built
from `src-tauri/src/ontology.rs` and `turn_plan.rs`.

## Settings

Public preferences live in `settings.json`: provider mode/model, language pair,
dialect, microphone selection, automatic speech/send behavior, display choices,
voice engine/name/rate and keyboard shortcuts. Keys and hosted session tokens
live in the native credential vault. IPC masks provider keys and omits the
session token and installation ID.

Provider modes are `hosted`, `cloud` and `custom`. Hosted mode uses Google
sign-in and the metered proxy. Cloud mode uses the user's OpenRouter key. Custom
mode sends chat to the configured OpenAI-compatible server; speech services have
separate endpoints. Routing lives in `Settings`, not in individual UI controls.

## Language pairing and conversation

A pairing identifies target and native languages. Dialect is a preference within
the pairing. Each pairing has a current-chat pointer and several independently
saved conversations. A conversation has an ID, ordered turns, a title and update
time. Soft deletion adds a timestamp and excludes it from the active list.

The frontend owns the stored turn shape and saves settled turns. A turn contains
the learner message, the assistant reply and its analysis: tokens, translations,
mechanics, scaffolds and errors. Streaming text and active playback are transient
UI state. Late events carry conversation ownership and cannot update another
chat.

## Tutor memory

Partner replies are prompted to include one easy response invitation within the
selected difficulty limits and lesson context, including on greetings and topic
changes. This requirement does not change inferred proficiency or lesson ownership.

Skill progress exposes derived XP credits identifying the attempt and skill that
own each reward. Credits sum to the language XP total and are recomputed from
eligible saved evidence, not stored as additional awards. Lesson displays these
credits with source quotes and assessment rationales; stars remain practice
milestones rather than proficiency claims.

`TeachingPlan` describes immediate practice focus, recurring errors, vocabulary
to recycle, interests, correction budget and a taught ledger. `Profile` holds
longer-term learner notes, strengths, weaknesses, interests and error patterns.
Both have validated size bounds and persist together in `memory.json` per pairing.

The observer updates those documents after the first learner turn and every
fourth learner turn thereafter, without overlapping another observer pass.
Observations advise the partner; they do not override the learner's chosen
language, level or current topic.

## Persona and coach

The explicit `__none__` selection disables fictional characterization. Reroll selects a partner other than the current saved character. Both controls start another conversation.

A persona has an ID, label and character sketch. Built-ins cannot be edited;
custom personas are validated and stored in `personas.json`. A `ConversationPartner` is the per-chat instance: the copied persona, a nullable first introduction and an origin (`new_chat` or `recovered_history`). Surprise selection happens once at initialization; catalog changes never alter an existing snapshot.

The coach's feedback and interactive thread are private to the learner. The
partner does not receive that thread. Each chat's `coach.json` retains up to
40 messages. Interactive questions are single-flight; context changes invalidate
late answers.

## Operation and run

An operation is a declared task such as replying, tokenizing, explaining,
suggesting, coaching or reflecting. `turn_plan.rs` describes expected dependencies
and UI emissions. The Rust guided command executes the work.

A run records one operation's model, timing, attempts, result and reported usage.
Retry usage is summed across attempts. Missing provider usage cannot be inferred
from a successful reply; the hosted reservation ledger retains unverified cost.
Trace reconciliation compares observed operations/timing against the declaration.

## Hosted account and reservation

A hosted account has a verified Google identity, revocation version and daily
allowance. A reservation identifies one admitted provider request, its UTC date,
reserved cost, settlement state and provider generation ID. Token/request counts
are reporting fields; money controls admission. See [Hosted API](./hosted-api)
for settlement and retention rules.

## Learner-owned lesson choices

`LessonChoices` contains a goal (up to 600 characters), up to 10 preferences or
memory corrections (256 characters each), and a nullable correction budget
(0–2 recasts per partner reply; null uses the inferred budget). It does not change
automatic per-message feedback. Clearing the goal returns focus to inference.

`LessonState` stores these choices, an increasing revision, and the most recent
20 explicit changes in the pairing's `lesson.json`. Each change has its source,
reason, timestamp, and before/after choices. Missing `lesson.json` means no
explicit choices yet; malformed files are errors. Existing inferred memory is
preserved. Coach messages can carry a proposed complete choice document and the
revision it was proposed against; old messages have no proposal metadata.

The observability descriptions distinguish saved conversation history, private coach messages, explicit learner choices, and shared inferred directives. The partner consumes choices and directives, but not the private coach thread. Runtime trace turns identify executions; captured request context links supported calls to persisted chat and message IDs. Each run also records an app version and session identity.

A persona is a reusable template. Its saved conversation instance fixes the sketch, and its first reply supplies the permanent identity reference. No-persona instances retain an empty sketch and no fictional identity reference. Legacy recovery preserves the earliest assistant introduction and records that the original template is unknown.

## Captured instructions and outcomes

A request context is a snapshot, not a live settings lookup. It distinguishes
selected practice difficulty from inferred proficiency and records lesson revision,
partner identity, trigger and history counts. Each attempt retains structured
messages, effective parameters, bounded output and explicit truncation. Named
reply/suggestion blocks and standalone topic-note blocks provide source
provenance; other calls retain system messages without that breakdown. Length diagnostics, model outcome and reply
application status are separate facts. The bounded trace archive and explicit
audit exports are independent of conversation storage and deletion.

The partner and learner remain distinct speakers. The saved introduction is
quoted in reply prompts with `role: assistant`; it describes the partner, not
the learner. Prompt instructions require explicit learner self-identification
before addressing the learner by name. No automatic learner-name extraction or
identity-verification model runs.

A topic note is generated explanatory content, not evidence of a learner error.
It consists of native-language guidance, a target-language example, and its
translation. It is transient UI content; the model call is retained under the
existing explanation operation with trigger `lesson_topic_note`.

## Meaning-domain skills and progression

The learner tree describes grammatical meaning relationships, not agents,
communication modes or fixed beginner/intermediate/advanced branches. Its root
records participation; domains group assessable skills and extensions. Catalog
IDs/version define rubrics independently of the target language's constructions.

`assess_skills` is a detached Runner operation. Its sparse judgments and exact
quotes are evidence, not direct mutations of XP. `EvidenceRecord` links one
assessment to learner/target/native context, chat/message, source, assistance,
model and trace identifiers. Historical records retain their original catalog.

The local learner profile in `learner.rs` owns a registry target language, pinned focus and excluded
attempts. Rust derives success marks, assisted practice XP, stars and a recommended
focus from current-catalog live evidence. One/two successes earn checks and three
a star. These are game milestones, not CEFR levels. Inspection and practice focus
are separate; profile progress never changes conversation difficulty.

Conversation practice settings contain an explicit difficulty and revision in
`practice.json`. They belong to the addressed conversation, independent of other
conversations in the same language. Reopening restores the saved selection;
revision-checked edits apply to subsequent requests. Relationship defaults are
planned separately and do not imply a shared language-wide setting.

See [Meaning Domains & Skill Progression](./skill-progression-design) for exact
qualification, deduplication, exclusion and deletion rules. Profile switching is
future work. The inferred observer `Profile` remains teaching memory, not this
learner identity or its progress account.

### Local factory reset

Credentials are loaded into Rust-owned session state from the platform vault.
Ordinary preference changes do not access that vault. Credential changes update
the vault and public preferences before replacing the in-memory state; a failed
preference write attempts to restore the previous vault contents.

A confirmed factory reset removes the local learner, evidence ledger, conversation
archives, lesson/coach state, preferences and credentials together. It is a
device-local lifecycle operation, not a hosted account deletion. A durable reset
request is completed before normal startup so old workers cannot restore erased
state. The resulting profile starts from the built-in defaults.

Browsing a skill domain is presentation state, distinct from the persisted active
practice focus. Skill explanations describe a criterion; reviewed replies show
past assessment evidence. The UI labels these separately so an example is not
mistaken for evidence or a new award.

Skill assessment instructions require explanations in the learner’s native language that identify the quoted construction, its linguistic function, and its relationship to the specific rubric. Topic summaries alone do not support credit. Prompt version `skill-evidence-5` applies to new assessments; saved explanations are not rewritten. Map selection uses a neutral outline independent of domain colors.

Speech uses the saved conversation persona. Built-in characters have distinct cloud voice casts; custom characters receive a stable cast by ID. Explicit age, gender and manner in the saved character guide cloud delivery, without inferring gender from occupation. No-persona chats use the configured voice. OS playback selects a stable installed voice per persona within the target language; OS voices expose no reliable age/gender metadata. Audio caching separates chats.


Browsing selection is target-scoped and separate from saved practice focus. Map-entry
requests carry skill identity without awarding credit or persisting focus. Reward detail
resolves current records; excluded/incomplete evidence shows no current credit. XP
deltas, stored credit and unassisted successes remain distinct. Chat and Skills share
the domain palette and skill/evidence presentation.

### XP presentation lifecycle

The React reward presentation controller owns opening, hovering, and departing cards. Selections store message/credit identities and resolve evidence against the current snapshot; removed evidence closes the card. Web Animations moves the card from its captured phrase position to the conversation header area and then to a currently visible domain anchor. A compact indicator represents an offscreen map destination. Route, chat, and target changes clear presentations. This transient state does not write credits, alter scoring, or issue model requests.

The composer Coach tray presents preloaded annotations of the current partner reply and suggested replies, generated by the existing suggestion operation. It is distinct from the private coach conversation. Inserting a reply records suggestion/scaffold assistance on the draft; it does not send a learner message. Opening help or requesting an explanation does not itself change lesson choices.

Advice regeneration is an explicit suggestion refresh, not a new partner turn or private-coach conversation. It carries the previous advice as context and retains the same partner message.

Desktop debug builds use `com.freemocap.skellyspeak.dev` for application storage
and credential-service identity. Release storage is not migrated or read by a
debug build. Ordinary logs contain operational metadata; content-bearing AI
traces retain their separate inspection and deletion contract.

The Rust-owned `Settings.always_pronunciation` preference defaults to false and controls token-level pronunciation in chat and Coach through `TokenSpan`. Sentence-level `AssistedPhrase.pronunciation` remains in saved advice but is not rendered. Mobile Chat/Lesson selection belongs to the app shell so secondary Skill Tree navigation cannot hide the way back to practice.

`Settings.fast_mode` is persisted by Rust and defaults to true. New credit detection sends each reward directly into the shared card presentation stack; animation does not gate model processing or later rewards. Automatic arrivals are staggered by 460–560 ms; in Fast mode each card holds for 500 ms after opening before departing; manually inspected cards remain until dismissed. Presentation does not change earned credit.

XP arrival detection compares credit amounts by attempt and skill, bounded by net skill XP gains; it does not require the review to become complete in the same snapshot. Point-icon clicks inspect one credit without dismissing other icons. Card sizing uses the visible viewport independently of the message stream’s available height.

Chat token annotations include native-readable approximate pronunciation for the exact source token, alongside its contextual gloss and optional romanization. Both learner and partner token analysis produce this field. Saved tokens predating this field deserialize with no pronunciation; the UI does not infer alignment from sentence-level Coach advice.

Linguistic progress is owned by `(learner_id, target_language)`. Conversation evidence is stored under its target/native pair and aggregated across native-language contexts only for the same target. Saved profile choices live under the target key; the projection rejects mixed-language or mixed-learner records. The frontend hides snapshots from a different selected target and ignores obsolete settings-scope responses. Reward transitions never compare XP across targets. The practice dashboard derives descriptive domain totals and distinct contributing-message counts from the current credit ledger, with source-record provenance; it introduces no global linguistic score or inferred proficiency measure.

The explicit difficulty enum includes `fluent`, with a C2-style practice policy above Advanced. It uses the same reply blocks, teaching context, diagnostics, evaluation, and credit rules as other levels. Difficulty denotes requested expression, not measured ability; complex topics are not excluded at simpler levels. Provider safeguards retain authority.

`get_practice_overview` is a read-only aggregation of independent target-language snapshots for every supported language. The profile computes global retained-activity counts and an explicitly additive global XP total, then exposes language-specific tabs. Zero-experience languages are included; no global total is fed back into any language’s scoring or unlocks.

A completed opening is an assistant history message even though its turn has no learner text. `reply_done` makes it available to subsequent requests before annotation finishes; pending annotation does not exclude the reply from conversation history. The provider payload preserves these message roles and contents.

`reaction` is a detached Chat operation declared in the turn plan. After a learner reply, it reuses the captured partner provider and full reply-request context plus the completed assistant message, then requests a structured `PartnerReaction` self-report in the native language. Its original partner blocks plus the reaction instructions are rendered into one system message and recorded together; the outbound provenance check must match that exact composition. A final application trigger is explicitly distinguished from learner dialogue. It never consumes private coach grades. Reaction success/failure events attach to the originating turn and persist with that conversation; stale events cannot cross chat ownership. The coach independently sees the learner message, prior dialogue, and partner reply and returns `grammar` and `conversation` scores. Historical `comprehensibility` remains historical data rather than being converted to a different construct. Reactions do not award XP or change ability estimates.

Rust settings persist `reward_sounds` as `yes`, `no`, or `follow_tts`; the default follows `auto_speak`. `reward-sounds.ts` synthesizes bounded Web Audio motifs without model calls or audio downloads. Automatic XP cues are attached to new-card settlement, manual inspection pops to XP-icon clicks, and partner cues only to newly received confused/understood results. Visible-source glow and audio share scheduling; offscreen or inactive sources stay silent. App lifecycle cancellation stops scheduled oscillators and highlights alongside TTS. Historical inspection never replays earning sounds.

Reward audio activation listens in capture phase to mouse, keyboard, and touch-release events. Enabled, foreground contexts resume from both suspended and WebKit interrupted states on user interaction; inactive or muted contexts stay silent. Resuming does not recreate cancelled notes.

Reading presentation shares `TokenSpan` across chat and `TargetText` surfaces. `ReadingProvider` supplies language preferences and a bounded transient, language-pair-scoped cache of complete annotation requests keyed by source text and context. The Rust `annotate_text` command uses a dedicated mixed-language reading prompt, the configured provider routing and `TokensOut` schema. Its separate `annotate_text` operation appears as Text annotations in diagnostics. For word-delimited target languages, Rust supplies exact whitespace-delimited source entries and rejects changed, split or merged entries; other target languages retain meaningful-word segmentation with exact source coverage. Every entry containing letters or numbers requires a contextual gloss and pronunciation, including quoted words, native-language words and numbers. Validation feedback identifies the offending token and missing fields; punctuation-only entries may omit these aids. These checks reject invalid output rather than substituting annotations. Unsaved reading text prepares annotations on mount; ordinary word taps only toggle prepared meanings. Hold/right-click explicitly invokes deeper `word_insight` analysis. Cached and in-flight annotations are shared across preview, panel reopen and duplicate text within the mounted reading provider; this cache does not survive app restart. Markdown preserves its surrounding source as inspection context. Explicit request failures appear inline. Saved token annotations are reused when supplied. The Rust settings contract persists `text_size` (75–150%, default 100) and `text_spacing` (0–12px, default 2); CSS scales reading text and word spacing independently. Token pronunciation is gated solely by `always_pronunciation`, including after a gloss reveal. Message Translate buttons and `auto_translate` select the same inline rendering; changing the global preference clears local translation overrides.

Reading display preferences are shared through `ReadingPreferencesProvider`. The guided surface supplies its current settings so quick toggles update Coach, lesson examples, token annotations and analysis dialogs immediately. Coach suggestion words remain inspectable; only the trailing insertion icon fills the draft. The top-bar settings panel uses transient disclosure state and starts closed. Translation, pronunciation and romanization displays respect their corresponding preferences.

Audio volume preferences (`master_volume`, `voice_volume`, `effects_volume`) are persisted by Rust as validated percentages from 0 to 100, defaulting to 100 for existing settings. The frontend multiplies master by each channel before playback: speech uses the cloud audio element or OS utterance volume, while reward sounds share an output gain. The existing `reward_sounds` policy independently controls whether effects play.
