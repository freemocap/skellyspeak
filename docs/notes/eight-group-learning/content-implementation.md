# Content implementation checkpoint

Status: source implementation and required authoring complete; final running-app acceptance remains open.
Updated 2026-10-04. See [PR readiness](pr-readiness.md) for the current verification results and remaining checks. The dated checkpoints below describe their individual verification scope.

## Implemented

- `content/CONTENT_README.md` describes the folder owners. Each top-level folder
  has its named README. Language and skill templates have explicit placeholders.
- `content/skills/<skill>/` contains eight definition/subskill pairs: 42 teaching
  subskills, with no subskill XP.
- `content/languages/<language>/<language>-language.yaml` contains the 20 language
  configurations. Skill assessments and learner guides are separate files below
  each language's `skills/` directory.
- `native/src/configuration/authoring/` owns Rust authoring contracts, semantic
  checks, template checks, exact-path coverage and offline request assembly.
  `content/rust-schemas/` is generated from these contracts.
- `native/src/configuration/content_files.rs` supplies one inventory policy for
  bundling and inspection. Prompt Markdown is included; READMEs, templates and
  generated schemas are excluded. Unknown runtime files fail authoring validation.
- The workbench indexes the folder tree, skill references, target-owned varieties,
  shared explanation references and generated schema links. Schemas are read-only.

## Runtime integration

- `native/src/configuration/loading.rs` loads the new paths through the authoring
  validator, then links language capabilities, speech routes, practice sets,
  conversation topics and Markdown prompt fragments. Disk and bundled loading
  produce the same semantic fingerprint.
- `configuration/skills.rs` projects the eight definitions and reads compact
  target-language assessment guidance. Explanation-language guide prose is not
  included in assessment input. Missing assessment content reports its exact path.
- `configuration/communication_guides.rs` composes learner Markdown from shared
  concepts and language examples, joined by `subskill_id`. It requires the selected
  explanation language. `communication_inspection.rs` adds English technical
  explanations, exact source paths and assessment policy for repository inspection;
  those technical sections are not sent to the learner guide view.
- `configuration/skill_navigation.rs` exports a root and eight skill nodes.
  `npm run contracts` generates the UI catalog from this projection. The UI map,
  list, rewards, filters and statistics use these main groups directly. All seven
  interface locales contain the labels, purposes and boundaries.
- `learning/learner/progression.rs` computes evidence and XP without loading guide
  documents. The learner-facing snapshot adds guides in the learner's selected
  explanation language. Missing content is not interpreted as missing experience.
- The content inspector uses the authored source files for structured guide
  inspection, preserving examples and authorship. No separate guide file contract
  is loaded alongside these files.

## Exact assessment composition

`audit-content --request spanish spanish-mexico` reads state JSON from stdin.
`authoring::Content::assessment_specimen` returns the complete request and a source
manifest with each source path and fingerprint. It makes no provider request.

For the `time_events` question it combines:

1. `content/prompts/assessment/skill-assessment.md`: common instructions and question.
2. `content/prompts/assessment/skill-criteria.yaml`: the four named choices.
3. `content/skills/time-events/time-events-definition.yaml`: name, purpose and boundary.
4. `content/languages/spanish/skills/time-events/spanish-time-events-assessment.yaml`:
   core guidance and the explicit `spanish-mexico` disposition.

The same composition applies to each of the eight groups. The grammar and
understandability questions each use their Markdown and criteria YAML in
`content/prompts/assessment/`. The ten questions share one concrete state object:
`currentLearnerMessage`, `precedingExchange`, `language`, `variety`. The caller
supplies the first two; language and variety names come from the selected language
configuration. At most four preceding messages are accepted. No later partner reply
or learner guide is included.

`content/policies/skill-credit.yaml` owns the positive categories and threshold.
`content/prompts/assessment/evidence-attribution.md` owns evidence-location prose.
Neither is presented as an additional Jev skill question.

