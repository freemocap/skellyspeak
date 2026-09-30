# Skill radar and skill levels: UI ↔ integration handoff

Status: **native integration implemented; UI integration pending**. The branch `skill-radar-levels` holds a
UI prototype built from production components. Nothing on it is released
behaviour. This note is for the integration owner (native/business logic) and the
UI owner to pass questions back and forth; answer inline under each question and
mark it **Answered**.

Integration update: the native implementation is ready for UI wiring; the contract and
handoff in §6 supersede the original API proposals below. Product direction is
one complete native pass, then one UI pass, then integration review/polish.

## 1. What we are building

A per-language progress system drawn as a 12-arm radar ("skill shape").

- **Skill point**: one credited message for one skill. A message can credit
  several skills. XP is unchanged and stays a separate running total.
- **Skill level (per skill)**: Fibonacci thresholds on that skill's points:
  level 1 at 1 point, then 2, 3, 5, 8, 13, 21, 34, 55, 89…
- **Skill level (language)**: the level of the learner's *weakest* skill.
  Level L needs every skill at `threshold(L)` or more.
- **Total XP**: sum of eligible credited XP. Can decrease after exclusion or
  deletion. Sets no level.
- **Level-up**: fires each time a level increases, one step at a time. A
  learner who already has evidence jumps straight to the level they have
  earned, and the UI plays each step's animation in sequence.
- **Replace the old progress presentation.** Preserve workspace history through
  the existing migration chain; no parallel legacy progress display.

**Agreed correction:** XP and current levels can fall after exclusion, deletion
or registry incompatibility. Already claimed milestones never celebrate twice.
Replace the old presentation, but preserve supported workspace history. Durable
celebration receipts require a migration; there is no historical XP recalculation.
Language level 0 means at least one skill has zero credits, not zero credits overall.

## 2. What is on the branch now (UI prototype)

| File | Role |
| --- | --- |
| `ui/src/domain/learning/statistics/skill-levels.ts` (+ test) | Thresholds, `levelFor`, `levelPosition`, and `skillLevels(snapshot)`: counts `snapshot.profile.credits` per skill in catalog order; the language level is the minimum. |
| `ui/src/domain/learning/catalog/skill-domains.ts` | `skillColors(id)`: one jewel tone per catalog skill id (throws on unknown ids). |
| `ui/src/styles/foundations/tokens.css` | `--skill-<id>` / `--skill-<id>-ink` for 12 skills (light + dark), `--skill-radar-core/-mid/-tip`. |
| `ui/src/components/learning/SkillRadar.tsx`, `skill-radar-geometry.ts` | `SkillRadar` (interactive), `SkillRadarGlyph` (language badge), `ConversationShapeGlyph` (conversation badge). |
| `ui/src/features/skills/levels/SkillLevelsPanel.tsx` (+ test) | Level header, radar, focus strip (skill description), filterable skill list, optional conversation overlay. |
| `CoachPanelTabs` / `CoachAnalysisPanel` / `ConversationPage` | Coach panel tabs are now **Coach \| Skills**; Skills shows the panel above existing conversation progress. |
| `app/shell/TopBar.tsx`, `ProgressCounters.tsx` | Top-bar trigger order: skill level (glyph + "Lv N") → language XP → global XP. |
| `features/conversation/progress/XpChip.tsx` | Conversation header: conversation shape glyph + "+N pt" → conversation XP. |
| `domain/localization/locales/*.json` | New UI strings in all 7 locales (machine-drafted; need native review). |
| `ui/tools/skill-levels-preview.{html,tsx}` | Fixture preview of every surface; `?theme=dark`. |

Checks on the branch: `npm run check:fast`, `tsc`, and the affected vitest
suites pass. Full UI suite and `npm run build` not yet run on the final state.
These are the prototype owner's earlier results; current verification is in §7.

## 3. Questions for the integration owner

### Q1. Where do skill points come from? (priority)
The prototype counts `profile.credits` entries per `skill_id`. Please confirm or
correct:
- Does `profile.credits` already exclude learner-excluded attempts, superseded
  records and failed assessments? If not, which filter is authoritative?
