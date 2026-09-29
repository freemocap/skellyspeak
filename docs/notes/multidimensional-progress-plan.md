# Skill XP and effort progress tracks

Status: implemented in source on `effort-xp`; uncommitted. Native application and device checks are still outstanding. No deployment or workspace reset has been performed.

## Agreed product behavior

Keep two separate tracks:

- **Skill XP:** existing credit for observed language-skill use, attached to named skills. This is not a mastery certificate or a guarantee of error-free execution. Existing credit and recommendation policies are unchanged.
- **Effort:** four independent counters. Do not add them together, convert them into skill XP, or introduce a performance track, success percentages, bonuses or penalties.

| Counter | Unit |
| --- | --- |
| 🙂 Partner understood | One learner-message revision with a validated understood reaction. |
| 🛠️ Revisions sent | One accepted edit-and-resend with changed text. Opening Edit, draft changes and unchanged resends do not count. |
| 💪 Practice attempts | One distinct successful recording with speech and a roughly aligned transcript. Perfection and an available accuracy score are unnecessary. |
| 👍 No issues flagged | One completed coach assessment with full recovered meaning, no uncertain repair, no corrections or partial/not-demonstrated items, and no validation/display omissions. Ratings alone and absent, pending or failed feedback do not qualify. |

A source can qualify for several dimensions independently. Repeated genuine recordings and changed revisions count. A retry, duplicate delivery, reprocessing or policy-version change cannot count the same source/dimension twice.

The understood and no-issues counters are outcome-conditioned; grouping them under Effort is the learner's product choice, not a claim that they measure effort alone. Their absence does not mean no effort occurred. These decisions are not presented as a universal pedagogical consensus.

## Lifetime retention decision

The learner explicitly chose to retain earned counts when messages, conversations, recordings, attempts or practice items are deleted. Awards are append-only lifetime records with detached source IDs, not cascading source-owned children. A later revision, reassessment or source cleanup does not revoke an earned unit. There is no correction/retraction ledger or rollback of previously earned totals.

New counters begin with qualifying publications after this feature is installed. There is no automatic historical recount. Full Factory Reset clears the workspace, including lifetime effort. Ordinary source deletion does not.

## Implemented ownership and persistence

`native/src/learning/effort/` owns deterministic qualification, typed awards, aggregation and presentation claims. The `effort_awards` table stores one unit per unique dimension/source identity, language, captured variety, applicable conversation, inclusion-policy version and publication time. It does not copy messages, transcripts or audio. Conversation IDs and source IDs may refer to deleted records; they are provenance, not promised navigable links.

- Accepted revision credit uses the replacement turn identity and compares retained source text, trimming only outer whitespace.
- Message outcomes use their owning turn/revision identity, not the inference attempt or currently selected bubble.
- Practice credit uses the successful recording receipt identity, so deleting/reprocessing a saved attempt cannot mint another unit.
- Every hook borrows the source transaction. Rollback removes both source publication and its new award.
- Reads aggregate the ledger; they never create awards. Read results include the latest 100 award records. The first UI pass displays the latest 20 with dimension and time.
- Presentation claims are atomic and independent of totals. A missed animation, disabled effects, claim failure or crash cannot remove earned credit. A crash after claiming may omit an effect, as with existing skill rewards.

The existing skill XP ledger remains separate. No fake skill identifiers or general-effort values were added to skill evidence. Explore, ContinuePracticing and CoachChoice are unchanged; their existing skill-specific experience/effort fields are different from these new counters. Recent-practice recommendations remain a separate future design task.

## Practice inclusion policy

`effort-inclusion-1` requires a validated successful recording receipt, positive detected speech, no explicit no-speech result, nonempty normalized target/transcript and character error rate at most 0.65. This is a permissive initial product heuristic (roughly 35% alignment), not a validated proficiency or pronunciation threshold.

Recognition confidence is independent: missing/low confidence can withhold an accuracy score while an on-target take still earns effort. Skips, unprocessed recordings, silence and clearly unrelated/empty text do not earn credit. Missing comparison/reliability evidence remains unresolved, not assumed successful.

Tests include rough and partial takes, canonical encodings and representative Latin, Arabic, Chinese, Korean and Devanagari text. The existing shared mark-insensitive comparison policy is reused; source text is preserved. No language-specific overrides or new inference calls were introduced. The numerical boundary still needs real learner/device review, especially very short targets, heavy insertions and highly incomplete attempts; it is not claimed to be calibrated.

## Visible presentation (revised after learner review)

The initial report-only placement was rejected: progress must be visible while chatting and practising. The language profile button and conversation XP badge now show XP in its own compartment beside all four effort counters. Effort uses a 2×2 layout at narrow widths; the language badge can use one row on wider screens. The conversation badge retains conversation-scoped XP; effort remains lifetime language totals, identified by its accessible group and tooltip. The language badge and bottom panels show language XP.