[assessment-request.json](assessment-request.json) is the complete generated offline
specimen, including state and source manifest. The learner's Spanish sentence means
“Yesterday I went to the market”; the preceding question means “What did you do
yesterday?” These are synthetic examples, not saved learner messages.

## Coverage

The declared bundled explanation languages are English, Spanish and Arabic.
Every target language explicitly declares its source explanation edition in
`content/policies/guide-authoring.yaml`. Source linguistic material is required;
additional explanation translations are an incremental target.

| Document | Present | Bundled target | Missing |
| --- | ---: | ---: | ---: |
| Shared explanations | 16 | 24 | 8 |
| Target-language assessments | 160 | 160 | 0 |
| Target-language learner guides | 168 | 480 | 312 |
| Total | 344 | 664 | 320 |

Required source coverage is complete: zero mandatory documents are missing.
The 320 remaining entries are optional bundled translations. `content:coverage` separates `required_missing` from `missing`;
`content:ready` gates only mandatory source coverage. `content:check` validates
all present documents. Translations cannot conceal missing source language facts.

## Combined assessment contract

`native/src/learning/turn_assessment.rs` assembles eight skill questions plus
`grammar` and `understandability`, enforces request budgets, and validates the
complete ten-answer result before returning any answers to a caller. Grammar
and understandability retain their own selected categories and distributions;
neither replaces the per-skill correctness decision.

`native/src/configuration/authoring/prompts.rs` loads the two message questions
from `content/prompts/assessment/{grammar,understandability}.md` and their
matching `-criteria.yaml` files. The offline specimen now uses this shared native
builder and retains its exact source-file manifest. Runtime dispatch uses the same
builder through `learning/coaching/assessment_adapter.rs`. New conversation turns
schedule one Jev operation. Its response preserves eight skill answers plus the
categorical grammar and understandability answers in the source-owned result.
`conversations/execution/publication.rs` validates all ten answers before publishing
skill credit and the partner-reaction projection in one transaction. The
`understandable` choice qualifies one partner-understood award per source turn,
with policy `jev-understandability-1`; abstention produces no face or award.
Grammar does not independently gate skill credit. UI disclosure shows the saved
categories and expandable model probabilities.

Four colocated contract tests cover missing/extra answers, invalid numeric values,
abstention, unreconciled distributions, independent grammar/skill outcomes and
request budgets. All pass. Fast validation and Clippy with warnings denied pass.
The full native suite reports 792 passed, zero failures and five ignored.
No UI source changed in this runtime integration step.

## Turn capture and model routing

Implemented in `native/src/conversations/execution/turns.rs`: new turns save
`messageAssessmentQuestions` beside `presenceSkills` and `presenceInstructions`.
`native/src/configuration/skills.rs` reads those questions from the registry's
source snapshot and includes them in `skillContentHash`. Criteria changes therefore
change assessment provenance; learner-guide edits do not. This additive captured
field is required for new assessment execution. Format 48 cancels unfinished
assessment work before ordinary recovery; it does not backfill completed results.

`native/src/conversations/turn_plan.rs` selects the captured fast model for
`persona_reply`, `persona_opening`, and `reply_brief`. Coach replies, detailed
explanations and feedback retain their declared roles. Dispatch tests verify the
persona/brief model reaches the transport target and attempt record. Capture tests
verify authored questions survive reopening the workspace; a configuration test
verifies message-criterion edits affect the assessment hash. All three pass.

`message_assessments` owns immutable source-message/attempt results;
`turns.context` carries assessment and reaction projections. Completed records are
preserved. Format 48 handles unfinished execution as described below. The clean-message counter is removed from active projections and UI; its
record-retention policy is described below.

## Remaining acceptance

- Run the focused app checklist in [PR readiness](pr-readiness.md), including automatic coaching, optional assessment, guide actions and translated guides.
- Preserve AI authorship and needs_review status; independent linguistic review and model-quality experiments remain follow-up work.
- Hosted CI and cross-platform checks remain separate from the completed local checks.

