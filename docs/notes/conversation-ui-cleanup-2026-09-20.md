# Conversation UI cleanup

Language-boundary follow-up: the user prioritized auditing and removing script
exceptions from feature code. Implemented findings and verification are recorded
in [the language behavior audit](language-behavior-boundary-audit-2026-09-20.md).

Status: user-requested work queue. Items below describe intended behavior, not
implemented features. Work proceeds one bounded agent task at a time, with review
in the coordinating conversation before moving to the next item. No commits or
deployment are authorized. Preserve existing unrelated working-tree changes.

## Ordered tasks

1. **Implemented; ready for user visual review — Dark-mode bubbles.** Remove the unattractive brownish appearance
   of conversation bubbles/overlaid text. Use coherent dark surfaces and readable
   text/reading overlays; verify the production styling in a preview.
2. **Implemented — Coaching navigation.** Remove the redundant Coach heading.
   The top row is exactly Coach and Experience panel tabs, replacing the former
   Coaching/Evidence labels. Preserve existing panels and collapse control.
   This is a navigation/label change, not a rename of domain evidence.
3. **Implemented; moved ahead of task 2 by user correction — Visible feedback scores.**
   Display the existing `ConversationFeedback.grammar` and `.conversation` scores
   with their existing Grammar and Conversation fit labels and /5 scale on the
   collapsed feedback bubble. These already reach `MessageFeedback` through
   `TurnView` and appear inside `ConversationFeedbackCard`. No new assessment,
   AI calls, configuration or invented coaching prompts. Correct the preview to
   demonstrate these actual fields using existing fixture data, removing the
   hard-coded past-summer coaching teaser and unsupported demonstration content.
4. **Implemented — Coach chat divider and collapse.** Clearly separate the right-side
   coach chat from the coaching panel. Provide a visible resizable divider and a
   minimized state that keeps just the chat input accessible.
   This is the internal vertical split between coaching content and coach chat;
   preserve the existing outer conversation/coach width divider and chat behavior.
5. **Implemented — Bubble actions and edit invitation.** Make read-aloud and edit actions
   corner controls belonging to the message bubble, outside the text flow. Use a
   clear pencil emoji consistently for the outer edit action and feedback popup.
   Change the popup action from “Edit message” to “Edit and resend message”.
6. **Implemented — Integrated assistance and parity.** Make Translate, Word by word,
   Analysis and feedback feel attached to the bubble with consistent treatment
   for user and AI messages. Add Word by word for user messages. Coordinate with
   task 5's bubble action layout without changing assessment semantics.
7. **Implemented — Consistent reading preferences.** Clarify full-message translation
   versus word-by-word assistance. Word by word should default to showing
   translation and romanization where available, with conversation settings
   controlling visibility. Respect translation, romanization and pronunciation
   preferences wherever tokens appear. Inspect existing preference ownership and
   in-progress reading changes first; preserve deliberate user settings. No new
   standalone romanization action is requested.

8. **Planned; implementation incomplete — Reply help and on-demand assistance.**
   Follow the [integrated implementation plan](reply-help-implementation-plan-2026-09-20.md),
   which supersedes the pasted three-layer proposal. Preserve the active
   AssistedReply data and shared reading/cache machinery; complete presentation
   before the reviewed native scheduling change. The
   [audit](reply-help-plan-audit-2026-09-20.md) records current integration failures.
   This entry does not mark the existing draft complete or reorder tasks 4–7.

## Scope control

- Implemented user-prioritized fix: token-help duplication in the screenshot of
  Arabic البيوت. SavedGlossText repeats each source part once per field
  (meaning, romanization, pronunciation). Investigate/fix this presentation
  grouping without deleting distinct saved sound information or changing data.
  Shared compact help groups each part once. User rejected the added sound-field
  labels and simultaneous sound fields: implemented correction removes labels
  and uses romanization when available, pronunciation only as fallback.
  Existing inline/helper visibility preferences stay
  intact. Parent verified exact screenshot values in the conversation preview,
  including a follow-up fix for inherited Arabic line-height and text alignment.
  Agent reports 98 reading tests and style/diff checks passed; generated bundle
  refreshed. Full build/preview checks remain blocked by unrelated ReplyHelp
  mismatches and removed ComposerHelp imports. No commit.
  Correction verification: 33 focused tests, styles and design-system checks
  passed. Parent visually confirmed no sound-field labels and only al-/buyūt
  in the screenshot fixture, with il/buyuut suppressed. Romanization already
  shown inline does not cause pronunciation to appear in the floater.