- Can one attempt produce two credits for the same skill? (The prototype would
  count both.)
- Should points be computed natively and shipped in the snapshot (e.g.
  `profile.skills[].points` and `profile.skill_level`) so the UI does not
  re-derive them? The UI prefers a native field; `skillLevels()` would then
  only read and validate.

**Answered.** Count the native eligible ledger, once per `(attempt_id, skill_id)`.
Progression filters excluded attempts and mismatched construct registries. Failed
assessments do not publish credits; failed quote attribution does not revoke valid
presence credit. Previously credited revisions remain credited. Invalidated or
superseded attempts cannot publish late results, but existing awards survive.
A changed revision can earn effort for a repeated skill; an unchanged immediate
resend earns none. A separate new message can earn credit even with repeated text.
One observation has at most one credit per skill, currently one XP and one unit
of experience or effort. Preserve historical XP amounts. The native summary is
`profile.levels`; duplicate and unknown credits fail explicitly.
Sources: `native/src/learning/practice.rs`, `rewards/mod.rs`,
`learner/progression.rs`, and their owning tests.

### Q2. Level-up events
The UI needs level changes delivered once, the way skill XP rewards are today
(`claim_reward_events` → `SkillRewards.tsx` → `RewardInspectionContext.arrive`).
Proposal, to confirm or replace:
- Two event kinds: `skill_level` (skill id, from → to) and `language_level`
  (from → to), one event per single-step increase.
- Emitted when a credit changes a level; claimable with the same
  claim/idempotency guarantees as reward events.