## Verification

- Passed: final fast validation; TypeScript and production Vite build; all 1,728 UI
  tests across 262 files; Rust Clippy with warnings denied; documentation links.
  Vite/Vitest used `--configLoader native` because their default config bundler
  encountered a Windows directory permission error.
- Passed: all runtime configuration tests, including all target/explanation variety
  combinations, disk/bundle equivalence, exact-path failures and translated guide
  composition; generated schema freshness; runtime content inspection (20 languages).
- Passed: generated native Jev request fixtures and 36 server admission tests using
  `server/.venv/Scripts/python.exe`. Pytest reported an unwritable cache directory;
  the test assertions passed.
- Full native suite: 800 passed, zero failures, five ignored. This includes combined
  assessment publication, transactional rollback, one-time credit, abstention,
  invalidation, reopening and migration tests. The writing-context test explicitly
  selects a neutral topic so it tests script/explanation handling independently
  of uncompleted coach-directed language material. Coverage remains a release gate.
- The source and bundled-translation coverage counts are recorded above. No running-app test, hosted
  CI or linguistic quality experiment has been performed.

The UI source inventory excludes local service state, Python environments/caches
and reference content. Those are not application modules. Architecture checks run
against the application sources; no test exemptions were added.

The catalog localization pass removed 42 unreferenced catalog messages after checking
source/data callers and supplied the eight-group messages in all seven dictionaries.
The fast localization audit reports no unreferenced message candidates.

## Workspace format 48 ownership treatment

Implemented and verified for the combined assessment: preserve completed immutable
`message_assessments`, source messages, turn context, provider attempts, effort
awards and skill-level receipts. Do not convert numerical ratings into categorical
judgments or transfer credit between skill identities.

During the database-only migration, cancel unfinished `conversation_feedback`,
`coach_reaction`, `skill_assessment` and dependent `skill_attribution` operations.
These are uncompleted execution intentions, not earned evidence. Retain their
attempt rows and metadata; an interrupted running attempt becomes unknown because
provider execution/billing cannot be inferred. Record the cancellation reason in
the owning turn context. Cancelled work is not eligible for retry. Completed
results remain readable. Conversation replies, reading, speech and coaching are
not cancelled by this migration. Startup retains its existing recovery rules.

The step runs inside the existing all-or-nothing chain with a recovery copy;
verification covers each supported starting format, retained evidence, repeated
startup and rollback. New turns capture the complete authored assessment inputs.
No user's workspace is opened or reset during implementation/testing.

## Active effort counters

Implemented: coaching feedback no longer qualifies any effort award. The clean-message
qualification function, active dimension, native progress/total fields, generated
IPC fields, UI counters/table columns and counter styling are removed.
Partner-understood, revisions, practice, exploration and bot engagement remain.

Ownership policy: existing `effort_awards` rows retain their IDs, source identities,
policy, timestamps and claim state. Active progress queries, report queries and popup
claims exclude the inactive dimension. Those records remain in the workspace and its
copy export. This is the explicitly requested retirement of an active metric; it
neither deletes evidence nor recalculates XP. SQL/persisted JSON shapes are unchanged,
so no additional workspace-format step is needed. The removed fields were IPC
projections, not stored learner state.

Verified: native 792 passed (five ignored); UI 1,700 passed across 259 files;
TypeScript and production build; fast gate; Clippy with warnings denied. The two
retirement tests check that feedback creates no award and that retained rows cannot
appear in active reports or be newly claimed, without modifying those rows.
The shared progress-card test verifies the clean counter is absent. No running-app
or visual check was performed.

## Saved message judgments