- Review each task's concrete changes and verification before starting the next.
- Add newly discovered, nonblocking issues here instead of widening an agent task.
- Keep source implementation, automated checks and running-app visual review
  distinct in completion reports.
- User correction: inspect implementation and available data before making any
  preview. A preview must demonstrate existing functionality with traceable
  fixtures; do not invent functionality or imply hard-coded dialogue is live.

## Verification results

### Task 7 — Reading settings consistency

- Corrected after user regression report: always-show toggles control inline
  aids. On-demand compact helpers and word details show actual saved meanings
  and reading aids regardless of those toggles. The previous strict gating of
  helpers was wrong and caused hover cards containing only “Word help”.
  Removed that label-only fallback. Word-by-word visibility is separate from preference values.
  Explicit full-message Translate remains a local disclosure.
- Pronunciation is a fallback only when the saved token has no romanization;
  disabling romanization does not substitute pronunciation. Full saved metadata
  is retained. No sound-field labels, new AI tasks or language exceptions added.
- Existing native defaults and saved preferences are preserved. Disabling inline
  aids does not disable on-demand word help. Parent browser verified the original
  screenshot fixture displays `the`/`al-` and `houses`/`buyūt` with all toggles off,
  without redundant pronunciation or sound-field labels.
- Parent checked settings store/IPC mapping: 47 tests passed. Updated three
  reading fixture suites to explicitly enable requested aids: 25 tests passed.
- Parent wired existing preview settings controls to the production renderer.
  Browser verification: all three toggles on shows saved `the houses` and
  `al-buyūt`, suppressing `il`/`buyuut`. Turning translation and romanization off
  removes those aids without revealing pronunciation. Only existing fixtures used.
- Initial agent regression suite: 110 tests across 11 files passed (includes the 25
  parent-updated fixture tests). New coverage checks all eight toggle combinations,
  live dialog/popup changes, both stream sides with saved/token/joining paths and
  the first explicit ReadingPassage lookup. Together with settings checks: 157
  tests passed. Parent reviewed the implementation and new regression coverage.
- Hover correction: 112 tests across 11 files passed. Added actual pointer-hover
  regressions with all toggles off, with and without saved romanization. Corrected
  the prior tests that mistakenly required empty on-demand help. Inline settings
  checks remain; compact help and details stay useful when toggles change.
- Word-by-word correction: explicit clicks reveal saved meanings and available
  romanization (pronunciation only as fallback), even when always-show settings
  are off. A second click hides the aids. The earlier requirement that a global
  inline toggle be on made this button ineffective and was removed. Settings
  still determine automatic inline display, without changing persisted values.
  ReadingPassage uses the same distinction and avoids lookup for already saved
  parts. 116 tests across 11 files passed, covering actual clicks on both message
  sides with saved, token and joining-script rendering plus saved/fetched passages.
  Parent browser verified both preview buttons show and hide their actual aids
  with default settings off. No commit.
- Full application typecheck remains blocked by existing ConversationPage and
  ReplyHelp errors and the removed ComposerHelp test import. Preview typecheck
  reports only existing ReplyHelp errors and the removed ComposerHelp preview
  import. Diff whitespace check passed. No commit or native launch.

### Task 6 — Bubble assistance and learner word help

- Existing assistance actions now sit in bubble-owned bordered footers using
  interface typography/direction. Corner buttons and border-overlapping scores
  are preserved. Learner Word by word uses saved glosses or existing token
  reveal state, with independent per-side overrides for shaping-script rendering.
- Parent browser verified Arabic learner toggle displays/removes “the houses”
  from the exact screenshot fixture, and partner Hola toggle independently shows
  “Hello”. No new inference or invented assessments added.
- Agent reports 70 focused tests, style, generated design-system freshness and
  targeted whitespace checks passing. Full build/preview checks remain blocked
  by unrelated ReplyHelp type/API errors and removed ComposerHelp imports.
  No commit. Broader reading-preference consistency remains task 7.

### Task 5 — Bubble corner controls

- Speaker and edit controls share framed upper-corner placement with text
  clearance and mirrored RTL placement. Existing playback/edit handlers remain.
- Outer edit and popup use ✏️; popup label is “Edit and resend message” in all
  seven locales, opening the existing edit workflow without sending on click.
