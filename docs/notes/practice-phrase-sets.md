# Practice phrase sets

Status: implemented and verified in source, automated tests and an offline browser fixture, 2026-09-30. A native application session was not launched. Linguistic speaker review remains pending.

## Workflow revision: explicit selection

The user revised the workflow after the initial implementation below. This section
supersedes its automatic-import behavior and verification claims for that behavior.
Both dialogs now load authored sets into the shared candidate list. Loading is
read-only; cards are created only by an explicit Keep or Keep all action. Choosing
a starter set closes onboarding and opens the full Add practice cards dialog with
those candidates already in its working list. Onboarding has no candidate picker.
The general dialog appends authored candidates alongside generated candidates,
and repeat selection of a set refreshes that set rather than duplicating its list.
The two requested introductory text lines were removed without replacement.

Native previews derive stable candidate IDs from the bank fingerprint, reading
scope, set and ordinal. They require no preview database rows or schema changes.
Acceptance revalidates these IDs against current authored content, saves only the
selected phrases in a transaction, and retains bundled provenance. Existing cards
remain untouched. The previous whole-set import command and result contract were
removed. Native tests cover zero writes on preview, selected-only acceptance,
repeat acceptance, stale/foreign IDs, rollback, and script/variety preservation.
UI regression tests cover mixed generated/authored lists and explicit Keep in
both dialogs.

Earlier selection-revision verification (before the funnel and sixth-set changes): all three native bundled-set tests and all 78 targeted UI
and command-registration tests passed. UI and preview TypeScript checks passed.
The offline browser fixture confirmed that selecting Social saves nothing,
keeping one candidate creates exactly one card, and closing the general dialog
after loading Beginner leaves that one-card collection unchanged. Both removed
text lines are absent. Fast validation passed localization, diagnostic policy,
styles and all 13 tooling tests; its Rust formatting gate failed on unrelated
concurrent edits in the model-comparison test files. Those edits were preserved.

## Sixth set and onboarding funnel

Implemented: `idiomatic` is the sixth required set in every language and complete
variety replacement bank. Eight phrases were added to each of the 18 default
banks and the Modern Standard Arabic bank: 152 new entries, 1,043 total authored
entries across all six categories. These totals include cross-set overlap.
[Research sources and review limits](practice-idioms-sources.md) record the online
checks for every language. Speaker review remains pending.

The six starter cards occupy the same two-column grid; Social no longer spans
the full row. All six actions are available beside generation controls, with
localized labels in all seven interface locales. Selecting a starter closes
onboarding and initializes the full generator's working list. Sample bubbles
have no direct-save action, so onboarding remains a funnel into the picker.
Missing idiomatic banks fail validation, and idiomatic remains a set category,
not a difficulty. Rust exports own the updated schema and UI contract.

Verification for this revision: 51 configuration tests, three native bundled
preview/acceptance tests and 78 targeted UI tests passed. UI and preview
TypeScript checks and fast validation passed, including formatting and all
seven localization catalogs. The offline browser fixture showed six cards in
three rows, opened the complete generator from Idiomatic, saved nothing on
dismissal, and saved exactly one card after one explicit Keep. Persistence was
mocked; no native application session was launched.

## Presentation cleanup

Implemented: the shared dark-theme `shadow-floating` token supplies a light edge
and soft halo for floating surfaces. Light-theme elevation is unchanged. The
general generator puts authored sets in a collapsed, localized “Show pre-generated
phrases” disclosure. Keep all and the instructional hint share one row; the
hint's icon has no button-like border or background. Empty request captions no
longer reserve a row. Nineteen generator tests and fast validation passed, and
the dark browser fixture was inspected.

Follow-up presentation revision: increased the shared dark halo and edge opacity;
the disclosure now uses the standard blue outline button with an opening/closing
chevron. Local set buttons use separate level and theme rows, with Social then
Idiomatic on the second row at desktop widths. Conversation extraction no longer
renders its shortfall notice or source caption above the list; underlying response
metadata and per-card provenance are retained. Generation shortfalls still render.
Twenty-two targeted UI tests and fast validation passed; the revised dark layout
and expanded button rows were checked in the offline browser fixture.