Implemented: `conversations/assessments.rs::feedback` projects grammar and
understandability from the current successful combined assessment into message
snapshots, version history and the coach's saved context. It preserves each choice,
confidence and probability map without deriving a numeric grade. Pending or failed
reassessment does not expose the preceding success as current. Assessment failures
reach the message feedback error display. Stored records are unchanged.

`ConversationFeedbackCard.tsx` shows the two categorical judgments and an expandable
probability table for each. Labels are localized in all seven UI dictionaries.
Opening the card/details makes no inference request; Ask the coach includes the
saved judgments in its explicit request context. Insufficient evidence is distinct
from a zero score. Saved numerical evidence remains readable in its recorded shape.

Verified: snapshot/history equality, restart persistence, failed/pending result
visibility, categorical display, abstention and opening without inference. Full
native suite: 793 passed, five ignored. Full UI suite: 1,703 passed across 259 files.
TypeScript, production build, Clippy and fast validation passed. Running-app layout
and assessment quality are not yet verified. Automatic/on-demand controls and the
associated not-assessed/pending presentation are implemented below.

## Native optional-work activation

Implemented: `configuration/execution.rs` owns the three optional execution modes under
`Preferences.execution`. The existing revision-checked learner update is their
single writer. Rust exports types and `DEFAULT_EXECUTION`; no frontend defaults
are independently maintained. Assessment is Automatic; reply briefs and reading support are On demand.
Coaching is mandatory and runs automatically.

`execution/turns.rs` filters both queue admission and operation creation with the
same policy and captures the values plus learner revision. It does not change
previous turns. `execution/optional_help.rs` implements `RequestMessageHelp` for
assessment, coaching, reply briefs, translation and word gloss. Source-role and
availability checks reject archived/replaced/invalidated sources. Repeated opens
reuse saved or pending work; failed/unknown work needs `retry: true`. Requests use
captured source context and current access authority, with queue/attempt budgets.
Assessment creates dependent quote extraction once; delayed publication uses the
same transactional XP and effort rules.

Workspace format 49 explicitly backfills the four defaults without changing learner
revision, saved results or accepted operations. The migration retains all source
settings, rejects malformed values and rolls back on failure. Upgrade/reopen tests
cover every supported starting version, and defaults match fresh workspaces.

Verified: activation defaults and capture, no backfill, delayed credit once,
request deduplication, explicit retry, source-role refusal, current access binding,
archived-source refusal and migration preservation/rollback. The broader execution
suites explicitly select Automatic to exercise all graph branches; provider-cache
coaching tests now explicitly request their subject operation.

Settings/AI-panel selectors and message opening/request UI wiring are implemented
in the UI checkpoint below.

Final native-activation checkpoint: 800 native tests passed (five ignored), 1,703 UI
tests passed, TypeScript and production build passed, Clippy with warnings denied
passed, and final fast validation passed. Documentation links and diff whitespace
checks passed. No paid provider calls, live workspace opening, commits or deployment.

## Automatic/on-demand UI

Implemented: Settings → Models and AI activity contain the same collapsed
**Automatic AI work** controls. `components/controls/AiExecutionSettings.tsx` is
presentation only; `state/settings/useExecutionPreferences.ts` owns edits through
the shared settings store. IPC rebases individual execution fields so unrelated
concurrent changes survive. Cross-window notifications carry no preference values;
listeners re-read native state. The popped-out AI window uses the same settings
store. Opening the controls also refreshes their values.

Coaching runs automatically with each new learner message, independently of reply
publication. Its activation is not configurable. A quiet underline tracks the
coaching operation and resolves to phrase marks or unmarked text; reduced motion
uses a static underline. Opening Analysis requests an absent optional assessment.
The source-bound coaching request remains available for unassessed saved messages
and explicit retries.
Saved/pending/failed operations are not automatically submitted again. The two
services have independent progress and explicit retries. The message projection
retains its durable source ID and shows pending assessment independently of coach
feedback. Missing assessment displays **Not assessed**.