- Parent visually verified corner placement and popup-to-composer action in the
  production-component preview. Preview uses existing standalone Hola fixture,
  retained Arabic fixture and existing learner feedback sample.
- Agent reports 83 focused tests (including edit/resend and speech), styles,
  localization precheck, diff and generated design-system freshness passed.
  Full build/preview checks remain blocked by unrelated ReplyHelp API/type errors,
  ConversationPage mechanic mismatch and deleted ComposerHelp imports. No commit.

### Task 4 — Coach chat divider and collapse

- Feature-owned CoachChatLayout separates coaching content and chat history,
  with a visible horizontal pointer/keyboard resize handle and minimize/expand
  button. Starts minimized, restores prior expanded height, bounds chat share to
  0–70%. Existing outer width divider stays separate.
- Composer/draft and notices remain mounted and visible while minimized. New
  replies do not auto-expand chat; reopening scrolls to the latest saved message.
- Follow-up implemented: submitting a valid coach message expands history to its
  prior height through the existing shared send path, including external Ask.
  Blank/blocked sends do not expand; incoming replies do not reopen a minimized
  history. Agent reports 12 focused regression tests passing.
- Production and preview use the same layout; no invented coach messages added.
- Parent browser verification: expand to 30%, drag to 44%, collapse to 0% with
  draft retained, restore to 44%, keyboard increase to 49%. Visual split verified.
- Agent reports 17 focused tests, style, generated design-system freshness and
  diff checks passing. Build/preview type-checks still blocked by unrelated
  ReplyHelp API/type mismatches and removed ComposerHelp imports. No commit.

### Task 2 — Single coaching tab row

- Production and conversation fixture use the same Coach/Experience tab row,
  with no extra Coach heading and the existing collapse control alongside tabs.
  Internal evidence identities and panel behavior remain unchanged.
- Agent reports eight focused tests, style check and design-system freshness
  check passing. Parent reviewed implementation diff.
- Full build and preview type-check are blocked by concurrent ReplyHelp
  API/type mismatches and remaining imports of removed ComposerHelp in other
  preview/test files. Those changes are outside this task.
- Browser visual verification remains incomplete: the prior local preview server
  stopped; restarting succeeded, but the browser retained a connection-error
  page and rejected navigation. No native launch, commit or deployment.

### Task 3 — Existing feedback scores and faithful preview

- Follow-up implemented: visible score names replaced by ✍️ and 🗣️ while
  retaining accessible names and actual /5 values. Badge overlaps the owning
  message bubble's bottom border with text clearance. Parent visually checked
  light and dark preview states. Agent reports 32 tests plus styles, previews,
  build, design-system and diff whitespace checks passing. No commit.
- Collapsed feedback renders existing `conversationFeedback.grammar` and
  `.conversation` using the existing Grammar / Conversation fit labels and /5
  scale. Accessible descriptions include both scores; labels wrap with spacing.
- Saved feedback takes precedence over coaching teasers. Clicking opens the
  saved card without coach navigation or a disclosure call.
- Preview uses the existing `ConversationFeedbackCard.test.tsx` fixture (3/5,
  5/5), explicitly labeled test data, through production components. Removed
  the hard-coded quiz hint, fabricated coach dialogue and unrelated reply.
- Implementation agent reports 42 focused tests, build, preview type-check,
  style check and scoped diff check passing. Existing bundle-size warning remains.
- Coordinating agent reviewed the diff and visually verified collapsed scores
  and the matching saved-feedback dialog in the browser fixture. Native app was
  not launched. No AI calls, configuration changes, commits or deployment.

### Task 1 — Dark-mode bubbles

- Replaced dark partner bubble background `#32291b` with graphite `#282c32`
  and border `#695339` with `#4b535e` in the existing foundation tokens.
  Refreshed generated design-system outputs while preserving prior edits.
- Coordinating agent reviewed the source diff; the implementation agent reports
  visual verification in the production conversation fixture with warm/cool dark
  palettes, learner/partner messages and Arabic word-help overlays.
- Agent-reported checks passed: `npm run styles:check`, `npm run build`,
  `npm run design-system:check`. Build retains its existing chunk-size warning.
- Agent-measured text contrast: main text 12.35–12.42:1, muted annotations
  5.87–6.34:1, romanization 5.41:1.
- This is source and browser-fixture verification; the native application was
  not launched. User visual acceptance is pending. No commit or deployment.
