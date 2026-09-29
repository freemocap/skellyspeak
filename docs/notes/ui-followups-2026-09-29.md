# Chat and Practice follow-up audit

Status: initial source audit followed by the first authorized implementation batch. The progress section below supersedes the initial no-change status; unresolved rows remain proposals or investigations.

Baseline: clean checkout at `v2.6.1` on 2026-09-29. Findings below are source observations, not phone reproduction results.

## Checklist and scope

| Item | Scope | Source finding and proposed next step |
| --- | --- | --- |
| Unselected Chat/Practice tab border | Small | `ui/src/styles/shell/layout.css` gives inactive tabs a transparent border. Keep a visible subdued outline on both; reserve strong color/glow for selection. Preserve dimensions to avoid layout shifts. |
| Desktop microphone picker | Small–medium | Shared `MicrophoneSelector` already saves the selected device through settings. `VoicePanel` currently exposes it inside Recording settings. Add a compact footer presentation using the same setting in Chat and Practice; retain the mobile/settings entry points and disable switching during capture/transcription. |
| Chat toolbar visibility | Medium | `MessageTools` already uses `useToolOverflow` to fit optional actions. Investigate actual bubble width, intrinsic sizing, measured gaps and font/touch sizing before replacing the algorithm. A short bubble can offer less room than the chat column. |
| Practice toolbar visibility | Medium | Practice uses shared reading surfaces, including `TargetMessage`/`MessageTools`. Audit card-specific controls too. Show all actions that actually fit, using the same measured-space policy; retain 44px touch targets. |
| Menus hidden behind/below content on Android | Medium investigation | The message menu is absolutely positioned below its trigger, inside the content tree. Scroll clipping, viewport placement and stacking contexts can defeat a larger z-index. Reproduce each menu, then use the existing shared overlay/top-layer approach where appropriate, with placement above the trigger near the bottom edge. |
| Expand/collapse individual bubbles | Medium | Chat bubbles have width caps, with different learner/partner wrappers. Add an explicit per-message expansion control and let content height grow naturally. Keep compact as default; selection and expansion must be independent. First decide whether “more height” means revealing currently hidden assistance or simply allowing the expanded content to grow. |
| Select messages to inspect coaching/analysis | Medium | Structured coaching is already attached to turns. `ConversationPage` chooses a pinned turn or the latest active turn; the partner Analysis action pins a turn and opens a dialog. Learner bubbles do not have equivalent selection. Introduce explicit message identity including speaker, visibly select either side, and show its existing coaching or analysis. Preserve text selection, word help, playback and edit interactions. |
| Coach discussion history owned by message | Larger | `CoachAnalysisPanel` renders conversation-wide `coachMessages`; `askCoach` supplies conversation identity and question text, without a source-message identity. Message selection alone cannot establish durable ownership. Agree how message-specific discussions and general questions coexist, then change ownership, persistence, request context and views together. |
| Previous chat attempts | Medium for retained revisions; larger for full branches | Revised source turns have replacement links and remain in snapshots; the stream filters out `replacedBy` turns. A read-only revision viewer can expose that retained chain. However, editing an earlier turn deletes the subsequent non-coach conversation suffix in `native/src/conversations/revision.rs`. Full alternate conversation branches would require a separate retention design and cannot recover already-deleted data. |
| Missing XP coin sound on phone | Investigation; fix size unknown | `reward-sounds.ts` silently returns false for disabled mode, blocked playback, zero volume, hidden document, non-running audio context, detached/offscreen target or queue delay over 0.45 seconds. Defaults can follow read-aloud and XP effects can disable sounds. Check cue dispatch plus every gate on device, including after recording and app resume. Do not assume audio volume or autoplay is the cause. |
| Less rich word glosses | Investigation; fix size unknown | Current word popup renders meaning, romanization or pronunciation from saved/cached segments. Existing help suppresses a fresh lookup when a saved meaning exists. The shared prompt explicitly requests short contextual glosses; richer passage explanations are a separate aid. Recent history includes a September 27 compact mobile word-help restoration. This establishes several possible presentation/data causes, not a confirmed quality regression or proof that an older system was removed. |

## Proposed sequence

1. Implement the inactive tab outline and compact desktop microphone picker.
2. Reproduce toolbar sizing and menu layering together, then fix the shared owners. Check both Chat and Practice before calling either complete.
3. Add reversible bubble expansion, after settling the intended expanded contents.
4. Diagnose phone sound and gloss richness with concrete examples. Record observed cause separately from proposed fixes.
5. Review message selection, coach-thread ownership and attempt history as one focused product pass. Start with existing per-message evidence and retained revisions; treat new durable coach ownership and full branch history as separately scoped work.

## Decisions for the focused review

- Does “previous chat attempts” mean revisions made with Fix and resend, earlier recordings/transcripts, separate chats, or complete alternate branches? These are different records. Practice already has a paginated attempt history; that does not establish a Chat recording-history feature.
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
- [ ] Finish the separate Practice card-navigation overflow audit. `DrillLayout.tsx` still hides Random card and Add practice cards under More whenever the width tier is mobile, irrespective of actual room. This is distinct from the shared message toolbar addressed above.
- [ ] Bubble expansion, sound and gloss investigations, message selection, coach discussion ownership and history remain pending.

Verification: production build passed (bundle-size advisory remains); style checks passed; preview tooling type checks and diff whitespace checks passed. Final focused suites plus architecture checks passed: 16 files, 188 tests. Existing canvas mocks emit unsupported-canvas notices; those tests passed. Updated recorder test fixtures to support device enumeration from the newly visible picker and across dialog remounts. Added portal/Escape/focus assertions to the existing toolbar regression test.

Visual inspection used production components in offline Chat and Practice previews at 1440×1000 and 390×844. Confirmed inactive outlines, desktop picker placement, narrow-layout settings access, disabled Practice picker while simulated recording, and inline reading actions when space fits. Confirmed Chat overflow opens above its trigger and stays within the phone-width viewport. These fixtures use sample microphones and do not verify real capture, device switching, touch WebView rendering or speaker output.

No commits, releases or deployments were performed. Changes remain in the shared checkout.