Opening reply help requests an absent reply brief. Words and Translate use the
source message's native request instead of a generic text lookup, for both speakers.
Reading display preferences never trigger those requests on mount. Translation
failure has its own explicit Retry; word-meaning failures keep their source-owned
retry controls. Request failures retain diagnostics. Saved content opens without
new inference.

Verified: 1,728 UI tests across 262 files, including real-page source ownership,
no inference on mount, independent speaker reading requests, repeated opens,
explicit retries, saved results, shared controls, concurrent field preservation,
cross-window invalidation and architecture boundaries. TypeScript, production
build and final fast validation passed. Native source was unchanged in this UI
checkpoint; its previous full verification remains 800 passed, five ignored.

### Focused running-app check

Use Spanish with English explanations for this check; its authored guides and
assessment criteria are present. This is acceptance of the execution controls,
not a claim that all required language content is complete.

1. Open Settings → Models → Automatic AI work. Set all three choices to On demand. Coaching is listed as Automatic.
   Confirm the AI panel shows the same choices, including after popping it out.
2. Send a new message. The partner should reply while coaching runs automatically. Assessment,
   reply-brief, translation and gloss requests wait for your action. Without
   opening Analysis, check the underline resolves to error marks or no marks.
3. Open the learner message's Analysis. Confirm one assessment request and reuse of automatic coaching, with
   grammar/understandability and skill results appearing afterward.
   Reopen the card: no new inference should be created.
4. Open reply help, then use Words/Translate for each speaker. Confirm requests
   follow those actions and reuse saved results. If a provider request fails,
   confirm opening it does not retry; Retry must be explicit.
5. Set assessment back to Automatic. Confirm it applies to the next message and
   does not backfill earlier messages or cancel accepted work.

Running-app layout, real-provider results and perceived latency remain unverified.
Required content and contextual starts are implemented; final integrated acceptance remains open. No paid calls, deployment
or commits were performed in this checkpoint.

### Automatic coaching and log review — 2026-10-04

Source implementation: mandatory native coaching; no configurable coaching mode.
Format 50 removes only that preference. Replies retain independent dispatch and
publication. The learner bubble renders its text while coaching is pending, then
shows saved issues without requiring the Analysis card.

Log review: the October 4 session recorded four missing-guide failures from
`get_practice_overview` and one `check_access` connection refusal (Windows 10061).
The preceding two sessions had no warning/error frontend records. Missing authored
configuration remains an error, as requested; no guide-loading behavior changed.
Provider validation records in the reviewed session were accepted. This does not
prove the linguistic judgments correct.

Verified: 802 native tests passed (five ignored), Clippy passed, 1,734 UI tests
passed, and the affected 57 UI tests passed again after the test typing correction.
TypeScript, production build, prebuild validation, fast checks and documentation
links passed. Vite used its native config loader on Windows. Running-app visual
verification remains required. No missing-config behavior was changed.

### Phrase-seeded conversation starts

Implemented for durable learner/partner bubbles and text selected within them:

- `StartPhraseButton.tsx` captures the selection before focus changes; otherwise
  uses the whole message. `useConversation.ts` captures the selected partner,
  prevents duplicate submission and opens the returned conversation.
- `Action::StartPhraseConversation` runs in the store command transaction.
  `commands/phrase.rs` validates the source/partner, creates the conversation,
  copies source language settings and accepts the opening atomically. Source
  conversation messages and learner evidence are untouched.
- `conversations/phrase_start.rs` preserves the exact phrase and source ID, with
  policy `exact-phrase-1`, in the opening turn context. This is additive optional
  metadata for newly created turns; no stored records are rewritten and existing
  records require no backfill. The snapshot exposes optional `phraseSeed`.
- `content/prompts/conversation/phrase-opening.md` supplies authored instructions
  through the validated registry. The phrase is separate JSON user data. Captured
  messages retain the instructions and the registry fingerprint.
