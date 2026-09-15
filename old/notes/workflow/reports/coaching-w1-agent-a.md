# Wave 1 report · Agent A · Language & Config

You are **Agent A**, the Language & Config agent for SkellySpeak's coaching work. You own what the app *knows* about languages. Two other agents work in parallel: B (Coach & Learner Core, Rust) and C (Experience & Game, frontend). You never talk to them directly; the integration agent coordinates through reports like this one.

## Read first

1. `skellyspeak-docs/docs/coaching-plan.md`: §1 (what we're building), §4 (language layer), §12 (bibliography).
2. `skellyspeak-docs/docs/coaching-work-plan.md`: your ownership row, the cycle, the house rules, the hand-back template.
3. `skellyspeak-docs/docs/coaching-contracts.md` → **Wave 1 · A → B**. You provide these functions.
4. `AGENTS.md`, and the README verification commands.

## Your files

**Edit only:**

- `src-tauri/src/languages.rs`
- `src-tauri/src/linguistics/adapter.rs` (prompt text and romanization injection only)
- `src/domain/language/**`
- `references.bib`
- new test files for these

Anything else goes into a change request. In particular, `coaching.rs` belongs to B: B will call your functions there.

**Integration update:** `src/domain/language/conversation-view.ts` and its tests are reserved for C's revision grouping work. Your domain ownership excludes those two files this wave. Read `workflow/reports/coaching-w1-integration.md` before starting.

## Background (verified by integration on 2026-09-12; re-check line numbers)

- `languages.rs` declares `romanization: Some("ALA-LC")` for `ar` and `Some("PINYIN")` for `zh`, but there is **no accessor**. Its public functions are `registry`, `language`, `writing_guidance`, `validate_settings` and `defaults`. Nothing sends the scheme to a model.
- `linguistics/adapter.rs:320` (`INSTRUCTIONS`) says "tone-marked Hanyu Pinyin for Chinese or standard romanization for other non-Latin scripts". The generic wording produces plain-ASCII Arabic romanization. That's the bug the user reported.
- `src/domain/language/sentences.ts:6`: `TERMINAL_PUNCT = /[.!?…。！？]$/` lacks `؟` (U+061F).
- `references.bib` is at the repo root (about 55 entries, with custom fields `review`, `claim`, `used-by`).

## Tasks

1. **Scheme registry.** In `languages.rs`, add `RomanizationScheme` and the functions `romanization`, `romanization_guidance` and `assessment_guidance`, exactly as in the contracts.
   - Scheme ids are table-level: `ala-lc-arabic`, `pinyin`. Update the `Language` table to reference ids, and keep the frontend projection field carrying the id.
   - Verify the named ALA-LC Arabic scheme against its primary published table before writing instructions. Cover long vowels, marked consonants, ʿayn/hamza, digraphs, article treatment, tāʾ marbūṭa and case endings where that scheme specifies them. The original brief's assumed article assimilation and symbols are checks to resolve, not authority to mislabel a hybrid scheme. Report any correction to the proposed guidance and cite the table in `references.bib`.
   - Add **at least 5 examples** covering those hard cases.
   - Do the same for `pinyin`: tone marks always, never tone numbers or toneless.
   - Mark each scheme's content `needs_review` in a comment. The project lead validates Spanish, Arabic and Chinese.
   - Cite `sources` keys. Add any new references to `references.bib` with `review = {abstract}` and a `claim`.
2. **Assessment guidance.** Move the Arabic assessment rule into `assessment_guidance("ar")`: never add diacritics, normalize letters, correct spelling in quoted evidence, or translate quotes. Hand B the exact text. B deletes it from `coaching.rs:144` and calls your function.
3. **Gloss adapter.** In `adapter.rs`, replace the generic romanization phrase: the prompt builder appends `romanization_guidance(target)` when present. Bump the adapter template id.
4. **`؟`.** Add U+061F to `TERMINAL_PUNCT`, with a test on an Arabic question.
5. **Citation test.** Parse `references.bib` (a small parser is fine; no heavy dependency) and fail if any entry lacks `url`/`doi`, `review` or `claim`, or if keys are duplicated. For now, also check every `sources` key used in `languages.rs` against the bib.
6. **Tests:** the contract tests listed under "A → B", plus a prompt snapshot for an Arabic gloss that contains the ALA-LC text.

## Optional live check (paid, bounded)

If you want to confirm the fix end to end: at most **6 requests**, Fast binding, 3 Arabic and 3 Chinese passages through the gloss operation. Report the romanized output verbatim and whether diacritics and tone marks appear. State the budget before you run it.

## Done means

- The gate passes (see the work plan).
- The contract functions exist with tests.
- The Arabic gloss prompt contains the ALA-LC rules.
- `؟` ends a sentence group.
- The citation test runs in `cargo test` (or `npm test`, if you write it in TS; say which).
- Hand-back in the template format, including the **exact assessment-guidance text** for B, and any contract drift.
