# Chat and Practice follow-up audit

Status: UI refinements and message selection implemented. Message-specific coach discussions and read-only revision history are deferred at the learner’s request (2026-09-29); they are not active next steps. Historical audits and proposals below are retained for reference.

Baseline: clean checkout at `v2.6.1` on 2026-09-29. Findings below are source observations, not phone reproduction results.

## Checklist and scope

| Item | Scope | Source finding and proposed next step |
| --- | --- | --- |
| Unselected Chat/Practice tab border | Small | `ui/src/styles/shell/layout.css` gives inactive tabs a transparent border. Keep a visible subdued outline on both; reserve strong color/glow for selection. Preserve dimensions to avoid layout shifts. |
| Desktop microphone picker | Small–medium | Shared `MicrophoneSelector` already saves the selected device through settings. `VoicePanel` currently exposes it inside Recording settings. Add a compact footer presentation using the same setting in Chat and Practice; retain the mobile/settings entry points and disable switching during capture/transcription. |
| Chat toolbar visibility | Medium | `MessageTools` already uses `useToolOverflow` to fit optional actions. Investigate actual bubble width, intrinsic sizing, measured gaps and font/touch sizing before replacing the algorithm. A short bubble can offer less room than the chat column. |
| Practice toolbar visibility | Medium | Practice uses shared reading surfaces, including `TargetMessage`/`MessageTools`. Audit card-specific controls too. Show all actions that actually fit, using the same measured-space policy; retain 44px touch targets. |
| Menus hidden behind/below content on Android | Medium investigation | The message menu is absolutely positioned below its trigger, inside the content tree. Scroll clipping, viewport placement and stacking contexts can defeat a larger z-index. Reproduce each menu, then use the existing shared overlay/top-layer approach where appropriate, with placement above the trigger near the bottom edge. |
| Expand/collapse individual bubbles | Removed by request | The learner withdrew this feature after reviewing automatic action visibility. Keep automatic toolbar sizing and overflow; no manual bubble width control. |
| Select messages to inspect coaching/analysis | Medium | Structured coaching is already attached to turns. `ConversationPage` chooses a pinned turn or the latest active turn; the partner Analysis action pins a turn and opens a dialog. Learner bubbles do not have equivalent selection. Introduce explicit message identity including speaker, visibly select either side, and show its existing coaching or analysis. Preserve text selection, word help, playback and edit interactions. |
| Coach discussion history owned by message | Larger | `CoachAnalysisPanel` renders conversation-wide `coachMessages`; `askCoach` supplies conversation identity and question text, without a source-message identity. Message selection alone cannot establish durable ownership. Agree how message-specific discussions and general questions coexist, then change ownership, persistence, request context and views together. |
| Previous chat attempts | Medium for retained revisions; larger for full branches | Revised source turns have replacement links and remain in snapshots; the stream filters out `replacedBy` turns. A read-only revision viewer can expose that retained chain. However, editing an earlier turn deletes the subsequent non-coach conversation suffix in `native/src/conversations/revision.rs`. Full alternate conversation branches would require a separate retention design and cannot recover already-deleted data. |
| Missing XP coin sound on phone | Investigation; fix size unknown | `reward-sounds.ts` silently returns false for disabled mode, blocked playback, zero volume, hidden document, non-running audio context, detached/offscreen target or queue delay over 0.45 seconds. Defaults can follow read-aloud and XP effects can disable sounds. Check cue dispatch plus every gate on device, including after recording and app resume. Do not assume audio volume or autoplay is the cause. |
| Less rich word glosses | Investigation; fix size unknown | Current word popup renders meaning, romanization or pronunciation from saved/cached segments. Existing help suppresses a fresh lookup when a saved meaning exists. The shared prompt explicitly requests short contextual glosses; richer passage explanations are a separate aid. Recent history includes a September 27 compact mobile word-help restoration. This establishes several possible presentation/data causes, not a confirmed quality regression or proof that an older system was removed. |

## Proposed sequence

1. Implement the inactive tab outline and compact desktop microphone picker.
2. Reproduce toolbar sizing and menu layering together, then fix the shared owners. Check both Chat and Practice before calling either complete.
3. Bubble expansion was reviewed and subsequently removed by request; no further work planned.
4. Diagnose phone sound and gloss richness with concrete examples. Record observed cause separately from proposed fixes.
5. Review message selection, coach-thread ownership and attempt history as one focused product pass. Start with existing per-message evidence and retained revisions; treat new durable coach ownership and full branch history as separately scoped work.