- Publication requires a literal substring match in the final partner message,
  after ordinary reply validation. No case, punctuation or Unicode normalization
  is applied. A mismatch retains the failed attempt and offers explicit retry.
- The new conversation displays its phrase in a collapsed Starting phrase section.

Authored-example starts, skill-targeted starts and typed coach context are implemented in the checkpoints below. Reading popups intentionally have no start action. Missing source configuration remains an error.

Verified: 805 native tests passed (five ignored), Clippy passed, the full UI suite
passed 1,736 tests, and the expanded affected suites passed 105 tests. TypeScript,
production build, fast checks, content validation, bundled-content inspection and
documentation links passed. The two added integration tests passed in the affected
suites after the full UI run. Running-app check: restart native, press the
fork icon on either speaker (optionally selecting a phrase first), confirm the
new conversation uses the same partner and the opening includes the exact phrase.

### On-demand guide translations — 2026-10-04

Implemented: `configuration/guide_translation.rs` selects explicit source editions
and constructs an ordered structured-output translation contract. Only explanation
fields return from the model; native code preserves examples and identifiers.
`application/commands/skill_guides.rs` resolves bundled editions before cache or AI,
deduplicates concurrent requests, retains inference receipts, and requires explicit
retry after failure. No conversation or learner-credit records are created.

`SkillGuide.tsx` requests one guide when opened, shows pending/error/retry states,
labels generated translations and exposes provenance. Scope changes discard late
UI results. `progression.rs` validates source guides while allowing untranslated
editions to resolve on opening. Assessment guidance remains separate and mandatory.

Storage ownership: results use the existing inference execution/blob/cache tables
without SQL or existing persisted JSON changes. New payloads carry their own task
and cache-contract identity. Cache eviction may require later regeneration; receipts
survive. No workspace format change or migration is required. The hosted server is
unchanged. Source editions currently explicitly select English for authoring.

Verified: full native suite 809 passed (five ignored), full UI suite 1,751 passed,
Clippy with warnings denied, TypeScript, production build, fast validation,
generated contracts/schema checks, content validation and documentation links.
The two native translation integration tests passed again after the final request
parameter cleanup and metadata assertions. Tests cover shared dispatch, restart
cache reuse while paused, exact examples, malformed output, explicit retry gating,
source revision identity, required-source coverage, stale UI results and usage
attribution. No live provider translation or linguistic review was performed.

Running-app check: restart native; select Spanish as the target and Arabic as the
explanation language. Open one skill guide, inspect the AI translation label and
response details, then close/reopen and restart to confirm reuse. English/Spanish
bundled editions should open without inference. Missing source guides for other
target languages remain errors. Required source authoring is complete; independent linguistic review remains open.

### English source coverage and linked language controls — 2026-10-04

Implemented: `content/languages/english/skills/` contains eight source guides and
eight assessments covering all 42 subskills for the US and UK varieties. The core
examples apply to both varieties; no dialect preference is treated as a universal
rule. English guides are AI-authored and marked needs_review. British Council
reference entries and existing functional references identify the source claims;
generated examples are original and are not represented as independently reviewed.
Spanish explanation editions resolve through the on-demand translation path.

`features/settings/language/AppLanguageFields.tsx` supplies one App language control
for Settings and onboarding. It updates interface and explanation together;
Explanation options contains the explicit override and, in Settings, its variety.
Existing independent preferences are preserved until the learner changes a control.
There is no new persisted field, automatic backfill or schema change.

Checkpoint scope: selected-language English/Spanish chat, assessment and Skills
guide flows. The global practice overview still asks for all catalog languages'
source guides and remains blocked by missing source material. The 18 other target
languages still require authoring; this checkpoint is not full catalog acceptance.

