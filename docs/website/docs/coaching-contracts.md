---
sidebar_position: 7.7
title: Coaching contracts
---

# Coaching contracts

> **Current restoration target:** the user has requested the v0 coaching and
> conversation-assistance experience. The
> [v0 source comparison and restoration contract](../../notes/v0-conversation-assistance-restoration.md)
> supersedes the earlier one-suggestion/skill-bound approach as the target design.
> The restoration is now implemented in source; lesson/progression redesign stays frozen.
> [Implementation and verification](../../notes/v0-conversation-assistance-verification.md)
> records the new independent contracts and current verification limits.


> **September 16 priority change:** voice conversation is the primary experience.
> Lesson/curriculum and progression redesign are frozen while chat coaching is
> corrected. Direct corrected wording plus a brief actionable explanation replaces
> hint-first help for new turns; continuing the conversation never requires a
> repair exercise. Automatically recommended skills must not redirect the topic.
> The earlier wave/lesson sequence below is deferred where it conflicts with this
> decision. Current implementation and verification are recorded in
> [the chat-first checkpoint](../../notes/chat-first-coaching-2026-09-16.md).


The seams between the three work areas in the [coaching work plan](./coaching-work-plan). Each contract names who provides it, who consumes it, and the wave it lands in. A provider may refine a signature; the change must be reported as **contract drift** in its hand-back and then updated here by the integration agent.

Status: wave 1 is implemented and checkpointed at bdb664e. Wave 2 source and combined automated verification are complete; its integration decisions below specify the boundaries, while generated native types remain the exact wire authority. Wave 2 was accepted for continuation on 2026-09-13; Wave 3 learner-state foundation is in progress.

## Wave 1

### A → B: language guidance functions (`native/src/languages.rs`)

```rust
/// A romanization scheme as one published table (e.g. ALA-LC Arabic), with the
/// rules and hard-case examples the model needs. Scheme ids are table-level.
pub struct RomanizationScheme {
    pub id: &'static str,             // "ala-lc-arabic", "pinyin"
    pub label: &'static str,          // "ALA-LC Arabic", "Hanyu Pinyin"
    pub instructions: &'static str,   // scheme-specific prose; content starts needs_review
    pub examples: &'static [(&'static str, &'static str)], // (source, romanized)
    pub sources: &'static [&'static str],                  // references.bib keys
}

/// The default scheme for a language, or None for Latin-script languages.
/// Unknown language → error (never None).
pub fn romanization(language_id: &str) -> Result<Option<&'static RomanizationScheme>>;

/// Prompt text for tasks that emit a `romanization` field: names the scheme,
/// includes its instructions and examples. None when the language has no scheme.
pub fn romanization_guidance(language_id: &str) -> Result<Option<String>>;

/// Language-specific rules for assessing learner text (moved out of the generic
/// coach prompt, e.g. Arabic: never add diacritics or normalize letters in
/// quoted evidence). None when the language has none.
pub fn assessment_guidance(language_id: &str) -> Result<Option<&'static str>>;
```

- The frontend `Language.romanization` projection carries the scheme **id**; it remains the UI gate for the romanization toggle.
- Universal rules ("quote learner text exactly", "never invent errors") stay in B's task prompt until wave 2 moves them to `universal.yaml`.
- Wave-one primary-table verification corrected illustrative assumptions: ALA-LC uses its published distinct ‘/’ signs, unassimilated `al-` before sun letters and `á` for final alif maqṣūrah. Pinyin marks lexical tones 1–4; neutral tone remains unmarked. Source review and examples are documented in `workflow/reports/coaching-w1-a-handback.md`; linguistic content remains `needs_review`. [@ala_lc_arabic] [@pinyin_orthography2012]
- Tests (A):
  - every language with a scheme returns `romanization_guidance` containing the scheme label and at least 3 examples,
  - every scheme is referenced by at least one language,
  - every `sources` key exists in `references.bib`.