## Decisions for the focused review

- Resolved by the learner: history means earlier wording of the same message after Fix and resend. Provide read-only revision browsing with the current version identified. Separate conversations, earlier recordings and alternate conversation branches are outside this request.
- Proposed selection behavior: selecting a learner message shows that message's feedback; selecting a partner message shows its language analysis. Incoming replies should not replace a deliberately selected older message. Selecting or browsing must not replay XP or grant credit.
- Decide whether general coach questions remain conversation-wide, and how new questions inherit the selected message. Preserve explicit source ownership rather than inferring it from quoted text.
- Decide how historical correction controls behave. Reviewing an old attempt must not silently act on the current revision or mutate coaching exposure state merely because a panel opened.
- For glosses, compare the same words/passages and settings: inline aids, tap popup, and full Word help. Separate appearance, missing fields, cached results and generated quality. Use representative scripts and canonical encodings under the shared language policy.

## Verification gates for implementation

- Tab/picker: desktop and narrow layout inspection; keyboard focus; long device names; missing devices; capture/transcription lockout; selection consistency across recorder and main settings.
- Toolbar/menu/expansion: real browser layout at narrow phone, tablet and desktop widths; long translated labels; enlarged reading/interface text; coarse pointer; both writing directions; short/long bubbles; bottom-of-scroll placement; keyboard dismissal and focus. Mocked element sizes alone cannot validate layout.
- Sound: physical Android run with effects on, follow-read-aloud on/off, nonzero volume, typed and recorded sends, background/resume and visible reward targets. Add bounded diagnostic skip reasons if needed, without recording content; preserve deliberate background/history suppression.
- Selection/history: refresh/restart, switching conversations, incoming replies while an old message is selected, learner versus partner identity, edits/revisions, failures/pending work, source-owned coaching and one-time credit. Retain existing transaction/publication boundaries.
- Glosses: side-by-side evidence from relevant historical source and current output before deciding to restore or redesign anything. Do not run archived applications or copy historical code wholesale.

## Verification performed in this audit

Seven focused existing test files passed: 86 tests total. Covered `MessageTools`, `ReadingHelp`, `TargetText`, reward sounds, playback lifecycle, `TurnView`, and the Practice attempt-history hook.

These tests establish a passing unit-test baseline. Toolbar dimensions and audio APIs are mocked; they do not disprove the reported layout or sound failures. Native revision-history tests were inspected, not executed. No running application or physical Android device was inspected, no live generation comparison was made, and no full build was run for this planning-only change.

The initial audit added only this note. Its findings and verification limits above describe that initial pass. See the subsequent implementation record below.


## First implementation batch — 2026-09-29

- [x] Give inactive Chat/Practice tabs a visible subdued outline; active color and glow remain distinct.
- [x] Expose the existing microphone picker in the desktop footer in both Chat and Practice. Keep it in Recording settings at narrow widths and retain main Settings. Use one mounted picker at a time when opening the recorder dialog. Block changes during Practice transcription as well as capture/startup.
- [x] Fix the shared message-toolbar width feedback: short bubbles previously shrank after tools entered overflow, so extra column space could not bring them back. Tools now contribute a measured preferred width, capped by the containing bubble's available width. Measure the actual action-group gap and observe fixed controls as well as optional labels.
- [x] Move shared message overflow menus outside clipped bubble ancestors. Reuse the reading overlay's viewport positioning and touch-compatible portal policy; retain native top-layer presentation where supported. Focus the first available control and restore trigger focus on Escape.
- [ ] Verify these menu changes on the physical Android device; browser checks cannot establish device behavior.
- [x] Finish the separate Practice card-navigation overflow audit (implemented in the second batch below). The first audit found that `DrillLayout.tsx` hid Random card and Add practice cards under More whenever the width tier was mobile, irrespective of actual room. This is distinct from the shared message toolbar addressed above.
- [x] Remove manual bubble expansion after review; retain automatic toolbar sizing.
- [ ] Sound and gloss investigations, message selection, coach discussion ownership and read-only revision history remain pending.

Verification: production build passed (bundle-size advisory remains); style checks passed; preview tooling type checks and diff whitespace checks passed. Final focused suites plus architecture checks passed: 16 files, 188 tests. Existing canvas mocks emit unsupported-canvas notices; those tests passed. Updated recorder test fixtures to support device enumeration from the newly visible picker and across dialog remounts. Added portal/Escape/focus assertions to the existing toolbar regression test.