Verified: 811 native tests passed (five ignored), 1,753 UI tests passed,
Clippy with warnings denied, TypeScript, production build, final fast gate,
content validation, generated-contract checks, prebuild and documentation links.
The English-target/Spanish-interface/Spanish-explanation case has a dedicated
local mock-provider regression. Real-provider translation quality and native
visual acceptance remain user checks. No deployment or commit was performed.

### Learning actions and Skills layout — 2026-10-04

Implemented source paths:

- `ui/src/features/skills/SkillsPage.tsx` starts the inspected main skill through
  `app/shell/SurfaceHost.tsx` and `features/conversation/session/useConversation.ts`.
  Guide section actions also pass a subskill identity. The native
  `StartSkillConversation` command creates and accepts an opening atomically in
  `native/src/storage/store/commands/skill_start.rs`.
- `native/src/configuration/skill_conversation.rs` assembles only the selected
  group's teaching material: its definition, shared concepts, language explanations
  and selected-variety supplement. It excludes assessment instructions and example
  lists. `prompts/conversation/coach-focus.md` tells the partner to elicit learner
  use. The readable prompt retains source paths and revision; its focus block has
  a 16 KB limit inside the existing 96 KB conversation budget.
- A group remains broad; a subskill uses only its section. The new conversation
  keeps the selected partner and difficulty, uses the inspected variety, and clears
  unrelated topic/time filters. Its explicit target persists until the learner
  changes conversation direction. The settings summary exposes the main group.
  Neither the opening nor partner demonstrations create skill credit.
- `configuration/guide_translation.rs` supplies a typed `GuideReference` with
  language, variety, skill, edition language and content fingerprint. Native guide
  retrieval attaches these references to bundled and cached/generated editions.
  `components/learning/GuideDocument.tsx` renders section starts and exact example
  starts; `GuideActions.tsx` receives its routing from application composition.
- `storage/store/commands/guide_actions.rs` resolves a quoted example by its index
  in the referenced authored edition. It never trusts replacement example text from
  the UI. `phrase_start.rs` captures the source reference and enforces exact inclusion
  in the published opening, allowing surrounding words.
- A guide's Ask the coach action sends the reference and a localized question.
  Native attaches the exact source edition, paths, revision and authorship to that
  question. `prompts/skills/coach-guide.md` fences the attachment as reference data.
  The coach thread exposes the attachment; subsequent coach questions retain it
  with its original question. Partner history and learner assessment stay separate.
  Generated translations use the authored source edition as coach reference.
- `SkillLevelsPanel.tsx` reserves the tallest description's layout space; hover
  changes visibility without moving the rows. `SkillRadar.tsx` uses a larger circle
  and a normal-size HTML label grid. Only fixed wedges participate in chart hit
  testing; active decoration does not alter pointer targets.

Persistence: workspace format 51 adds the closed skill-topic variant through an
explicit 50 → 51 migration. Existing product records are not rewritten. New guide
attachments use optional turn-context metadata. Cache payloads remain readable;
action references are attached when results are retrieved. The hosted server and
application release version are unchanged.

Required source content and scoped example/subskill coach actions are complete. Reading popups intentionally have no phrase-start action. Real-provider behavior, wheel legibility and hover stability need the final running-app acceptance check in pr-readiness.md.

Verified on the final source state: 818 native tests passed (five ignored), Clippy
passed with warnings denied, and all 1,757 UI tests passed across 266 files with
four workers. An unrestricted concurrent run hit timing-sensitive failures;
limiting workers passed without changing timeouts or assertions. TypeScript,
production build, final fast validation, content validation, generated-contract
checks and documentation links passed. The production build retains its chunk-size
warning. Native integration uses local fixtures; no live provider evaluation,
real-app visual acceptance, commit or deployment was performed.

App check: restart native and use English or Spanish. Open a skill, start a group
or a guide section, and inspect the chosen partner/difficulty and opening. Start
from a guide example and confirm exact inclusion. Ask the coach from the guide,
inspect its attached source, and ask a follow-up. Move across skill rows and chart
wedges at their edges; check label readability at narrow and wide window widths.