Subsequently authorized and implemented: picker-wide “Show all translations” and
“Show all pronunciations / romanizations” controls. These are local to the open
picker; global preferences are unchanged. Explicit enablement requests missing
aids through the existing reading service. The initial two-request queue was
removed at the user's request: all missing aids now dispatch concurrently.
These remain individual reading requests, not one combined provider batch;
each result displays when it completes, with independent failure and retry.
Phonetic aids use word-gloss results and the declared romanization capability,
without also opening word meanings. Known aids are reused. New candidates follow
the enabled choices, and individual controls remain available. Disablement,
source replacement and unmount cancel the corresponding outstanding work;
late results are ignored. Per-card loading and detailed errors/retry remain in
the shared reading controls. No new native command or automatic retry was added.

Initial bulk verification: 51 focused component, picker and queue tests passed, covering
known/missing aids, reuse, individual overrides, cancellation, stale completion,
source changes, pronunciation fallback, explicit retry and queue limits. UI and
preview TypeScript checks and fast validation passed. An offline dark browser
fixture showed both aids across eight candidate cards; no live provider request
or native application run was used for this verification.

Concurrency/presentation follow-up: 22 picker tests and fast validation passed.
The concurrency regression holds every response pending and confirms all eight
translation requests start, then all eight phonetic requests start; turning each
toggle off aborts its requests. The removed queue and its test were deleted.
The phrase disclosure uses neutral button styling while open, restores blue
when closed, and indents its child buttons using logical inline spacing.

## Historical initial implementation (superseded by revisions above)

The remaining sections preserve the original five-set, direct-import plan and
its verification record. Current behavior is described above and in content/README.md.

### Initial audit

The first-visit Practice dialog (`QuickStart`) offers four difficulty buttons. Each calls the AI Drill preview for eight short phrases and accepts every new candidate. Only Absolute zero displays an authored sample: `conversation.greeting` from the language configuration. The general `AddPhrases` dialog offers AI generation and lines from past conversations, with no authored-set action. A typed card can be created directly, but that path does not import a set or skip existing cards.

## Stages

Stages 1–4 are implemented. Stage 5 has passed the automated and browser checks below; running-native verification is not claimed.

1. **Authored content contract.** Add five ordered phrase sets to each language document: `absolute_zero`, `beginner`, `intermediate`, `advanced`, and `social`. Require at least eight nonempty, bounded phrases per set in bundled configuration, reject duplicate phrases within a set, and keep the original text intact. Mark linguistic review status honestly. The sets are target-language display content, separate from learning goal tokens and generated candidates. Variety-specific additions require an actual usage need and a separate review.
2. **Curate the 18 language banks.** Add at least eight phrases to every set in every supported language. Use short, usable first-lesson utterances at Absolute zero and increasingly flexible complete utterances at the other levels. Social holds greetings, leave-taking, thanks, apologies and similar exchanges, even if a phrase overlaps a difficulty set. Review each language's default variety, register and script. Language data remains an authored draft until speaker review.
3. **Native mechanical import.** Add one command that takes a reading scope and set ID, resolves the selected language and variety, and inserts only missing phrases in a transaction. Return the new cards in authored order and counts for already-present phrases. Do not call an AI provider or create a generation receipt. Repeat clicks must not create duplicate active cards. Keep source provenance distinct from user-typed and generated cards.
4. **Practice surfaces.** Use authored samples in the first-visit dialog and show a Social set alongside the four levels. Its buttons import sets immediately. Add the same five set buttons to `Add practice cards`, grouped beside the existing generation controls. Show an accurate result when all cards already exist. Keep level and Social semantics separate: Social is a theme, not a fifth difficulty.
5. **Verification.** Check schema export, loading failures for missing/invalid sets, representative scripts and encodings, duplicate/transaction behavior, command registration and generated contracts, both UI entry points, and relevant UI/native checks. Verify the running flow separately if a native app session is available. No data migration is needed for added source content.

