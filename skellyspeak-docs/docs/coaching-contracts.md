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
    pub instructions: &'static str,   // reviewed prose: diacritics, ʿ/ʾ, sun letters…
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
- Tests (A):
  - every language with a scheme returns `romanization_guidance` containing the scheme label and at least 3 examples,
  - every scheme is referenced by at least one language,
  - every `sources` key exists in `references.bib`.
- Guard test (B, using A's functions): for each language with a scheme, the resolved `persona_word_gloss` and `coach_suggestions` prompts contain `romanization_guidance`'s text; for Latin-script languages, neither prompt mentions romanization rules.

### B → C: revision action and snapshot fields

```rust
// model.rs — new Action variant (kind-tagged like existing actions, e.g. retryGloss)
ReviseTurn {
    turn_id: String,          // the learner turn being revised
    text: String,             // the revised learner text
    input: InputEvidence,     // revision = true is set by Rust, not trusted from the UI
}
```

- **Effect:**
  - Creates a **new turn** with `replaces_turn_id = turn_id`, runs the normal plan (persona reply, coach, glosses) against the revised text, and keeps the replaced turn.
  - Revising the latest turn needs no confirmation.
  - Revising an earlier turn removes the later turns under EXECUTION.md's edit rule. Rust enforces this; the UI confirms first.
  - A pending turn in the conversation rejects the action with a typed error, which C shows.
- **Schema v12:** `turns.replaces_turn_id TEXT NULL REFERENCES turns(id)`. `SCHEMA_VERSION` and `user_version` both become 12, with no upgrade path.
- **Snapshot:**
  - each turn exposes `replacesTurnId: string | null`,
  - the conversation view marks turns that have been replaced (`replacedBy: string | null`),
  - evidence records carry `replaces_message_id` (the replaced turn's learner message) and `input.revision = true`.
- **Outcomes:** the Rust `Outcome` enum has five values: `demonstrated | partial | not_demonstrated | not_observed | uncertain`. It's exported through ts-rs so `skills.ts` uses the generated type. **Semantics for later waves:** `uncertain` and `not_observed` → no estimator update; `not_demonstrated` → negative update.
- **Credit** stays on current XP rules in wave 1. The support-weighted credit arrives with the wave-3 fold. C must remove the `replaces_message_id !== null` exclusion only when B confirms the credit rule, and in wave 1 shows revision rewards under current rules.

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