- Guard test (B, using A's functions): for each language with a scheme, the resolved `persona_word_gloss` and `coach_suggestions` prompts contain `romanization_guidance`'s text; for Latin-script languages, neither prompt mentions romanization rules.

### B → C: revision action and snapshot fields

```rust
// model.rs — new Action variant (kind-tagged like existing actions, e.g. retryGloss)
ReviseTurn {
    conversation_id: String,
    turn_id: String,          // the learner turn being revised
    text: String,             // the revised learner text
    input: InputEvidence,     // revision = true is set by Rust, not trusted from the UI
    expected_revision: i32,   // reviewed ConversationSnapshot.revision (global metadata)
}
```

- **Effect:**
  - Creates a **new turn** with `replaces_turn_id = turn_id`, runs the normal plan (persona reply, coach, glosses) against the revised text, and keeps the replaced turn.
  - Revising the latest turn needs no confirmation.
  - Revising an earlier turn removes the later turns under EXECUTION.md's edit rule. Rust enforces this; the UI confirms first.
  - A pending turn in the conversation rejects the action with a typed error, which C shows.
- **Planned schema v13:** `turns.replaces_turn_id TEXT NULL REFERENCES turns(id)`. `SCHEMA_VERSION` and `user_version` both become 13. Development data is disposable by explicit user authorization. B may rebuild the schema and erase/recreate SkellySpeak development data as needed, without migration, preservation or repeat approval. Keep current-schema creation, validation, ownership and errors correct; no silent production reset is implied.
- **Snapshot:**
  - each message exposes `turnId`, `replacesTurnId` and `replacedBy` so presentation can group by durable identity,
  - each turn exposes `replacesTurnId: string | null`,
  - the conversation view marks turns that have been replaced (`replacedBy: string | null`),
  - evidence records carry `replaces_message_id` (the replaced turn's learner message) and `input.revision = true`.
  - `revisionSuffixCounts: [{turnId, exchangeCount, coachTurnCount}]` describes the dependent suffix for each eligible active exchange. The UI uses the counts and revision from the same reviewed snapshot.
- **Concurrency:** `expectedRevision` uses the global `ConversationSnapshot.revision`, not `Conversation.revision`. Any intervening metadata change conservatively returns Conflict before mutation. The UI retains the draft and requests a fresh review; duplicate delivery of the same action ID reuses its receipt.
- **Pagination:** the existing conversation read accepts `before` sequence and returns at most 100 messages plus `hasOlder`. Earlier-version inspection may explicitly load another page; no unbounded automatic scan or fabricated predecessor content.
- **Outcomes:** the Rust `Outcome` enum has five values: `demonstrated | partial | not_demonstrated | not_observed | uncertain`. It's exported through ts-rs so `skills.ts` uses the generated type. **Semantics for later waves:** `uncertain` and `not_observed` → no estimator update; `not_demonstrated` → negative update.
- **Catalog identity:** wave one fingerprints the exact embedded JSON bytes with deterministic FNV-1a into a numeric `SKILL_CATALOG_VERSION` exported to TypeScript. Accepted turns capture that value; evidence retains its captured version and current credit requires a match. Wave-two registry hashing may refine this contract explicitly.
- **Prompt provenance:** accepted turns capture `coach-feedback-2`, `coach-suggestions-2` and context template v5. Changed graph declarations are v2; word-gloss prompt template is v5. Evidence reads its captured prompt version.
- **Credit** stays on current XP rules in wave 1. The support-weighted credit arrives with the wave-3 fold. C must remove the `replaces_message_id !== null` exclusion only when B confirms the credit rule, and in wave 1 shows revision rewards under current rules.

### Revision integration requirements

These refine wave one; B must publish the generated field names and action shape before C connects the UI.

- **Identity:** expose the durable native `turnId` on each `ChatMessage`, including coach messages, and carry it into the frontend presentation record. Numeric `sequence` remains an ordering/evidence field; it is never a native turn ID. Group learner and partner messages by their durable turn ID, not adjacency. Paginated history must not attach a reply to another turn.
- **Confirmation authority:** the revision action must carry a concurrency precondition tied to the history the learner reviewed. B specifies the token and validates it transactionally before removing anything. A changed history returns Conflict and requires a fresh preview; never silently expand the removal scope. Do not use an unqualified frontend message count as authority.
- **Single active chain:** revise an active learner/persona exchange, never a private coach turn or an already replaced version. Repeated edits extend the chain from its current active member. Retain the predecessor chain for the Earlier version view. Reject cross-conversation links, cycles and branching replacements.
- **Earlier edit:** remove the later dependent suffix under the approved edit rule while retaining the selected exchange and its predecessor chain as earlier versions. Include affected private coach records and unpublished source-dependent operations in the removal/invalidation analysis. B reports the exact scope and C names it in the confirmation. No unrelated conversation or standalone generation receipt is affected.
- **Context:** subsequent partner/coach conversation history uses active exchanges. A replaced response remains available for inspection, but is not supplied as a current reply. Private coach content remains outside partner context. New turns capture current explicitly chosen settings and focus; previous captures remain immutable.
- **Publication:** atomically accept the revision and invalidate unfinished work on superseded/removed sources. Late feedback, suggestions, glosses and speech cannot publish into the new turn or resurrect removed records. Do not replay rejected or unknown inference automatically.
- **History availability:** supply enough revision metadata/history for an Earlier version view when the predecessor lies outside the current message page or the recent operation list. B provides a bounded retrieval shape if needed; C must not fabricate absent history or silently omit it.
- **Credit:** current native rules award distinct demonstrated revised wording 2 assisted XP, retain the 10 XP unassisted rule and enforce existing wording deduplication/exclusions. Retained earlier versions remain inspectable learning evidence; removal of a dependent suffix removes that suffix's contributions. B verifies these rules in native tests. After that handoff, C removes the blanket replacement exclusion and celebrates only the positive net credited increase once. No new proficiency marks for assisted repair; no manufactured reward when no credit increased.
- **Acceptance cases:** latest revision, repeated revision, earlier revision, stale confirmation, pending-reply rejection, duplicate action delivery, cross-conversation/coach/replaced target rejection, late publication after invalidation, pagination, restart, source deletion and reward replay. B owns native lifecycle cases; C owns frontend interaction/presentation cases. A provider-fixture test proves local behavior, not a live provider result.

### B internal (wave 1): focus into prompts

- `LanguageProfile` focus (currently computed in `progression.rs` as `active_focus` / `recommended_focus`) is captured in the turn context.
- It's rendered as the L3 block (coaching plan §7) into the `persona_reply` system prompt and the `coach_feedback` / `coach_suggestions` prompts. With no focus, the block is absent.
- Snapshot tests cover both cases.

## Wave 2 — integration decisions

The user checkpointed wave one and authorized wave two. Wave two uses fresh schema v14 for durable conversation openings; schema v13 remains the wave-one checkpoint. Older development data may be reset under the existing authorization, with no migration. Configuration belongs to the learner: first startup seeds bundled YAML into `config/` beside the workspace database only when that directory is absent. Existing incomplete or invalid configuration is a blocking `config_load` startup refusal with an actionable path/message; it is never replaced by bundled defaults and does not offer database deletion as a remedy. Native initialization completes before opening the store or loading frontend projections. Restart reloads edits; no hot reload is promised.

Language resolution, construct and policy hashes are captured with accepted work. Language context resolves universal → ordered traits → language → variety, by scope, including the explanation language. Candidate selection is deterministic and preserves focus/prerequisites and mandatory function/interaction constructs; the 15–25 size is a target, not permission to silently omit required candidates. Missing IDs/citations, invalid references and cycles fail validation.

`StartConversation` carries the reviewed global snapshot revision. Partner-first starts require an empty conversation and no pending work, and create a real `persona_opening` without a learner message. Described topics retain assistance provenance and earn no skill credit. Mechanical cards are local; AI coach-openers remain wave three. The composer remains usable without selecting a card.

`CoachControl` provides durable, idempotent local Open card, Show answer and Keep going choices with the reviewed revision. The card is shown only after `open_card` acknowledges disclosure. `CoachDecision.exposedMove` starts null and resets for a new rung; editing directly does not silently count a hint as shown. Retry support records this exposure separately from the selected correction. Only the policy-approved correction text crosses into the displayed card; an unrevealed target hypothesis remains private. A revision with an active prior correction captures that exact item and shown move for `coach_retry_check`. Fixed notes require validated repair evidence; simply revising is insufficient. Partner replies do not wait for coach analysis, and coaching never blocks continuing.

The Registry is owned by each Store; runtime language projections and prompts use that workspace instance. Explicit bundled helpers serve contract export and standalone tests. Candidate selection now takes the difficulty band explicitly, and starter reasons are resolved from localized YAML.

The initial observation also provides explanation-language elicitation and metalinguistic cues alongside its hint and private target hypothesis. Policy chooses among these saved cues without another inference call. Exact target leakage in cues is rejected; this structural check cannot prove semantic hint quality. Retry checks return their own `meaning_recovered`; repairing a form does not imply fully recovered meaning.

B publishes the generated action, snapshot and safe observation/decision shapes for C. Full observation persistence and the frontend projection may differ to protect graduated help; these distinctions must be reported in the handback. Wave-three support-weighted XP and proficiency estimation remain deferred.


| Contract | Provider → consumer | Shape |
|---|---|---|
| `LanguageContext::resolve(language, variety, explanation) -> LanguageContext`; `.guidance(scope) -> Vec<String>`; `.hash()` | A → B | resolution order universal → traits → language → variety, by scope (§4) |
| `Constructs::candidates(ctx, focus, due, tokens) -> Vec<ConstructRef>`; `Constructs::get(id)`; `.hash()` | A → B | §6.2 candidate rule |
| `Policy::feedback() / estimator() / game()` | A → B | typed from YAML (§6.4, §11.6) |
| `starters(ctx, band, focus, contact_tags, recent) -> Vec<Starter>` | A (data) → B (selection) | §10.3 |
| Startup `ConfigLoadError` → `StartupState.refusal` with `config_load` | A → B → C | blocking error screen before normal stores mount; fix files and restart |
| `StartConversation { conversation_id, opening: Opening }`; `persona_opening` op | B → C | §10.4; Surprise reveals only when asked |
| `CoachObservation`, `CoachDecision`, `Correction`, chip state | B → C | §6.3, §8.2 |

## Wave 3 (sketch)

| Contract | Provider → consumer |
|---|---|
| `ConstructState`, `LearnerState` export | B → C |
| `RewardEvent { kind, tier, xp, copy_params, cause }` | B → C (presentation per `game.yaml`) |
| `FluencyRecord` per learner message (regions, pauses, clipped words, removed words) | B → C |
| `OpenerSet`, `SessionReview` | B → C |

### Wave 3 foundation: implemented native seam

`get_learner_state(target)` returns generated `LearnerState` / `ConstructState`
types. `export_learner_state(target)` returns YAML with retained evidence
projections, focus/exclusion choices, derived states, timestamps and registry /
estimator hashes. No inference, XP change or evidence mutation occurs on read.
The evidence and choices retain the existing JSON projection shape (typed as
unknown in the new contract); construct state is explicitly typed.

State is scoped to learner, language, variety and construct. Uncertain and
not-observed outcomes, excluded attempts, registry mismatches and future records
make no update. Registry mismatches remain in exported observations. Repeated
exact wording after whitespace normalization does not add independent evidence.
Time affects review due / heuristic recall only, never rating or XP. Numeric
uncertainty is an evidence-weight heuristic, not a calibrated probability or
confidence interval; calibration is explicitly labeled. No CEFR bands are emitted.

`config/policy/estimator.yaml` is required, validated, seeded on fresh startup,
and included in configuration provenance. An existing configuration needs this
file explicitly installed; missing/invalid files still refuse startup.

### Partner-scoped profile seam

`get_learner_profile(target, personaId?)` returns `{evidence, model, partners,
scope, constructLenses}`. `scope` echoes `{languageId, personaId}`; null means all
partners. `partners` contains `{personaId, name, archived}` for owned contacts with
retained conversations in that language. `constructLenses` maps registry construct
IDs to lens IDs. These labels organize evidence; they do not create aggregate
proficiency scores.

Native code selects conversation IDs by durable partner identity and filters source
records before folding estimates, under one store lock. The returned records and
model are partner-scoped; the existing evidence profile totals, choices and
conversation count remain language-wide. Exclusion still affects the whole
attempt. YAML export remains language-wide regardless of profile view filters.
Consumers validate the echoed scope and discard late responses after switching.

### Wave 3 reward foundation

Accepted learner turns capture `gamePolicy` and `gamePolicyHash`. Validated
observation publication saves `rewardEvents` in the same transaction. Each
generated `RewardEvent` names its attempt, construct, exact quote, cause, tier,
XP, support, difficulty, novelty, policy hash, timestamp and presentation claim.
Current causes are construct_discovered, repair and xp_tick. No reward is
created by a read, elapsed time, a login, a message count or coach prose.

`claim_reward_events(target, ids)` atomically marks and returns previously
unclaimed events for that language (maximum 100 IDs). UI claims before presenting;
repeat claims and restart cannot replay the event. This is at-most-once display:
a crash after claiming may omit celebration but never removes earned XP.

Practice scoring rules version 2 reads saved awards instead of recomputing 10/2
credit. The UI can still read version-1 snapshots from the running prior binary.
New game configuration does not revalue saved events. Whole-message wording is
normalized for whitespace/case and awarded once per learner/language/construct.
Novelty is first accepted award, first award in a Monday-based UTC week, or routine.
XP is rounded to the nearest whole number. Exclusions and explicit source deletion
remove those contributions from active totals; time and policy edits never do.
No retroactive awards are synthesized for earlier exchanges lacking this policy.

Reward effects, secured constructs, goals and partner milestones remain subsequent
work; the structural event tier does not claim their presentation is implemented.

### Latest-message editing and feedback labels (2026-09-13)

A workspace revision can advance when coaching, disclosure or rewards change.
`ReviseTurn` accepts an older workspace revision for the current latest exchange
when no later turn would be removed. Current-version ownership and pending-reply
checks remain transactional. A suffix edit still requires a current reviewed
revision, and superseded targets remain invalid. This prevents background work
from making a normal edit look like a history conflict.

The learner-facing chip is “Feedback” for every available observation; it is not
a pass/fail badge. “Feedback failed” describes a generation failure only. Editing
is labelled “Edit message.” Persona prompt v8 explicitly distinguishes a learner
answer from a question and forbids answering the partner's own previous question;
coach observation prompt v5 requests descriptive, nonjudgmental wording.

## Explicit lesson contract

- `generateLesson` accepts conversation identity, reviewed workspace revision,
  category (`practical`, `grammar`, `aboutLanguage`, `reading`), topic and nullable native choice ID. A selected choice is checked against current
  suggestions and its skill/situation guidance is captured; a custom request uses
  no choice ID. Only the selected lesson runs inference.
- `controlLesson` supports `open`, `practice` and `end`; `askLessonCoach` binds a
  private question or optional exercise attempt to the selected saved lesson.
- Conversation snapshots expose lesson choices and saved lesson views. Plans
  contain an objective, explanation, exactly two examples with translation and
  optional reading aids, exercise, private feedback guidance, situation and
  completion criteria, and exactly two quiz questions with three distinct options, a zero-based correct option and explanation. No provider JSON reaches the UI before validation.
- `lesson_generate` uses a dedicated context/generation operation graph.
  `lesson_review` is conditional on active practice and depends on the contact
  reply. Both use the existing admission, route, receipt, pause and failure rules.
- A handoff is an assistant-only contact turn. Subsequent contact context includes
  the task situation/objective; selected-lesson coach context includes the teaching
  material. Viewing content is recorded before revealing it; each opening marks
  the next learner send assisted, and active practice marks its learner sends
  assisted. Accepted turns retain the contributing lesson IDs. Reading and private
  exercise attempts create no assessment events.
- Completion requires 1–3 exact quotes from actual current learner messages in the
  bounded post-handoff exchange. End/replacement cancels outstanding reviews;
  duplicate or late results cannot repeat a recap. Removed/revised evidence hides
  its recap. Independent lesson content survives a chat revision, while dependent
  practice and private coach turns follow the existing suffix deletion rules.
- Saved lessons are conversation-owned turn-context records, capped at 100 per
  conversation. Reopening does not generate or hand off again. Difficulty/variety/
  explanation-language changes require a fresh lesson before its first handoff.
  Subsequent turns always retain the current difficulty ceiling.

- `answerLessonQuiz` accepts conversation/lesson identity, question index and option
  index. The native transaction validates ownership and indices and grades against
  the saved plan. A repeated identical answer is idempotent; changing an answered
  question is rejected. It makes no provider call. Answers remain with the lesson
  across restarts and history revisions and are removed with the conversation.
- `profile.quiz_credits` projects this separate, conversation-scoped 0/1 XP ledger.
  Total XP includes it; skill credits, construct evidence and learner estimates do
  not. Quiz outcomes are not proficiency observations. The quiz never gates chat.
- Generation prompt version `lesson-3` captures category and requires bounded quiz
  content. Invalid question counts, duplicate options or invalid answer indices
  fail generation before publication.

- Reading generation explicitly receives `nativeLanguage` from the captured
  conversation `explanationLanguage`, the UI's Native selector. It never derives
  learner sound comparisons from UI locale or assumes English. Existing saved
  lesson context and changed-explanation-language handoff checks remain in force.

### Mystery partner discovery — 14 September design pass

The user confirmed distinct guess and reveal actions. `guessMystery` validates the
active partner and persona revision, stores a correct field once per partner and
awards 1 XP, matching lesson recall quizzes. Wrong guesses are retryable with no
penalty. `revealMystery` only reveals a previously correct field and cannot pay XP.
`dismissMysteryNudge` is conversation-scoped; discovery state and XP are
partner-scoped. A discovered fact is stable across later persona edits.

`ConversationSnapshot.mystery` projects `hidden | guessed_unrevealed | revealed`.
Only revealed rows carry the display value. `profile.mystery_credits` contributes
to total XP without adding observations, construct estimates or skill credit.
Deleting a conversation clears the award's conversation attribution; partner
ownership retains the award. Deleting that partner deletes its discoveries.

The frontend uses DetailDialog for the guess, existing sound controls for the
correct-answer cue and separate reduced-motion-aware reveal animation. This does
not change the language-evidence RewardEvent policy or claim behavior. The +3 XP
shown in the supplied design is illustrative; the implemented award is 1 XP.