Visual inspection used production components in offline Chat and Practice previews at 1440×1000 and 390×844. Confirmed inactive outlines, desktop picker placement, narrow-layout settings access, disabled Practice picker while simulated recording, and inline reading actions when space fits. Confirmed Chat overflow opens above its trigger and stays within the phone-width viewport. These fixtures use sample microphones and do not verify real capture, device switching, touch WebView rendering or speaker output.

The first batch was subsequently committed and pushed to main as `a0dfad1b` under a one-time instruction. No release or deployment was performed.


## Second implementation batch — 2026-09-29

- [x] Fit Practice card actions to their actual toolbar width. Reserve the card chooser, Previous/Next and counter; show Random card and Add practice cards directly where they fit, with only the remainder in More. Device width no longer determines action visibility. The existing dialog still owns overflow focus and dismissal, and capture locks still apply.
- Superseded by the removal below: added an always-accessible Expand/Compact icon action to each completed learner/partner bubble. Each side has independent session-local width state. Expanded bubbles fill the available stream width, preserving the partner reaction gutter. Content height remains natural; the toggle does not change reading aids, fetch analysis, select a message or award credit. Pending/error reply placeholders are unchanged.
- [x] Record the agreed history scope: earlier wording after Fix and resend, read-only, with the current revision identified. Revision history is not implemented in this batch.

Browser verification used offline production-component previews. At 800px both Practice actions were inline; at 500px Random card remained inline and the overflow dialog contained only Add; at 390px the dialog exposed both actions. German labels were inspected at 390px and right-to-left Arabic controls at 800px. Expanded a partner bubble and then a learner bubble independently at 1440px; restored the partner to compact while leaving the learner expanded, then inspected the same state at 390px. Analysis stayed closed and source text remained intact.

Physical Android capture and touch behavior remain unverified. These are source changes with browser fixture inspection, not a new installed application build. The second batch remains uncommitted; the earlier one-time commit permission was consumed.

Second-batch automated verification: production build, style checks, preview type checks and diff whitespace checks passed; 13 focused/architecture test files passed, 176 tests total. The build retains the existing large-bundle advisory and the test environment retains its canvas notices.

## Recording footer polish — 2026-09-29

Implemented a shared slimmer footer in Chat and Practice: less bottom padding and row spacing, matching pill corners, and 32px desktop heights for settings, Type, checkbox labels, microphone selector/refresh and recording modes. Footer-specific microphone styling leaves the main settings form intact. The existing coarse-pointer control-height tokens preserve 44px minimum heights.

Verified both production-component previews at 1440×1000 and 390×844; measured desktop controls at 32px with matching radii. Style checks, build and diff whitespace checks passed. No new tests were added for this CSS-only polish; no physical device check or commit was performed.

## Bubble expansion removed — 2026-09-29

Removed the Expand/Compact buttons, their independent width state, width overrides and the now-unused toolbar extension prop at the learner's request. Automatic message-tool sizing and overflow behavior remain intact, as do Practice card-action fitting and recording-footer polish. The second-batch expansion observations above describe the reviewed intermediate version, not current behavior.

## Coin sound fix and gloss presentation audit — 2026-09-29

Implemented: reward playback now locates the XP button by its own message ID. The feedback layout places that button below, rather than inside, the bubble; the former descendant selector therefore found no target and never called playback. Removed the obsolete bubble marker. The regression fixture now uses the actual MessageFeedback composition. Before the fix, three payout assertions failed with zero sound calls; after it, all 61 tests across reward presentation, reward audio, playback lifecycle and TurnView passed. Production build and diff whitespace checks passed; the existing bundle-size advisory remains. Physical Android speaker output is still unverified. Changes remain uncommitted.

Clarified requirement: the current compact popup interaction is correct. The full-screen first-click behavior was a previously fixed bug, not a design to restore. This investigation concerns the hierarchy and formatting of target text, meaning and pronunciation inside the popup.

Historical source findings:

- September 20, `99bddf88`: popup romanization/pronunciation changed from the monospace token to the reading-aid font token. The current reading-aid stack begins with Noto Sans. This is a concrete typography change predating the mobile modal fix.
- September 20, `44658939`: introduced GlossHelpParts. Compact help changed from field-by-field rows (with repeated source labels for split words) to groups by source part; pronunciation became a fallback when romanization exists. Source-part headings appear only for multiple parts. This is a concrete content-formatting change, not evidence that generated meanings got worse.
- Current saved-token compact help does not repeat the target word for a single-part token; the on-demand WordHoverHelp path does include a target-word heading. This difference can make otherwise similar word popups look less structured depending on their rendering path.
- September 18 had a more elaborate source/meaning/sound table, but it belonged to the phone sheet; it is not evidence of the remembered compact-popup layout. Do not restore that interaction.
- September 28, `24a7016e`: removed the popup appearance glow. This changes the container, not the information hierarchy.