## Ownership decisions

- The language document owns the source phrases. Native configuration validates them; Drill owns card insertion and provenance. UI reads the authored sample and invokes the native import.
- A phrase is stored exactly as authored. Duplicate detection is scoped to active cards for the same target language and variety. Bundled import and generated-candidate acceptance share `previews::existing_item`, which uses exact text equality. It does not apply the lossy speech-comparison normalization to authored content.
- Explanation-language translations are outside this first import contract: Drill cards store target text and existing reading assistance handles explanations. An English gloss should never be shown as though it matched an arbitrary selected explanation language.
- If a language lacks a structurally complete bank, startup fails with a precise config error instead of silently switching to AI generation. `needs_review` content is allowed, just as for existing teaching drafts.

## Implemented content and behavior

- All 18 language documents have four difficulty sets of eight phrases and a social set of 14–16 phrases. There are 843 default-bank entries and 48 additional Modern Standard Arabic entries, for 891 authored entries. Cross-set overlap is permitted; these counts do not claim globally unique strings.
- Beginner and Intermediate reuse appropriate examples already authored in current skill guides, preferring selected-variety examples. Absolute zero, Advanced and Social were authored for these banks. All banks retain `review: needs_review`; no independent linguistic review is claimed.
- `practice.sets` supplies the language bank. `practice.varieties` supplies complete declarative replacements when needed. The shared native resolver selects a bank and returns five summaries with actual counts and the first phrase as each sample.
- Arabic's Levantine default and Modern Standard bank require different wording: for example, `شو هاد؟` and `ما هذا؟`. Shared text or a script/Unicode capability cannot express this difference in vocabulary and register. The replacement stays in the language document; there is no Arabic branch in native or UI code. The temporary authoring script was removed after writing the language files.
- Both dialogs use `PracticeSets`. The initial popup shows all five samples; Social occupies a separate full-width card. The general add dialog shows compact local-add buttons above the generation form. Counts come from configuration, and AI generation remains an explicit separate action.
- Native `add_practice_set` validates scope and imports missing cards in one transaction, with no preview or generation receipt. A repeated import returns an existing card ID so the initial popup can still open a card. A failed transaction adds nothing.
- Source kind `bundled` retains the set and content fingerprint, and the shared provenance tip shows the included set. Existing attempts and source records are preserved when a card is skipped.
- UI text was added in all seven interface locales, and obsolete fixed-count keys were removed. Contracts and the language schema were regenerated from Rust.

## Verification results

- Configuration suite: 51 tests passed, including missing sets, bounds, invalid text, duplicate entries, unknown varieties, authored encoding preservation, and every language/variety's samples.
- Drill suite: 41 tests passed, including atomic rollback, repeated imports, existing-card skips, script preservation, variety resolution, and absence of generation records.
- Targeted UI and IPC suites: 78 tests passed across `DrillPage`, `AddPhrases`, `PracticeSets`, and command registration. These cover real starter-to-card wiring, social imports, all-existing results, loading/import failures, retry, repeated clicks and dismissal during an import.
- UI and preview TypeScript checks passed. The native content inspector loaded all 18 languages. Schema export passed. Fast validation passed (formatting, localization, diagnostic policy, style manifest/tokens, and validation-tool tests).
- Offline browser fixture using the actual Spanish bank: five samples shown; Social adds 15 cards and selects the first; repeating Social in the general dialog reports 0 added and 15 already present. Desktop and 390px layouts inspected. This fixture uses mocked persistence and is distinct from a native application run.
- Changes remain uncommitted. Unrelated concurrent changes were preserved.

## Open review

- Speaker review of authored phrases, especially Arabic varieties, Irish, Malayalam and register-sensitive Asian languages.
