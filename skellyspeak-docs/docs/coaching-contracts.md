---
sidebar_position: 7.7
title: Coaching contracts
---

# Coaching contracts

The seams between the three work areas in the [coaching work plan](./coaching-work-plan). Each contract names who provides it, who consumes it, and the wave it lands in. A provider may refine a signature; the change must be reported as **contract drift** in its hand-back and then updated here by the integration agent.

Status: wave 1 contracts are specified; later waves are named and sketched, and get specified at the start of their wave.

## Wave 1

### A → B: language guidance functions (`src-tauri/src/languages.rs`)

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

## Wave 2 (sketch)

| Contract | Provider → consumer | Shape |
|---|---|---|
| `LanguageContext::resolve(language, variety, explanation) -> LanguageContext`; `.guidance(scope) -> Vec<String>`; `.hash()` | A → B | resolution order universal → traits → language → variety, by scope (§4) |
| `Constructs::candidates(ctx, focus, due, tokens) -> Vec<ConstructRef>`; `Constructs::get(id)`; `.hash()` | A → B | §6.2 candidate rule |
| `Policy::feedback() / estimator() / game()` | A → B | typed from YAML (§6.4, §11.6) |
| `starters(ctx, band, focus, contact_tags, recent) -> Vec<Starter>` | A (data) → B (selection) | §10.3 |
| Startup `ConfigLoadError` event | A → B → C | blocking error screen |
| `StartConversation { conversation_id, opening: Opening }`; `persona_opening` op | B → C | §10.4; Surprise reveals only when asked |
| `CoachObservation`, `CoachDecision`, `Correction`, chip state | B → C | §6.3, §8.2 |

## Wave 3 (sketch)

| Contract | Provider → consumer |
|---|---|
| `ConstructState`, `LearnerState` export | B → C |
| `RewardEvent { kind, tier, xp, copy_params, cause }` | B → C (presentation per `game.yaml`) |
| `FluencyRecord` per learner message (regions, pauses, clipped words, removed words) | B → C |
| `OpenerSet`, `SessionReview` | B → C |
