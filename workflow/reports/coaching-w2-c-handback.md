# Wave 2 C handback

Status: frontend implementation and automated checks complete against the generated wave 2 contracts. Native lifecycle verification belongs to B/integration; no claim of provider or linguistic validation.

## Delivered

- `ConversationStart` uses native starter cards and generated Opening choices, with Surprise and described-topic actions. The composer remains live. Beginner phrase insertion appends to the draft and records scaffold assistance. Admission is guarded against duplicates and conversation switches; failed/stale admission retains the described draft and shows the native error.
- `OpeningStatus` renders partner-first activity and failure even before a message exists. Native selected opening hides the starter panel; activity recovery is available through the existing AI activity surface. Empty new conversations scroll to the start panel; actual conversations retain bottom scrolling.
- Message feedback now consumes safe CoachObservationView and CoachDecision. Numeric message grading is removed. The card shows the native hint, optional editing, Show answer and Keep going controls, observable item/count details, factual Fixed notes and unconfirmed repair state. Answers appear only from the native revealed projection. Native fixed text renders verbatim with automatic direction.
- `ConfigurationRefusal` handles generated config_load before the normal startup refusal UI, shows the named error/path, and instructs fixing the file then quitting and reopening. No database reset or ineffective web reload is offered for configuration errors.
- Full construct-registry identity and mapping errors are carried through skill evidence. Acknowledged incompatible observations remain inspectable with their original source, construct IDs, quotes and registry hashes through shared `ui/EvidenceMappingNotice`; they earn no current credit/highlighting. An unacknowledged full-hash mismatch fails explicitly even if numeric fingerprints match. Registry changes reset reward-arrival baselines.
- Database export wording now identifies its database/supporting-file scope and excludes editable configuration files. Factory reset wording explicitly includes configuration. No new export/reset flow was added.

Principal files: guided ConversationStart, OpeningStatus, GuidedPage, CoachEntry, MessageFeedback, TurnView, EditFeedback, ConversationProgress; startup ConfigurationRefusal and StartupRefusal; SkillsPage; ui EvidenceMappingNotice and SaveDataCopy; settings FactoryReset; domain skills projections/index/rewards/evidence/statistics, conversation adapter and types; corresponding tests and scoped styles. Generated contracts and native/catalog/configuration source were not edited by C.

## Contract consumed

Generated Opening/StarterCard, startConversation with global snapshot expectedRevision, CoachControl and coachControl with native turn ID/global revision, safe feedback view plus separate CoachDecision (including repairStatus), required snapshot starterCards/opening, config_load, and generated catalog version. Full target hypotheses remain internal. No second wire union, optimistic correction decision or fabricated learner message is used.

## Verification

- `npm test`: 87 files, 546 tests passed. Includes actual page-handler start/error/draft/switch/pending-opening behavior, card control/reveal/failure/uncertain cases, configuration refusal, registry retention/hash mismatch and shared architecture boundaries.
- `npm run build`: passed (TypeScript and production Vite bundle).
- `npm run styles:check`: passed.
- `git diff --check`: passed.
- Initial full suite exposed a cross-feature import for retained evidence. Corrected by moving the reusable notice to `src/ui`, then reran the full suite; no boundary allowance was added.

Integration performed browser visual inspection of actual production GuidedPage and surrounding header/coach/composer with deterministic test-only native transport in ignored `.local/coaching-w2-qa/`. Reviewed desktop starter/card surfaces, narrow 360px Arabic with large reading size (document and scroll widths both 360), and Fixed-note layout. Contrast, empty-start scrolling and Fixed-note overlap findings were corrected; integration confirmed final note readability and no remaining inspected geometry blocker. This is fixture/browser verification, not an actual native persistence or inference session. Fixture content on disk uses the corrected learner phrase for Fixed mode; the browser had cached an earlier ignored fixture script during one inspection.

No C provider requests, native launches, user-data resets or Git writes. Native restart/persistence, real model quality and language-content validity remain integration/A/B concerns. Configuration linguistic content remains subject to its recorded review status. No unresolved frontend contract request at handback.

## Integration cross-check follow-up

Read-only native/UI audit found global pause updates `snapshot.connection.paused` without changing the per-turn pause flag. Corrected OpeningStatus to honor either flag. The production page regression now exercises pending → global pause → resume → failed opening without learner messages. Focused Vitest run passed (1 selected test; remaining 25 intentionally skipped); diff check passed. This follow-up occurred after the full 546-test C gate above. No native edits were made.

## Durable disclosure follow-up — final C gate

Native `CoachControl.open_card` and `CoachDecision.exposedMove` now distinguish selected coaching from help actually disclosed. Chip and Analysis entries await the local native control before opening an unexposed correction. All CoachEntry correction content requires matching native exposure, including editor feedback and late feedback arriving in an already-open pending-analysis dialog. That late-arrival path offers explicit View coaching help. Pencil editing does not expose a hint automatically. Stale/failed disclosure leaves the hint hidden with an actionable error; neutral observation/Fixed details remain inspectable. Show answer still renders only the returned explicit projection. Test-only browser transport was updated to the same control semantics.

Final post-disclosure verification supersedes the earlier frontend count: **88 files / 551 tests passed**, production build passed, styles check passed, diff check passed. Includes real page handler open_card at reviewed revision followed by show_answer at the next revision; both card entry paths, failed disclosure, late arrival, and editor exposure gates. Build retains the existing large-chunk advisory. No additional visual/native/provider claim is made for this follow-up.