### Scoped coach questions and reading-popup starts — 2026-10-04

Implemented: `GuideActions.tsx` offers Ask the coach beside each subskill and
example. `AskGuideCoach.focus` identifies either a subskill or a flattened example
index. `storage/store/commands/guide_actions.rs` resolves the fingerprinted source,
validates the selection before admitting a turn, and attaches only the selected
section (and selected example when applicable). The attachment includes its
selection, source paths, revision and provenance; coach follow-ups retain it.
The shared guide introduction and selected-variety supplement remain available.

Phrase starts live on the message bubble (`StartPhraseButton.tsx`, which expands
a partial selection to whole words through the shared Unicode boundaries and
preserves source spelling) and on authored guide examples (`GuideActions.tsx`).
Reading surfaces carry no phrase action: a first version placed a labelled fork
button in every word popup and then in the Word help inspector, and both were
removed on 2026-10-04 at the user's direction, because the bubble's own fork
already starts from a message and per-token surfaces must not repeat a labelled
action. The `ReadingPhraseSourceContext` plumbing added for those actions was
removed with them. Message selections use `StartPhraseConversation`; the
`StartGuideConversation.phrase` input remains accepted natively and must be an
exact substring of the referenced example, but no UI path sends it now.
Unattributed generated text has no source-backed start action. No additional
inference call is introduced before the ordinary conversation start.

The Word help inspector was stripped the same day. It shows the selected word
(or the whole text once, for phrase/inspect icons and message analysis) with its
meanings, romanization and pronunciation revealed, a retry on failure or partial
coverage, and Ask the coach. Its source-language/variety selects, success
receipts and request-history button are gone; request history stays in the AI
activity panel. Word hover popups no longer link to it; sentence blanks keep
their Analysis link.

The optional command inputs and guide-context selection do not rewrite persisted
records or require a workspace format change. Generated contracts come from Rust.
The hosted service, release version, stored messages and learner credit are unchanged.

Verification: 821 native tests passed (five ignored), including scoped context,
invalid-selection rollback and exact guide-substring cases. Clippy passed with
warnings denied. The full UI suite passed 1,762 tests before the popup action
was removed. After removing it and stripping the inspector, the full UI suite
passed 1,779 tests, fast validation, the production Vite build and the
design-system check passed again, and a browser check of the conversation
preview found no phrase control or inspector link in any word card. TypeScript and the
production Vite build passed; the latter retains the existing chunk-size warning.
The build used Vite's native config loader after the local npm command wrapper
rejected forwarding that flag. Final fast validation, generated-contract checks, content validation and
documentation links passed. The final affected UI regression run passed 79 tests. No live provider test or visual acceptance is claimed.

Required source authoring is complete for all 20 target languages; see [the catalog review](primary-authoring-review.md). Missing-source errors remain enforced.

App check: open an English or Spanish guide and ask about one section, then one
example; inspect the coach attachment and ask a follow-up. Open a word popup in a
saved message or authored guide example and confirm it shows meanings with no
phrase action or Word help link. Start a conversation from the bubble fork and
confirm the selected phrase appears literally in the opening and the selected
partner is used. Open Reading help from a drill phrase and confirm the inspector
shows meanings with only retry and coach controls.

### French authoring pattern and bulk handoff — 2026-10-04

French now has eight assessment/source-guide pairs covering all 42 subskills for
France and Canada, with English explanations and explicit AI/needs_review
provenance. See the [review and verification record](french-authoring-review.md),
[complete offline assessment request](french-assessment-specimen.json), and
[bounded next-model task](bulk-authoring-handoff.md). The request snapshot is for
inspection only. All required source bundles are now authored. Optional explanatory editions remain supported through on-demand translation. Full native tests (822 passed),
Clippy, content validation and final fast validation passed; independent linguistic
review and a live French app check are not claimed.
