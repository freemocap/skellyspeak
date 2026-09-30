# Exploration progress

Status: implemented in source; verification recorded below. No native application
was launched and no application data was reset during this change.

## Agreed behavior

Explore uses a telescope beside the existing effort dimensions. It measures newly
generated information requested by the learner, not skill evidence or XP. Opening
saved information, reopening a panel and drafting a coach question earn nothing.
Failed, cancelled and cache-hit requests earn nothing.

One award contributes to its captured language and the app-wide sum. A request
made inside a conversation also contributes to that conversation. Practice and
other surfaces do not inherit the last selected conversation. Hidden languages
remain included in the app total. Source deletion does not revoke earned effort.

## Implemented boundaries

- Successful grammar explanations, reply suggestions and coach answers award once
  per durable operation. Retries cannot duplicate that operation's award.
- Supplying context for reassessment awards once per operation and distinct
  clarification, after successful publication. Automatic initial assessments do
  not award exploration.
- Shared word help, translations, explanations and sentence completions award
  only for an accepted fresh text result. Exact source text, aid and resolved
  target/explanation language varieties define the stable digest identity.
  Explicit repair and regeneration after cache eviction cannot award that aid again.
  Attribution does not change shared inference/cache identity.
- A newly generated practice proposal awards once per proposal, in the language
  and app totals. Opening or accepting the saved proposal adds nothing.
- Automatic reply summaries, automatic translations/glosses, ordinary partner
  replies, speech playback, local audio inspection and administrative diagnostics
  do not create exploration awards. Opening an automatically prepared summary or
  coaching card therefore earns nothing.

Awards borrow the result-publication transaction. Reading completion notifications
refresh the shell's effort query and its dependent conversation/language reports.
Existing gain presentation, sound and effects preferences apply to the telescope.
The global progress card and report include the app exploration total.

## Storage and contracts

The existing append-only effort ledger now accepts `explorations`, using policy
`exploration-generation-1`. No new storage service or server request is involved.
Reading inputs accept optional conversation attribution, checked against native
conversation ownership and target language before dispatch and publication.
Rust generates the updated interface contracts.

Explore advanced workspace format from 43 to 44; the subsequent Bot addition
advances it to 45 because the effort dimension constraint changes again.
Older formats remain explicitly incompatible under the existing policy;
there is no silent reset or conversion. No existing database was modified here.

## Verification

- Reading regression tests cover success, failure, cancellation, cache hits,
  missing metadata, retry deduplication, rollback, language isolation, conversation
  ownership, deletion and speech exclusion.
- Conversation integration tests cover generated grammar, saved-help reuse and
  coach answers. Shared-reading integration verifies concurrent consumers count
  once and cache reuse after reopening does not award again.
- UI tests cover the telescope gain, unchanged XP, disabled effects, reading
  attribution, Practice isolation, refresh after generation and totals including
  hidden languages.
- Initial full native run: 718 passed, 5 ignored, 2 failures outside this change:
  `drill::bundled::tests::previews_preserve_scripts_and_selected_variety_without_writes`
  and `language::languages::citation_tests::arabic_gloss_prompt_snapshot_has_explicit_scheme_and_preserves_source`.
- Final native run with those two failures excluded: 720 passed, 5 ignored.
- Focused UI reruns passed: 92 reading/Practice/architecture tests and 24
  progress/state/IPC tests. Application and preview TypeScript checks passed.
- Fast repository checks, native binary compilation, generated-contract validation
  and whitespace checks passed.
- Strict native lint remains blocked by four existing findings in speech transport,
  workspace speech dispatch, stream delivery and an existing effort test.
- Browser inspection of the mocked progress preview confirmed the telescope in
  conversation and language reports and the app-wide Explore total. This verifies
  presentation, not a running native application or live generation.

## Bot addition

Status: implemented in source following the agreed plan. Bot uses the same icon
library's robot head, effort ledger, gain presentation and reports. It does not
change skill XP or Explore credit.