Practice has an absolute bottom-right badge over the practice stage, above the recording panel, with no reserved layout row. Clicking it opens a viewport-clamped popup above the badge showing last-seven-day counts and active UTC days. Chat retains its header badge only; its expanded panel keeps descriptive stats above a separately scrolling skill XP ledger. The detailed language report shows lifetime effort, recent activity, active days and averages above cursor-paged history.

One shell-owned read and presentation claim supplies every visible counter. Reports read without claiming, so opening a report cannot consume the visible presentation. Small totals remain exact; large totals use localized compact formatting with full values in tooltips and accessible names. New values highlight and show a brief increment; initial reads, language switches and conversation switches do not invent gains. Reduced motion and the effects preference are respected. One shell sound owner coalesces effort cues; understood-only awards continue to use the existing partner cue.

`ui/tools/progress-preview.html` uses production components with sample data and manual increment controls; it makes no inference requests. Browser review covered Chat/Practice, simultaneous visible updates, large totals and narrow/medium/wide viewports (measured CSS widths 320, 400, 600, 800 and roughly 1067 pixels). This checks presentation; the fixture is not evidence of a live microphone or inference run.

A related incomplete-data display path was corrected: conversation ratings alone no longer produce a Good job badge. Unusable assessment items dropped during validation are counted in retained context and disclosed in feedback notes, preventing an incomplete assessment from qualifying as clean.

## Schema and verification

The current schema is 43. This repository deliberately has no upgrade framework. Existing version-42 development databases are explicitly refused without modification; use the established development reset flow before running the new native build. No automatic reset or data conversion was added, and none was performed during this work.

Automated verification is recorded below after the final checks. Source tests cover ledger uniqueness, language isolation, transaction rollback, restart/claim persistence, actual message publication, revision/conversation deletion, practice attempt deletion/reprocessing and item deletion. UI tests cover incomplete feedback, independent counter display, claim failure and language-switch races.

## Deferred work

- Richer maps, charts, badges, levels, all-language summaries and detailed source navigation.
- Real-device visual/audio review and adjustment of the forgiving practice boundary using actual examples.
- General counters influencing coach recommendation selection.
- Message-specific coach discussion ownership and edit/resend revision-history browsing, deferred explicitly by the learner before this feature.

### Automated results (2026-09-29)

- UI suite: 225 files, 1,447 tests passed.
- UI production build and TypeScript check passed. Build retains the existing large-chunk advisory.
- `npm run check:fast` passed (formatting, localization source/usage, styles, diagnostics policy and validation tooling/tests).
- `npm run contracts:check` passed; generated types and native command registration agree.
- Native library suite with local HTTP fixtures permitted: 702 passed, four ignored live tests, one failed. The remaining failure is `conversations::execution::tests::language_context::focus_is_frozen_for_coaching_without_directing_partner`: its pre-publication fixture expects focus source `learner`, but receives `coach`. It fails before any new award hook runs. Recommendation selection and this assertion were not changed; the full native suite is therefore not reported green.
- New qualification, ledger, actual message publication, practice cleanup/reprocessing and revision-deletion checks passed within that native run.
- `git diff --check` passed. No commits, deployments, native application launch or real-device verification were performed.

### Visible-counter follow-up verification

- Full UI run: 1,449 passing tests and one architecture failure from an initial cross-feature panel import. That import was removed; the panel is now a pure shared component with data supplied by each feature.
- After that correction: 106 targeted tests passed, including architecture boundaries, conversation integration and counter behavior.
- UI production build, preview TypeScript checks, fast checks and diff whitespace checks passed.
- No native persistence policy changed in this presentation pass. No commit or deployment was performed.

### XP report and overlay correction

Observed in development-app diagnostics: opening the report crashed on the missing localization key `english.XP per contributing message`. Added all ten new report labels across seven interface locales and removed the retired Recent effort label.

Implemented the Practice stage overlay and upward-opening portal details, plus fixed summary statistics above the Chat XP ledger scroll area. Existing source-history paging remains independent of lifetime aggregates.

Verified: production UI build; fast localization, style and diagnostic checks; preview TypeScript; 15 targeted report/overlay/boundary tests, plus the earlier 9 report/counter tests; all 13 native effort tests. Browser fixture opens the actual ProgressSummary, PracticeProgress and XpLedger components with explicit sample IPC data. Measured popup bounds at CSS widths 320 and 1200: within the viewport and above the trigger. Native failure diagnosis used the current development run logs; native-window visual verification was unavailable. No commit or deployment.

### Practice badge removed after review

The learner chose to remove the Practice-local XP/effort display entirely. Its overlay, popup, layout wrapper and unused components are removed. The app-shell counters remain visible in Practice; the Chat header counters and stats/scrolling ledger remain unchanged. This supersedes the Practice overlay decision above.

Android device installation: built standalone ARM64 debug APK from the current checkout with version 2.6.4 (versionCode 2006004), installed successfully via ADB on the connected Pixel 9 Pro XL, and launched MainActivity successfully. No existing package with the current app ID was found before installation; no uninstall or data reset was performed. Practice-local badge removed; app-shell and Chat counter tests passed (13 tests), fast checks and preview type-check passed. This is a local device build, not a published release.
