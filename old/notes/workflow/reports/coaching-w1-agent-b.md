# Wave 1 report · Agent B · Coach & Learner Core

You are **Agent B**, the Coach & Learner Core agent for SkellySpeak's coaching work. You own what the app *does* in Rust: turn plans, coach and persona operations, persistence and native actions. Two other agents work in parallel: A (Language & Config) and C (Experience & Game, frontend). You never talk to them directly; the integration agent coordinates through reports like this one.

## Read first

1. `skellyspeak-docs/docs/coaching-plan.md`: §1, §2, §6, §7 (focus block), §8 (edit & retry).
2. `skellyspeak-docs/docs/coaching-work-plan.md`: your ownership row, the cycle, the house rules, the hand-back template.
3. `skellyspeak-docs/docs/coaching-contracts.md` → **Wave 1**. You consume A's functions and provide `ReviseTurn` and the snapshot fields.
4. `AGENTS.md`, `EXECUTION.md` (the edit rule), `STATE-AND-STORAGE.md`.

## Your files

**Edit only:**

- `src-tauri/src/{coaching,progression,execution,turn_plan,model,store,conversation_prompt}.rs`
- `src-tauri/src/schema.sql`
- `src-tauri/src/bin/export-contracts.rs`
- new Rust modules you create
- their tests

`languages.rs` and `adapter.rs` belong to A. Frontend files belong to C.

**Integration update:** read `workflow/reports/coaching-w1-integration.md` and the contracts' Revision integration requirements. You own the bounded `src/assets/skill-catalogs/catalog.json` correction and any new revision SQL. C owns `src/domain/skills/**`, `src/types.ts` and the conversation presentation adapter; send their needed changes in your hand-back. The user explicitly authorizes erasing all SkellySpeak development user data as needed. No migration, preservation or repeat data-reset approval is required. Report any actual reset; coordinate workspace ownership and native runs.

## Background (verified by integration on 2026-09-12; re-check line numbers)

- **Naming:** the partner is `persona` in code (`persona_reply`, `persona_word_gloss`, `persona_system` in `conversation_prompt.rs`).
- **Schema (updated after the audit):** `store.rs` has `SCHEMA_VERSION = 12`. Fresh creation composes the released v11 `schema.sql` with `generation_schema.sql`; the authorized additive 11 → 12 upgrade preserves conversations and generation receipts. Coaching targets **v13**, as specified in `coaching-contracts.md`. This describes the baseline only. The user now authorizes discarding development data: implement v13 directly, with no requirement to retain the v11/v12 upgrade path.
  - `operations UNIQUE(turn_id, kind)`, `messages UNIQUE(turn_id, role)`, and the unique index `one_pending_reply` all hold.
  - `turns` has no parent link.
- **`coaching.rs`:**
  - `:144` is the `coach_feedback` task text. It contains an Arabic-specific rule ("Never correct spelling, add diacritics, normalize Arabic letters…") inside a generic prompt.
  - `:146` is the `coach_suggestions` task. It says "the standard romanization".
  - The output schema at `:110` and the validation at `:317` allow only `demonstrated | partial | uncertain`, but `src/domain/skills/skills.ts:18` declares five outcomes.
  - `coaching.rs:93` embeds the whole `catalog.json`, which is sent as `skillCriteria`.
- **`progression.rs`:**
  - `:34` hardcodes `"replaces_message_id": null` in evidence records.
  - `:107` hardcodes `"catalog_version": 4`, and no v4 file exists.
  - `active_focus` / `recommended_focus` are computed but never reach a prompt.
- **`catalog.json`:** codes `6.1`, `6.2` and `6.3` sit under the different parents `statements`, `questions` and `opinions`. The catalog file lives in `src/assets` (C's area); you may edit `src/assets/skill-catalogs/catalog.json` for the code fix and the version, and should report it.
- **Edit & retry** is dead end to end: the frontend rejects `replacesMessageId`, and Rust has no action for it.

## Tasks

1. **Use A's functions** (per the contracts) in `coaching.rs`:
   - `coach_suggestions` appends `romanization_guidance(target)` instead of "the standard romanization",
   - `coach_feedback` appends `assessment_guidance(target)`,
   - delete the Arabic rule from the generic text (A hands you the exact moved text; until A lands, code against the contract signature).
   - Guard test: for each language with a scheme, the resolved prompts contain the guidance text; Latin-script prompts contain no romanization rules.
2. **Five outcomes.** Add a Rust `Outcome` enum (five values, as in the contracts), exported via ts-rs, used in the schema enum and validation. Decide the prompt wording for when each applies. Document the estimator semantics in a doc comment.
3. **Catalog.** Renumber the codes so they match their hierarchy. Make the catalog version real: either derive it from a content hash, or name the embedded file by its version and use that constant everywhere. Update the evidence filter semantics accordingly, and tell C if anything there changes.
4. **Focus into prompts.** Capture focus in the turn context, and render the §7 L3 block into `persona_system` and the coach prompts; with no focus, there's no block. Snapshot tests for both cases.
5. **Planned schema v13 + `ReviseTurn`.**
   - Add `turns.replaces_turn_id` (nullable FK), with effective `user_version` and `SCHEMA_VERSION` both 13. You may replace the historical base/upgrade composition with a clean current schema and update its tests. Existing user data need not survive. Verify fresh creation, correct schema validation, restart and revision lifecycle; retain the current generation-receipt feature for new data. Do not silently reset a production workspace on startup failure.
   - Add the `Action::ReviseTurn` behaviour exactly as in the contracts, including the earlier-turn removal per EXECUTION.md, the typed error while a turn is pending, and `revision = true` set in Rust.
   - Populate `replaces_message_id` in `progression.rs` from `replaces_turn_id`.
   - Expose `replacesTurnId` / `replacedBy` in the snapshot.
   - Regenerate contracts.
   - Tests:
     - revise latest → new turn and persona regenerates,
     - revise earlier → later turns removed,
     - revise while pending → typed error,
     - evidence carries `replaces_message_id` and `revision`.
6. **Milestone order:** land the `ReviseTurn` contract and snapshot types first (C builds against them), then the rest.

7. **Integration cases:** add durable message-to-turn identity, stale-confirmation protection, repeated revision-chain handling and bounded earlier-version retrieval under the revised contracts. Verify exact suffix removal, retained-chain evidence, source invalidation and idempotency. Confirm native 2-XP revision credit, deduplication and exclusions in the hand-back so C can remove the blanket reward exclusion. Generated API delivery is a milestone, not evidence that persistence/execution is complete.

## Paid inference

None is needed this wave. All tests are snapshot and fixture based.

## Done means

- The gate passes, and `export-contracts --check` is clean after regeneration.
- The tests above exist.
- Hand-back in the template format, listing any contract drift (field names, error codes) so C and the contracts doc can be updated.
