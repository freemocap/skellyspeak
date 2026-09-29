# Chat and Practice follow-up audit

Status: initial source audit followed by two authorized implementation batches. The progress section below supersedes the initial no-change status; unresolved rows remain proposals or investigations.

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