- For a learner whose existing evidence already implies level N, emit the
  whole run 1…N (and each skill's run) on first computation so the UI can
  play them in order.
- Ordering key so the UI can sequence skill steps before the language step
  they complete.

**Answered.** Use a separate typed celebration stream and durable receipts. The
existing XP payload requires a skill, source attempt and quote; language catch-up
has none. Preserve XP events unchanged. Both mechanisms provide at-most-once
claims, not guaranteed exactly-once animation: a crash after claiming may omit
presentation. Publication synchronizes inside its owning transaction; explicit
initialization handles catch-up, and ordinary snapshot reads remain read-only.
Each milestone is unique by learner/language/policy/kind/skill/level. Catch-up is
level-ascending, skills in catalog order before each language step; durable
sequence is authoritative. Claimed receipts survive exclusion/deletion. Pending
receipts above current progress are suppressed until evidence recovers. See §6
for payload, commands and the 100-event batch limit.

### Q3. Skill names and descriptions in content
The radar uses each catalog node's `label` and `description`
(already translated). It may need a **short label** per skill for tight
spaces (chips, narrow panel). If we add one, it should live in
`content/shared/skills.yaml` (+ schema + generated catalog + locale keys),
not in UI code. Is that change acceptable, and who owns regenerating the
catalog?

**Answered.** Short labels can wait; use existing labels with wrapping and full
accessible names. If necessary later, shared content/schema/native projection
own authored short labels; UI owns localization/display. Integration regenerates
with `npm run contracts`. No hand edits to generated catalog data.

### Q4. Skill order and colour stability
Arm order and the colour map follow catalog order and skill ids. If the
catalog changes (ids added/removed/reordered), `skillColors` throws for
unknown ids by design. Should skill colour live in content config (next to
the skill) instead of UI tokens?

**Answered.** Keep colors and geometry in UI presentation. Stable IDs key colors;
catalog order determines arms. Test complete color coverage. Adding/removing skills
changes the weakest-skill population and needs a separate policy review; this pass
retains the 12 skills. Presentation changes must not alter evidence identity.

### Q5. Conversation scope
The conversation badge and overlay use `conversationEvidence(snapshot, chatId)`
and count its credits. Is that the right attribution for "points earned in
this conversation", including revised/resent messages?

**Answered.** Yes, filter eligible credits through records' chat IDs, retaining
credited earlier revisions and effort. Points sum skill credits, not distinct
messages. The UI owner will replace copied-profile use with a separate
catalog-ordered `{skillId, points}` summary plus total, without levels. Native
partner profiles also reproject after filtering. Global language badges must
consume full-language summaries. Keep the product-approved normalized overlay:
the busiest conversation skill reaches the gold ring, labeled relative distribution.

### Q6. Contracts
Anything added in Q1/Q2 should arrive through generated contracts
(`ui/src/generated/contracts.ts`). Please name the exporter/commands involved
so the UI can switch from derived values to the contract types.

**Answered.** `native/src/model.rs::bindings` declares types;
`native/src/bin/export-contracts.rs` exports contracts and catalogs. Run
`npm run contracts` and `npm run contracts:check`. Evidence commands remain
`get_skill_evidence`, `save_skill_profile`, `get_practice_overview`, and
`get_learner_profile`. Evidence is still a JSON snapshot with hand-authored UI
interfaces; reference the new generated subtypes rather than rewriting the entire
snapshot contract. New commands register in `native/src/application/startup.rs`;
the architecture test discovers IPC calls and checks registration automatically.

## 4. UI work plan (UI owner)

In order; each step lands with its tests, fast check and preview screenshots.

1. **Wire to real data** once Q1/Q6 are answered: replace derived points with
   contract fields; keep `skillLevels()` as a thin validator.
2. **Level-up presentation** (after Q2):
   - Per-skill step: small receipt beside the credited message ("Refer to the
     past reached level 4").
   - Language step: gold ring completes → badge number rolls → the gold ring
     cools into a dark dashed ring → chart eases inward one band → new gold
     ring appears. ~1.2 s; reduced-motion collapses to one crossfade.
   - Catch-up: queue all pending steps and play them in order (skills first,
     then the language step they complete).
3. **Skills page**: replace the 50-XP "next milestone" bars with the skill-level
   panel; add a "what to work on next" block that names the skills holding the
   language level back and how many points each needs.
4. **Top-bar hover card**: add the language radar and the shortest arms.
5. **Conversation overlay**: settle how one conversation reads on the language
   radar (current: outline scaled to its busiest skill).
6. **Polish**: narrow-panel label sizing, phone layout, keyboard and
   screen-reader pass, native-speaker review of new strings, design-system
   entries for the 12 skill colours and the radar component.

## 5. Decisions already made (do not reopen without the product owner)

- 12 arms, one per catalog skill; weakest skill sets the language level.
- Fibonacci thresholds (1, 2, 3, 5, 8, 13, …).
- XP is only the per-message reward and a running total.
- Radar at rest: colour fill, earned levels as dark dashed rings, gold ring
  for the next level, thin skill axes and labels. Hover adds value lines;
  hovering an arm makes it thick and tapered with a white tip dot; clicking
  pins it and filters the skill list.
- Everyone's level is computed from current eligible evidence. Historical
  workspaces and awards are preserved; the old presentation is replaced.

Preserve workspace history and existing eligibility behavior, not old UI variants.
No new global user level or proficiency claim is introduced.

## 6. Native implementation handoff

Native owns `native/`, generated files, and level-command IPC helpers. UI owns
other UI files, including `LearnerProfile`, state refresh and `SkillRewards`.
No content changes are required. Native needs no further stage-by-stage approval.

### Generated summary

- `profile.levels: SkillLevelSummary`: `policyId`, catalog-ordered `skills`,
  `level`, `currentThreshold`, `nextThreshold`, `bands`.
- `SkillLevelProgress`: `skillId`, `points`, `level`, `currentThreshold`,
  `nextThreshold`. All numeric fields are integer numbers. Maximum supported
  points per skill is 2,971,215,072, keeping the next Fibonacci threshold within
  unsigned 32-bit range. Exceeding this bound fails explicitly. XP stays in its
  existing fields; points do not recalculate it.
- `bands`: thresholds for levels 1 through the scope's next level. At level 0:
  `[1]`; at level 4: `[1,2,3,5,8]`. Arm interpolation uses the individual skill's
  `level + (points-currentThreshold)/(nextThreshold-currentThreshold)`.
  UI owns geometry and styling, with no independent Fibonacci policy.
- `profile.pendingLevelEvents: SkillLevelEvent[]`: at most 100 currently eligible,
  unclaimed events, ordered by durable sequence. Partner profiles have recomputed
  scoped levels and an empty event list. Only full-language state drives events.

UI owner adds the generated types to the existing hand-authored `LearnerProfile`.
The native pass does not edit that UI-owned file. Conversation summaries remain
UI-owned counts without levels; do not copy language levels/events into them.

### Generated events and IPC

`SkillLevelEvent` contains `id: string`, `sequence: number`,
`kind: SkillLevelEventKind` (`skill_level` | `language_level`), optional `skillId`,
`fromLevel`, `toLevel`, optional `sourceAttemptId`, `chatId`, `messageId`.
Optional fields are omitted, not null. Skill events always have `skillId`;
language events omit it. Catch-up omits source fields; live events include all
three. `messageId` is the existing conversation-local numeric message sequence.
Identifiers may outlive deleted source records; use a panel receipt when the
source message is unavailable.

Helpers in `ui/src/platform/ipc/skill-levels.ts`:

1. `initializeSkillLevelEvents(target)` explicitly materializes catch-up and
   returns up to 100 pending events. Call on language activation and after
   profile-choice changes; safe to repeat from the single owner's refresh path.
   Do not initialize independently from each badge.
2. Successful assessment publication synchronizes before and after the credit
   inside its transaction. Prior uninitialized evidence gets source-free receipts;
   only new milestones get live source attribution. Snapshot reads never write.
3. Prepare presentation, then `claimSkillLevelEvents(target, ids)` with an ordered
   prefix, at most 100 distinct IDs. Present only returned events. Already-claimed
   IDs return no event. Unknown or wrong-scope IDs fail. Stale, ineligible and
   out-of-order claims fail atomically; refresh instead of playing stale events.
4. Refresh evidence after claiming to get the next batch. Check active language
   and visibility before claiming. Initialize before processing snapshot events
   to avoid competing responses. One language-level queue owns all level events.
   A crash/navigation after a claim can omit presentation, never erase the award.

Unique receipts cover learner/language/policy/kind/skill/level. Exclusions and
deletions can suppress pending events; recovery reuses the same receipts and
cannot re-arm claimed ones. Receipt storage has identifiers and levels, no copied
message text and no extra XP. Workspace format 47 adds an empty receipt table
through 46 → 47 and the existing 45 → 46 chain. Catch-up is a runtime operation,
not a migration rewrite of historical awards. Factory Reset removes the receipts
with the workspace. Release versions are unchanged.

### Remaining UI work and final review

Retire the 50-XP milestone trigger while preserving ordinary XP arrivals. Existing
`SkillRewards` skips hydration and only detects active-chat deltas; it cannot
deliver catch-up unchanged. Show authoritative current levels immediately and use
separate animation state for queued historical steps. Preserve existing tiered
sound/haptic settings and reduced-motion behavior.

After the UI pass, review full-language badges, conversation counts, partner scope,
initial catch-up, live source attachment, language switching, stale claims,
reload/restart, queues over 100, reduced motion and sound/haptics. Native tests do
not establish visible animation quality. No commit or deployment is authorized.

## 7. Verification status

Planning review inspected the prototype, overview mock-up, native credit and
claim paths, scoped profiles and exporter. Native implementation checks:

- `npm run check:fast`: passed on final code state.
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`:
  passed.
- `cargo test --manifest-path native/Cargo.toml --lib --quiet`: 754 passed,
  5 ignored, 0 failed. Includes live publication/source attribution, publication
  rollback/retry, catch-up order and pagination, duplicate claims, exclusions,
  deletion, restart, scoped levels, numeric boundaries, format-45/46 award and
  XP-claim preservation, migration rollback and fresh-schema equivalence.
- Affected UI suites: 4 files, 18 tests passed (IPC registration, level math,
  credit rewards and reward component). Initial sandbox bundler access failed;
  rerunning those same tests with the required filesystem access passed.
- `npm run build`: passed, including its TypeScript check; Vite
  reports the existing large-chunk advisory.
- `npm run contracts:check`, `npm run docs:links` and `git diff --check`: passed.

One old migration fixture initially failed because it relabeled a current schema
as format 45 while retaining the new table. Fixtures now reconstruct the old
schema before testing upgrades; migration behavior was not weakened.

No live application/animation review or hosted CI run was performed. The UI still
needs to consume these contracts and IPC helpers; passing native tests is not a
claim that the new animations are wired. Changes are uncommitted.

## 8. Message to the UI owner

> The complete native pass is ready. Use §6 as the implemented contract: generated
> `SkillLevelSummary`/`SkillLevelProgress` in `profile.levels`, generated
> `SkillLevelEvent` in `profile.pendingLevelEvents`, and the two helpers in
> `platform/ipc/skill-levels.ts`. Bands, live source IDs, source-free catch-up,
> ordered claims (100 maximum) and the preserving format-47 migration are done.
> Add these generated fields to `LearnerProfile`, then complete your UI work in
> one pass. Keep conversation counts separate and retain the labeled normalized
> overlay. Initialize from one language owner, claim only when ready to present,
> refresh after each batch, and present only returned events. Remove the old
> 50-XP trigger while retaining ordinary XP arrivals. Native/contract/fast checks,
> build and affected UI tests pass; details are in §7. Return the finished UI pass
> for a combined flow review and final polish. No commit has been created.

## 9. UI pass (UI owner) — ready for integration review

Status: **implemented, uncommitted.** Built against §6 as delivered.

### What changed
- `LearnerProfile` gains `levels: SkillLevelSummary | null` and
  `pendingLevelEvents: SkillLevelEvent[]`. `conversationEvidence` sets
  `levels: null` and `pendingLevelEvents: []`, so language levels and events never
  travel with a conversation scope.
- `domain/learning/statistics/skill-levels.ts` no longer owns any threshold. It
  reads `profile.levels`, validates catalog order and `bands`, joins labels/XP,
  and derives presentation only: arm position
  `level + (points-currentThreshold)/(nextThreshold-currentThreshold)`, readiness,
  band fill, and `holdingBack` (skills below the next language threshold).
  `conversationSkillPoints(snapshot, chatId)` is the separate typed conversation
  count (no level; fails on duplicate or unknown credits).
- Radar geometry draws rings from level positions only; the glyph keeps pixel
  strokes at any size.
- One celebration owner: `state/learning/skill-level-events.ts`
  (`useSkillLevelEventQueue`, mounted once in `AppShell`). It initializes per
  language + profile-choices revision, claims an ordered prefix (≤100) only
  after preparing presentations, presents only returned events, and reloads
  evidence when a batch finishes. Hidden windows claim nothing; a failed/stale
  claim is reported (`reportFault`) and followed by a reload, never replayed;
  each snapshot's pending list is acted on once; nothing-returned claims reload.
- `features/skills/levels/LevelUpPresenter.tsx`: consecutive skill steps collapse
  into one corner receipt (one row per skill, final level); each language step is
  a floating card (current radar settles, badge rolls from→to, "Every skill now
  has N or more points"). Sounds reuse the existing cues (`pop`, `milestone`) and
  their settings; reduced motion removes movement. Current levels elsewhere are
  always the snapshot's.
- Retired the 50-XP milestone: `SkillRewards` no longer computes it, the
  `MessageEvidence.milestone` field and the milestone coin cue are gone,
  `SkillList` shows XP without milestone bars, `xp-progress.ts` removed, and the
  three milestone strings removed from all locales. Ordinary XP arrivals are
  unchanged.
- `SkillLevelsPanel` moved to `components/learning/` (the conversation feature
  uses it; features stay independent). Adds "To reach level N" chips (three
  largest gaps + count), and a "See the evidence" action on the Skills page.
  Skills page uses it in place of the old skill list; `ProgressRules` and
  `SkillOverview` describe levels instead of milestones.
- Top-bar progress card shows the language radar, level and the three
  skills furthest from the next level.
- Styles: `components/skill-levels.css` (panel), `features/skills/level-up.css`
  (celebrations). New strings in all 7 locales (machine-drafted).
- Tests: `tests/fixtures/skill-levels.ts` mirrors the native policy for fixtures
  only. New/updated tests for the adapter, panel, queue (init/claim order,
  returned-only presentation, stale claim, all-claimed) and milestone removal.
  Preview: `ui/tools/skill-levels-preview.html` (`?celebrate=catch-up|language|skills`).

### Files to delete on disk (moved or retired; the sync tool cannot delete)
- `ui/src/features/skills/levels/SkillLevelsPanel.tsx`
- `ui/src/features/skills/levels/SkillLevelsPanel.test.tsx`
- `ui/src/styles/features/skills/skill-levels.css`
- `ui/src/features/conversation/progress/xp-progress.ts`

### Verification (UI owner, cloud copy of the branch + native UI outputs)
- `npm run check:fast`: passed. `tsc`: passed. `npm run build`: passed
  (existing chunk-size advisory).
- Full UI vitest: 1654 passed. Failing only where the cloud copy lacks the native
  pass: the two `ipc-commands` architecture tests (new commands not registered in
  that copy's `startup.rs`); these should pass on the real branch. One
  `DrillPage` test failed once under full-suite load and passes alone.
- Visual check in the preview: coach Skills tab, Skills page panel, top-bar card,
  language card, skill receipt, and a full mocked catch-up run.
- Not verified: the real Tauri flow (live publication → refresh → claim →
  presentation), restart mid-queue, language switching during a batch, and
  queues over 100 against real native.

### Open for review
1. In the coach Skills tab the old conversation skill list (`ConversationMap`,
   practice-focus selection) still follows the new panel, so skills appear twice.
   Keep, merge its focus action into the panel, or drop it?
2. Live skill receipts appear in the corner rather than beside the source
   message; `chatId`/`messageId` are available if attaching is wanted.
3. The celebration card shows the current radar, not a replay of the old shape.

## 10. Combined checkout review and repairs

Status: loading failure repaired and automated UI verification passed. No commit
or push performed. The native implementation was already present in this checkout.

The transfer included imports, tests and styles for the shared `SkillLevelsPanel`,
but omitted its implementation. Restored the component in `components/learning`,
using native thresholds, separate conversation counts, weakest-skill chips and
the evidence callback. Removed all four obsolete files listed in §9 after reading
their contents and establishing their replacement ownership. Updated the other
conversation preview's obsolete tab type to match Coach/Skills.

Queue review found that a delayed initialization could set the old language as
initialized and claim after switching languages or hiding the window. Added a
scope/generation guard covering learner, language, registry, choices and effects
enablement, checked both before claiming and after asynchronous responses.
The presenter rejects a different scope. Reward effects disabled in settings
prevent initialization/claims; hidden windows pause presentation timers. Failed
claims reload once and suppress repeated retries for an unchanged pending set,
avoiding an automatic error/reload loop. Visibility restoration allows a fresh
attempt. These changes preserve the native at-most-once claim semantics.

Regression coverage includes delayed initialization across language switches,
visibility changes during initialization, delayed claim responses, disabled
effects, and batches larger than 100, alongside the existing stale-claim tests.

Review decisions for this pass:

- Keep the conversation list because it still owns practice-focus selection and
  conversation evidence. Removing it now would remove working controls; merging
  those controls into the panel remains a focused layout improvement.
- Retain corner receipts for this implementation. Source IDs remain available
  for a later message-attached presentation; no historical source is invented.
- Retain the current radar on celebration cards. The badge celebrates a specific
  earned level; the shape is current evidence, not a reconstructed historical
  shape. Do not claim that old shapes were recorded or replayed.

Verification on the combined checkout:

- Full `npm test`: 256 files, 1,662 tests passed, including both IPC registration
  tests and the drill suite. Its fast gate passed.
- `npm run build`: passed (existing large-bundle advisory).
- `npm run previews:check`: passed after fixing the obsolete tab type.
- Final `npm run check:fast`: passed.
- Browser preview at the running local development server rendered without the
  import overlay. Inspected the panel, pin/filter interaction and settled language
  celebration card. The preview uses fixture IPC, not a real native session.

Native files did not change during this repair; native verification is recorded
in §7. No new live inference, real workspace restart/mid-animation run, physical
sound/haptic check, translation review or hosted CI run was performed. The full
desktop publication-to-animation flow is therefore not newly certified here.