- A successfully accepted persona generation earns one Bot point for its captured
  language and the app. Cancellation, validation failure and repeated terminal
  callbacks cannot award another point. Saving the persona is not a second award.
- Starting a conversation with a selected built-in/custom topic or an applied
  prompt-editor configuration earns one steering point for the conversation,
  language and app. Having both still earns one. Saving a topic, opening the
  editor, previewing configuration and the default coach-selected direction earn
  nothing. Credit commits with the accepted start, without waiting for its reply.
- Explicitly selecting a recorded activity node, opening its detailed inspector
  or selecting another recorded attempt earns one point after available request
  or response details load. Failed requests are eligible for inspection. Native
  attribution resolves from the attempt; duplicate clicks, windows and restarts
  cannot award the same attempt twice. Automatic selection and window restoration
  do not award points. Inspection reads themselves remain read-only.
- Static graph definitions and metadata-only aggregate activity panels are not
  recorded attempts and do not earn credit. All currently eligible sources have
  a captured language; no attribution uses whichever language is now selected.
- The prompt-editor entry is now a separate secondary row below Options, visible
  while Options is collapsed. Applying it captures start provenance; previewing
  remains local and does not invoke a model.

Bot verification: 722 native tests passed, 5 ignored, with the two content tests
listed above excluded. 130 focused UI/architecture tests passed, including the
editor Apply-to-start flow. Application and
preview type checks and fast repository checks passed. Browser inspection of
mocked previews confirmed the robot in conversation progress and the editor entry
below collapsed Options. No native app was launched and no workspace data reset.


## Integration into main workspace

Status: integrated as uncommitted changes on main after commit 754e70a1.
Only reviewed Explore/Bot changes were applied; the existing worktree remains
intact. The newer message-version assessment ownership, mobile activity screen
and tray, graph-follow behavior, tests and localized restore label are retained.
Contracts were regenerated from the combined native source. Format 45 now includes
both main's message-history schema and these additional effort dimensions.

Verification in the main checkout:
- Native suite: 726 passed, 5 ignored, the same two existing content failures
  listed above. New progress tests and message-history tests pass together.
- UI integration run: 388 passed, one existing saved-pronunciation display test
  failed. The same failure reproduces from the committed main snapshot.
- Application type checking reports the existing ActivityGraph test mock's empty
  argument tuple. The same error reproduces from committed main. Preview tooling
  type checking passes.
- Fast checks pass formatting, catalog structure, diagnostic policy, styles and
  tooling tests. Localization usage still flags four obsolete revision-status
  messages; the same candidates are present in committed main.
- Generated-contract validation and whitespace checks pass.
No commit, push, application launch or application-data reset was performed.

## Action-location reward bursts

Status: implemented in the main checkout, uncommitted. Each newly earned effort
unit also scatters six small copies of its icon around the initiating click/tap,
with a central pop. Existing counter animations remain. Keyboard activation uses
the control center. The silent, pointer-transparent overlay respects the effects
setting and reduced motion, and uses the browser top layer above dialogs.

Origins stay in window memory and bind to native turn, operation, generation or
recording identities before results arrive. Concurrent requests retain their own
locations; repeated award reads are deduplicated. Old awards cannot attach to a
newer click. Entries expire after 30 minutes and are bounded to 500 per map.
Reading receipts and explicit inspection responses return only newly inserted
awards, allowing the detached activity window to present its own bursts. Cached
reading and repeated inspection return no new award. No extra points are minted.

Verification: focused UI origin, component, activity, progress, microphone and
reading suites; native effort, attempt inspection and shared-reading receipt
regressions; style and generated-contract checks. Browser fixture inspection
confirmed the telescope at its button and the robot above a dialog, with the
existing counter popup still visible. This was a fixture preview, not a live
provider request. The pre-existing ActivityGraph test type error remains.
