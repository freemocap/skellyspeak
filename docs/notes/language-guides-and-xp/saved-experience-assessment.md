# Live language experience profile

Status: live count view implemented in source, 2026-09-24.
The user superseded the saved-assessment/manual-refresh proposal: this is a fully
deterministic view of current recorded experience, effort and XP. No AI call,
saved write-up, refresh button, generation timestamp or staleness workflow.
The filename is retained so existing review links continue to resolve.

Continues [the refactor plan](evaluation-xp-refactor-plan.md) and
[coach selection](coach-selection-checkpoint.md).

## Behavior

- Calculate the profile from current eligible records when viewed, and update
  the open view when those records or the selected language/variety change.
  This is ordinary derived state, not polling or a background inference job.
- Show each applicable skill's experience, effort and XP. Include zero counts;
  distinguish unavailable assessment coverage from no recorded use.
- Experience is credited use; effort is credited changed retries. XP is their
  sum. No correctness, mastery or proficiency estimate participates.
- Show unexplored skills and retry-effort distribution. Optional practice targets
  use the same deterministic ranking as coach selection.
- Use compact numeric tables or charts with visible structure and functional
  labels. Explanations of calculations belong in InfoTip or source inspection,
  not a generated narrative or static explanatory paragraphs.
- Exclusions, restored evidence and catalog changes recalculate the same way as
  new credits. Never treat a load error as zero experience.
- Persist the underlying observations and awards as already implemented. The
  profile needs no independent saved-result lifecycle or new assessment history.

## Worked example

Synthetic subset for review; implementation includes the full applicable catalog.

| Skill | Experience | Effort | XP |
| --- | ---: | ---: | ---: |
| Present situations | 80 | 0 | 80 |
| Past reference | 2 | 3 | 5 |
| Possession and relationships | 8 | 12 | 20 |
| Quantity | 0 | 0 | 0 |
| Total | 90 | 15 | 105 |

Recorded coverage: 3 of these 4 skills. Explore targets quantity; Continue
practicing targets possession and relationships. Coverage counts skills with
recorded experience, not completed lessons or acquired abilities.

A new eligible quantity use changes its experience to 1 and XP to 1; totals
become 91 experience, 15 effort and 106 XP, with coverage 4/4. The visible profile
updates without a refresh action. Excluding that use restores the earlier values.
No retry-effort credit implies that a particular skill was corrected: the agreed
policy credits every retained skill on a changed retry. Assisted use is included.

## Ownership and implementation sequence

1. Reuse the native eligible-ledger projection and recommendation candidates to
   derive the full language/variety profile. Keep arithmetic in the learning owner.
2. Expose the projection through the existing snapshot/generated-contract path;
   update with ordinary record changes. No independent refresh command or table.
3. Render the compact profile using current production styles. Keep ordinary
   statistics mechanical; practice actions consume the shared recommendation rules.
4. Verify initial load, new credit, changed retry, exclusion/restoration, catalog
   change, empty history, unavailable content and exact-variety isolation. Verify
   the open view updates and reopening derives the same totals from saved records.
5. Then reuse targeting in drill/card generation after reviewing its controls.

Existing conversation targets remain fixed for their captured direction, as
already implemented. Updating this live profile does not silently change the
focus of an ongoing conversation; new selections use current evidence.

## Verification scope

The Skills page now includes ExperienceProfile: per-skill experience, effort,
XP, recorded coverage and totals, scoped to the selected variety with an explicit
all-varieties option. No refresh button. Skill rows open the existing inspector.
Existing milestone cards remain below the table.

The existing native ledger already publishes eligible credits and the shared
store reloads on conversation revisions and exclusion changes. This slice uses
that path unchanged. The pure UI projection validates the ledger using the
existing statistics validator, then sums credits by exact variety; it does not
reimplement native award decisions or add a persistence/IPC contract.

Checks: 17 focused tests passed across projection, live rerender, Skills and
store behavior. App/preview type checks, locale and style checks passed. The
existing practice-preview page renders the production table with synthetic data.
No live native conversation, inference or data reset was run.

Content availability remains a separate integration item: this table reports
recorded counts and does not classify zero rows as unavailable or as inability.
The old experimental LearnerModel inspector has now been replaced by the same
live count view; its profile and YAML paths no longer render or export rating
estimates. Internal estimator code still exists for other owners and was not
deleted wholesale.
Recommendation actions and drill/card integration remain subsequent work.

## Authored guidance follow-up

Skill inspectors now expose a Skill guide disclosure beside the evidence, both
on Skills and in conversation/message XP reports. The native snapshot includes
Markdown composed from the existing authored language core and explicit variety
content. Missing variety coverage stays unavailable; no other dialect substitutes.
Review status and authorship remain in the guide. This is static content, not an
on-demand AI explanation. The preview fixture is generated by
`node ui/tools/generate-practice-guides.ts` using the production composer.

The standalone practice preview now owns a viewport-height scrolling container;
app-global overflow rules remain unchanged. Verification: 32 native learning tests
passed; focused UI tests cover guide selection and missing coverage.

## Source completion pass — 2026-09-25

- Your learning evidence renders experience/effort/XP, partner and variety filters,
  and the shared evidence inspector. It rereads automatically on published evidence
  changes; no user refresh workflow is required. A reload action appears on errors.
- Native partner profiles scope both records and credits/totals; exclusion choices
  remain language-wide. YAML exports use a fresh language-wide eligible ledger.
- Guide access is present in Skills, learning evidence, per-skill/message XP reports,
  and the progress report's expandable skill rows. Selected variety follows table
  inspection; changing language, skill or active variety clears manual guide choice.
- Regression tests verify excluded credit disappears and restored credit returns,
  new published evidence triggers an open profile update, and late language/partner
  responses cannot replace the selected scope. Export failures remain explicit.
- Verification: 603 native tests passed, one intentionally ignored; 54 focused UI
  tests and 26 architecture checks passed. App/preview type, localization and style
  checks passed. No live model call, app reset or commit was performed.

The remaining pilot gate is interactive testing of the current native build in
Spanish. These source checks do not establish live provider behavior or visual
acceptance of the running app. Bulk authoring and drill/card targeting remain deferred.