No gloss source or style changes were made in this pass. The exact remembered version is not established. Proposed next polish: give saved and on-demand compact help the same clear target-word heading, distinct meaning row and secondary sound row, retaining per-part grouping and current popup behavior. Review pronunciation-versus-romanization disclosure separately rather than silently changing that policy. Historical findings are source comparisons, not a live generation-quality comparison.

## Word-help font restoration and current checklist — 2026-09-29

Implemented for review: restored the existing monospace font token for romanization/pronunciation in compact word help and expanded saved-word details. Inline sentence annotations retain their current styling. Popup interaction, target-heading behavior and the mutually exclusive pronunciation/romanization policy are unchanged. The learner confirmed that mutual exclusion is correct. Style checks, production build and diff whitespace checks passed; the existing bundle-size advisory remains. Visual acceptance is pending the learner's review; no device inspection or deployment was performed.

Current checklist (supersedes the initial audit's proposed-work wording):

- [x] Inactive Chat/Practice outlines.
- [x] Desktop microphone picker; compact recording footer with consistent rounded controls.
- [x] Chat action fitting and separate Practice navigation action fitting.
- [x] Message overflow clipping/placement fix; physical Android confirmation remains pending.
- [x] Remove manual bubble expansion.
- [x] Repair coin/milestone playback target lookup; phone audio confirmation remains pending.
- [x] Restore monospace in word help for learner review.
- [ ] Per-message selection for coaching and partner-message analysis.
- [ ] Keep coach discussion history attached to the selected message.
- [ ] Read-only revision history after Edit/Fix and resend, identifying the current revision.

Only the first implementation batch was committed and pushed. Subsequent Practice fitting, footer polish, sound repair and font restoration remain uncommitted. Next substantial work is message selection and coaching ownership, followed by revision history.

## Explicit word-popup coach action — 2026-09-29

Implemented a compact question-mark Ask the coach button in saved and on-demand word popups. It uses the existing coach context and the same question payload as the corresponding prior details action. Saved gloss content no longer acts as a hidden full-details trigger. On-demand help retains its explicit Word help inspection link. Opening, pinning, audio, outside dismissal and Escape remain available; pinned Escape returns focus to the source word. Where no coach context exists, the action is absent, matching the existing shared button policy.

The question mark sits at the bottom inline-end corner, beneath audio, with shared audio-button sizing and coarse-pointer minimums. Popup direction follows the interface; individual gloss/source text retains its own direction. Monospace sound text and mutual exclusion are preserved.

Verification: 93 reading tests across 11 files passed, including direct coach payload, popup dismissal and absence of implicit dialogs on desktop/mobile fixtures. Production build, style checks, preview type checks and whitespace checks passed. Browser fixture inspection confirmed the question mark beneath the speaker and clicking it dismissed the popup and delivered the saved-word question to the fixture callback. Added the existing coach context to that preview so it reflects production routing. Physical touch and RTL visual checks remain unperformed. No commit or deployment.

Popup scrollbar follow-up: the bottom-positioned coach button intruded into the popup's bottom padding, and its normal line height exceeded the small button. Set an explicit compact line height, keep the button above the bottom padding and reserve sufficient height for the two controls. Browser reproduction initially measured vertical overflow; after the fix, both the single-word and multi-part Arabic fixtures had identical scroll/client dimensions on both axes, with no scrollbar. Style and whitespace checks passed. Overflow remains available for genuinely viewport-constrained content.

Tab refinement: strengthened inactive Chat/Practice outlines with a mix of secondary ink and the existing line token. Reduced vertical padding and the base minimum height; desktop fixture tabs now measure 47px active and 45px inactive, 3px shorter (about 6%). Coarse-pointer 44px minimum remains intact. Inspected light and dark browser fixtures; style and whitespace checks passed. No commit was made. Message selection/coaching ownership and revision history remain the next substantial tasks.

Recorder footer fit follow-up: removed desktop wrapping and made the microphone slot consume remaining width with a zero flex basis. A named inline-size container hides the slot's contents at 10rem or less (including Refresh), leaving the existing picker available through Recording settings. The query follows actual panel space, including translated sibling controls, rather than a new viewport breakpoint. Existing narrow-screen settings behavior remains. Browser checks at 1200/1000/900px measured a constant 32px footer row and selector widths of approximately 403/203/0px; opening Recording settings at 900px exposed the picker normally. Style, build and whitespace checks passed; the existing bundle advisory remains. No commit or deployment.

## Message selection and coach ownership audit — after v2.6.4

Status: source audit and proposed implementation sequence only. Checkout was clean at `80ce2197` (v2.6.4) before this note. No feature changes in this pass.

Confirmed current behavior:

- ConversationPage keeps a numeric pinned turn ID. Its coachedTurn follows that ID or the latest active turn; its partner analysis follows the pinned/latest answered turn. Selection does not distinguish learner and partner messages within a turn.
- The partner Analysis action pins a turn and opens a dialog. Learner feedback uses its own MessageFeedback dialog. There is no unified message selection feeding the dock.
- Saved learner feedback and partner reading/assistance already have source ownership. They do not need regeneration merely to browse another message.
- CoachAnalysisPanel receives a pinnedTurn prop but does not use it. It displays the conversation snapshot's entire coachMessages list. Its composer, busy/error handling and draft are conversation-scoped.
- AskCoach currently carries conversation ID, question text and expected revision, with no source-message owner. The native execution context captures the last eight coach messages across the conversation; the snapshot retrieves the last 100. UI filtering alone would not isolate discussions or request context.
- Ask the coach uses a question string from the outer conversation context. Quoting a word/message in that string is useful content, but does not constitute a durable ownership link.
- Reply-help composition intentionally follows the latest turn. This must remain distinct from inspection of an older selected message.
- Revision code preserves private coach turns, but without a source-message link it cannot present them as the discussion of a particular historical wording.

Recommended user behavior, to settle before persistence changes:

1. Selecting either bubble highlights that specific message and opens its appropriate dock content: learner feedback for learner text; saved analysis/grammar/suggestions for partner text. Word taps, audio and action buttons keep their independent behavior. Supply a keyboard-accessible selection action without wrapping nested interactive text in another button.
2. The dock identifies its source with speaker and a short excerpt. Explicit selection stays put when another reply arrives. Before explicit selection, retain a latest-message default. Changing conversations clears selection; a replaced/deleted selection must visibly resolve, never silently show another message's discussion under the old heading.
3. Each actual message revision owns its coach discussion. Ask actions from bubbles and word popups carry that owner through draft and submission. Switching selection restores the corresponding discussion and keeps unfinished drafts separate. A response arriving after selection changes stays with the message that initiated it.
4. General questions and pre-message/start-screen help need an explicit conversation-level destination. Existing unowned history must not be guessed onto messages based on text or recency. Decide its presentation separately from message discussions; no historical ownership inference or migration framework is proposed.
5. Editing/resending creates a new revision's discussion; older discussion remains with older wording, accessible when revision history is implemented. Simply selecting or viewing old feedback must not award credit or mutate coaching exposure/repair controls.

Implementation sequence:

- First, message-side selection and a clearly identified dock, reusing saved feedback/analysis and preserving latest-reply composition. This is the smaller UI step, but is not complete message-owned coaching on its own.
- Second, durable source-message ownership through the native command, validation, captured prompt context, publication, snapshots and exports; regenerate contracts from Rust. Filter history, pending/error/retry state and request context by the same owner. Preserve shared command transactions, replay checks and private-coach exclusion from partner context. Review revision/deletion foreign-key behavior before choosing the storage change.
- Third, read-only revision browsing: earlier wording, current revision indicator and access to the feedback/discussion of that exact revision. No conversation branching.

Targeted verification plan: learner versus partner selection in the same turn; two turns with identical text; independent word/audio controls; keyboard and mobile navigation; selection during an incoming reply; source-bound question drafts; switching messages/conversations during coach work; failure/retry ownership; restart/reload; edits and historical revisions; prompt history isolation; no additional learning credit or implicit feedback disclosure.

Audit baseline verification: fast validation passed (including 13 tooling tests); the matching TurnView and CoachAnalysisPanel suites passed, 52 tests across two files. The requested ConversationPage.test.tsx pattern matched no file. Native ownership/revision suites were inspected, not run. No new behavior or running native application was verified in this audit.

## Selection emphasis and automatic latest selection

Added a thin coach-green outline outside the normal bubble border and strengthened the green glow; dimensions remain unchanged. (The outline is superseded by the ring that follows the tail; see [Selection ring, tab height and recorder direction](#selection-ring-tab-height-and-recorder-direction--2026-09-29).) With no explicit selection, the newest active turn selects its partner reply when present, otherwise its learner message. Explicit selection remains stable as newer messages arrive; an unavailable selection returns to the latest-message default. The dock follows that effective selection. Automatic selection does not open the mobile coach panel.

Dock analysis now reads existing results without automatically requesting grammar just because selection followed a new message. The explicit Analysis action retains its request behavior. Updated feedback testing to explicitly reveal undisclosed hints, and scoped recording assertions to stream bubbles rather than also counting dock excerpts.

Verification: the prior disk-space blocker is resolved. Selection, TurnView and LiveCoachReview suites passed (83 tests), then the expanded conversation suite passed all 37 tests including newest learner→reply→next learner selection with zero commands. Build, fast validation and whitespace checks passed; existing canvas notices and bundle-size advisory remain. This pass did not perform a new visual browser inspection. Changes remain uncommitted.


## Scope decision — deferred follow-ups, 2026-09-29

The learner chose to stop before message-specific coach discussion ownership and revision history after Fix and resend. Both are deferred indefinitely, not scheduled or required to finish the current UI work. This decision supersedes earlier implementation sequences identifying them as the next tasks.

Keep the implemented message selection, selected-message feedback/analysis, automatic latest selection and green selection treatment. Coach discussion history remains conversation-wide. No per-message discussion ownership or revision-history browsing is claimed as implemented.

If explicitly resumed later, use the audit above as a starting point and recheck current code. Retain the proposed distinction between general questions and message-owned discussions, and the proposed rule that each revision owns its own discussion. These are deferred design notes, not current product behavior. No additional implementation or commit was performed for this scope decision.

## Selection ring, tab height and recorder direction — 2026-09-29

Status: implemented in the working tree, not committed; requested by the learner in the desktop app.

- Selection ring. The selected bubble's line now stands 2px outside it (`--bubble-ring-gap`, half the earlier `--space-2` at normal spacing) and follows the tail rather than cutting across it. `SelectionRing` adds one decorative element to selectable bubbles (partner replies in `TargetMessage`, learner messages in `TurnView`). In `messages.css` its `::before` is the rounded ring with the tail's corner cut away, and its `::after` is the ring round the tail. The tail piece's path is the tail curve offset by the gap and the line: one cubic, within 0.2px of the true offset, and an arc round the tip. Keyboard focus draws the same ring with a `--border-width-strong` line in place of the old outline; forced colours keep a plain outline. The learner's ring is mirrored with its tail.
- Chat and Practice tabs. At full width they were 45–47px against the bar's 40px controls. The tab's `font` shorthand reset `line-height` to `normal`, and `--font-sans` leads with a script face whose normal line is about twice the type size, so the 18px label got a 37px line. The label now uses `--leading-tight`; the tabs are the control height at every width, with the active tab level at the top and reaching over the place line.
- Folded coach tab. The folded coach was a rail down the conversation's whole height (full width: the collapsed column's button; compact: `.chat-coach-edge`) with a 3px coach-green leading edge, which the learner found distracting, especially on mobile. It is now a small tab at the top, only as long as its icon and name (79px against the 37px word). It keeps the 1px outline, with a `--border-width-strong` leading edge (half of 3px would render as 1px at 100% scaling, no heavier than the outline) and a fainter glow. The Practice cards edge tab, documented as matching the coach's, takes the same edge and glow.
- Recorder control row (Chat and Practice, every width). The learner found the row too bubbly and forward: bordered pills for settings, Type, Auto-send, Detect attempts and the desktop microphone picker, and a solid interaction-fill chip for the chosen mode. They are now quiet text-and-icon controls with no outline, a faint ink wash on hover and the interaction tint when on. The mode switch is a light track with the chosen mode as a raised `--sheet` chip in interaction ink, as the coach's tabs show theirs, so the pad stays the one strong control. On phones (≤400px) the row's labels take the switch's `--type-meta` and Practice's meter may narrow to 3rem, so the row fits beside the switch. A longer switch label (French "Détecter les tentatives") wraps instead of running under it; this also fixes an overflow Practice already had at 360px. Touch targets stay 44px; Auto-send and Detect attempts now meet that too.
- Sizes, second pass. With a pointer, the recorder row is `--control-height-xs` (28px) rather than 32px. Its text uses `--leading-tight`, and the desktop microphone select has a set height, because a select sizes its box from its font's own line spacing. Practice's level meter keeps its 44px touch height only on coarse pointers (it was tied to widths of 860px and below). The folded coach tab is twice its width (62px, at full width too) with its icon and name centred. The "Good job" / "N errors" verdict chip and Fix it are as tall as their text (20px, 12px icons); the feedback line still keeps 28px, so it does not move when the verdict arrives. Touch keeps 44px targets throughout. *Superseded by the third pass below: the learner wanted the tab longer, not wider, and the line's 28px minimum was the gap under the bubble.*
- Coach panel opening width (open question). The learner felt the coach column opens "too late" as the window widens, then said it is probably fine. It docks above the app's 860px compact/full tier; opening it sooner would need a lower, Chat-only breakpoint. Not changed.
- Recorder direction (decision, no change). The defaults stay: time runs in the script's direction (newest sound at the end edge), and the microphone sits at that edge, so new sound enters beside it. In a scrolling stream the picture moves against the time axis, like a news ticker. Putting the microphone at the start and letting the picture flow in reading direction would reverse each take against the text and the Practice comparison plots. Learners can still change both in Recording settings.

Verification: `tsc` clean; `vitest` 1453 tests pass (new: each selectable bubble carries its own hidden ring); fast validation and `previews:check` pass. In the conversation preview, which now selects bubbles on click, the gap measured 2px on every side at the 1px selected line and the 2px keyboard line. At 10× the ring follows both tails without seams, and it was also checked in the dark theme. The tabs measured 40/42px at 1280px with unchanged compact and narrow heights. Both changes were seen hot-reloaded in the running desktop app (screen capture only).

### Third pass — the learner's corrections

- Folded coach tab: longer, not wider. The width is back to a slim tab (31px compact, 38px at full width) and the tab is four control heights long (160px) with its icon and name centred, at both tiers. *The compact tab was later removed (next section); the full-width tab is unchanged.*
- Gap under the learner's message. It came from the feedback line's 28px minimum and XP's 28px. The line has no minimum now; every item on it (verdict chip, Fix it, XP and the plain states) is one 20px chip height, with a transparent border where nothing is drawn. The line sits 1.5px under its bubble and still does not move when the verdict arrives.
- Icons and words on the feedback line. Words sat about 1.3px above the icons. Cause: the Arabic reading face covers U+0020, so it is the first available font for all interface text. Its ascent and descent place every label's baseline 0.235em below the middle of its line box. Latin capitals (0.35em above the baseline) and CJK ideographs (0.38em) therefore sit high when the box is centred. Arabic words measured 0.18–0.47em, depending on marks and descenders. This is part of [ux-design-pass T1](ux-design-pass/README.md) and was not changed here. The chips now centre on the words' central line instead, 0.35em above their own baseline. A zero-width `::before` anchor sits on the baseline and claims the chip's height evenly around that line; the icons centre in it, and the words keep `--leading-none` so they never outgrow it. This does not depend on which face owns the space character, so it stays right if T1 changes the stacks. Touch-height chips wrap so `align-content` can centre their line.
- Recording panel divider. The resize handle was the composer's first child, above the help and status row, so that row read as part of the recording panel. The handle now comes directly before the panel. Its grip lies on the panel's green top edge; its own line is transparent at rest and shows only on hover or drag. The help and status row sits above it, outside the panel.
- Help with this reply (compact and narrow). Folded, it sits at the row's end, above the microphone and clear of the partner's replies; the status line takes the start. On phones the Coach pill stays at the very end, where its sheet opens. At full width, help stays in the coach panel as before.

Verification (third pass):

- Automated:
  - `styles:check`, fast validation, `tsc` and `previews:check` pass.
  - `vitest`: 223 files and 1454 tests pass. The new test checks that the divider's next sibling is the recording panel and that the help row precedes the divider.
- Conversation preview, 800px with a mouse:
  - Chip: 19.98px, the label's central line at 9.99px, the icons at 9.98px.
  - Phone width (coarse pointer): chips 44px, central line 21.99px, icons 21.98px.
  - Full width: the grip centre lies exactly on the panel's top edge.
  - English, Arabic (right to left) and Chinese labels, checked at 4×: aligned with no clipping, all chips 19.98px.
- Running desktop app (screen capture only):
  - Icons: unmoved.
  - "Good job" and "XP": one pixel lower, capitals now within 0.5–0.6px of the icons (1.5–1.6px before). The remainder is the text baseline snapping to whole pixels at the line's fractional position.

## Coach button below full width, and the help icon — 2026-09-29

Status: implemented in the working tree, not committed; requested by the learner.

- Decision: the coach has two presentations, not three.
  - Full width (over 860px): the docked panel, open or folded to its slim tab at the top of the conversation's edge.
  - Compact and narrow: the green Coach button at the end of the row above the answer opens the coach. It appears as the bottom sheet that phones already used.
  - The compact edge tab and side drawer are removed.
  - Practice's cards panel keeps its own compact edge tab and drawer; this request covered only the coach.
- Implementation:
  - `ConversationPage` and the conversation preview render the Coach button at every width below full, and no `.chat-coach-edge`.
  - `workspace.css` has one sheet rule for 860px and below. The 400px block and the edge tab's grid are gone.
  - `coaching-dock.css` styles only the full-width folded tab.
  - The sideways `surface-in-from-right` and `surface-in-from-left` keyframes, used only by the drawer, are removed from `motion.css`, whose header says every keyframe there is in use.
- Help with this reply: the folded button shows a circled question mark (`help`, new in `ToolbarIcon`) instead of the coach's light bulb, in the same place before the words. "Suggest a reply" inside the opened help keeps the light bulb.
- Design-system docs regenerated with `npm run design-system`:
  - The bundle and the ReplyHelp preview follow these changes.
  - The regenerated `thumbs-up.svg` also drops an embedded content-credentials metadata block that the committed copy carried. It remains in the history of commit 24a7016e.

Verification:

- Automated:
  - Styles, fast validation, previews, design-system and `tsc` checks pass.
  - `vitest`: 223 files and 1454 tests pass.
  - The compact-layout test now expects the Coach button in the row above the answer and no edge tab. Before the change it failed against the old code, which rendered `chat-coach-edge`.
- Conversation preview:
  - 800px: the row ends with Help with this reply and Coach. Coach opens an 800px-wide sheet from the bottom, with a 2px coach-green top edge and 16px corners, above the scrim, and its fold control points down. The fold control closes it.
  - 375px: the row is unchanged, with 44px touch targets.
  - 1280px: the panel stays docked, its help shows the new icon, and no Coach button appears.
- Running desktop app (screen capture only, at its current 530px width): no edge tab; the row above the recording panel ends with Help with this reply, with its question mark, and Coach.

### Vertical breathing room (compact and narrow)

Requested by the learner in the desktop app at phone width; implemented, not committed.

| Gap | Before | After | How |
| --- | --- | --- | --- |
| Learner's message to its feedback line | 1.5px | 3px | `.learner-turn` gap `--space-2`, at every width |
| Last message to the Help / Coach row | 7.5px | 12px | the row's top margin `--space-3` |
| Help / Coach row to the recording panel's green edge | 3px | 6px | the row's bottom margin `--space-4` |

Each gap keeps its grouping:

- The feedback line stays closer to its bubble than turns are to each other (3px against 7.5px).
- The row stays closer to the recording panel than to the conversation (6px against 12px), so it reads as part of the composer.

Verification:

- Measured in the conversation preview at 800px: 3px, 12px when the last message is settled at the bottom, and 6px.
- Style checks, fast validation, the design-system check (bundle regenerated) and `vitest` (1454 tests) pass.
- Not seen in the desktop app, which was on Practice at the time.

Second pass (supersedes the first where they differ). The learner found the first pass far too tight, especially the feedback line touching the partner's reply below it. That reply is in the same turn, so the gap came from `.turn-stack`, not the stream.

| Gap | Now | How |
| --- | --- | --- |
| Any change of speaker: inside a turn (feedback line to the partner's reply) and between turns | 15px (was 3px inside a turn, 7.5px compact and 9px full between turns) | `.turn-stack` and `.chat .stream` gap `--space-10`, at every width |
| Learner's message to its own feedback line | 3px (unchanged) | |
| Last message to the Help / Coach row | 22.5px (was 12px) | the row's top margin `--space-10` |
| Help / Coach row to the recording panel | 6px (unchanged) | |

Verification:

- Measured in the conversation preview at 800px: speaker changes 15px, feedback line 3px, row 6px, and the row 22.5px below a settled last message.
- The running desktop app (screen capture at 490px) shows the same.
- Style checks, fast validation, the design-system check (bundle regenerated) and `vitest` (1454 tests) pass.
