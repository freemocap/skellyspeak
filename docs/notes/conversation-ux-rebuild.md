# Conversation UX rebuild

Status: source implementation and browser layout review, 2026-09-15.

Historical implementation record: the later
[approved cleanup](patch-readiness-audit-2026-09-18.md#approved-cleanup-verification)
removed lessons and all mystery-persona behavior described below. Those entries
do not describe the current application.

## Intent and reference boundary

The user requested a voice-chat-centered rebuild using
`2026-09-13-4-30pm-skellyspek-ux-rebuild.zip`. Its conversation-workspace handoff
and screenshots were reviewed as design input, not repository instructions.
The static prototype was not copied into production or executed. The user then
requested top-level target-language selection and corrected small, off-center
persona icons and oversized composer text.

## Implemented

- One continuous chat/coach workspace; centered 680px thread and composer.
- Target-language selection in the global bar, through the existing settings
  writer and native conversation-selection path. Partner selection stays in the
  conversation header. Language switching opens an existing conversation or
  creates one through the existing native command path.
- History in the global bar; new conversation in the partner header; difficulty,
  explanation language and voice options in the conversation settings popover.
- Progress through its badge. More provides skill tree, activity and reload on
  desktop and mobile. Lessons remain available through the coach.
- Coaching/Evidence tabs, with mystery-partner information retained in the
  persona dialog. Coach resizing originally clamped to 320–520px; the 2026-09-21 correction
  removes those fixed bounds and permits resizing across the available workspace.
  Collapse has an edge tab.
- Mobile Chat/Coach navigation shows one surface at a time.
- A multiline composer with Record, Stop, Discard and Send, with recording waveform
  inside the field. Enter sends, Shift+Enter inserts a line, and IME confirmation
  does not submit. Recording/transcription states block draft submission.
- Composer text uses body size (15px base) and script scale, independently of
  reading size. Header/opening emoji are centered at 30px/36px; picker emoji use
  the shared avatar control size. These refinements follow the user's feedback.
- Playback, translation, saved word help and analysis remain explicit reply
  actions. Playback actions now sit below the bubble.
- Already-disclosed coaching appears beneath its source message; the coach no
  longer duplicates the full partner reply. Native disclosure, show-answer and
  retry behavior remain intact. Asking the coach opens/focuses that surface.
- Opening screen shows partner identity, one partner-start action and up to three
  native starter cards. Selecting a card starts that topic directly.
- Existing reward rendering, sounds, learning evidence, storage and provider
  behavior remain in their current owners. No native or server source changed.

## Deliberate differences from the prototype

- Connection status says Configured, not Connected: the available projection
  does not establish live provider connectivity.
- Input typography follows the user's smaller-input correction, not the
  prototype's reading-size field.
- Existing control-density preferences and coarse-pointer minimums remain.
- Suggestion words retain their saved gloss interaction; insertion remains a
  distinct arrow action. Suggested replies are visible when already available;
  requesting suggestions remains explicit. The prototype's More ideas request,
  generated turn-cue summary and dated session separators were not added.
- Coaching copy comes from saved native records, not hardcoded encouragement.
  Detailed error/recovery actions and full analysis remain available. Existing
  rewards were not replaced with invented sample session credits.

## Verification and review artifact

- UI production build, full frontend tests, preview TypeScript check, style
  validation and unused-style scan passed. The frontend suite passed 682 tests
  across 110 files. The build retains its existing large-JavaScript-chunk warning;
  the unused-style scan reports no unused classes. Preview type-checking passed.
- Browser inspection used production components in
  `ui/tools/conversation-preview.html`, with sample data and no native calls.
  Desktop and 390px phone layouts, opening state, recording controls, mobile
  coach navigation, warm/light and warm/dark roomy appearance, and cool/dark
  extra-tight appearance were inspected. Browser measurements confirmed 15px
  composer text, centered 30px header emoji and no document horizontal overflow
  in the inspected desktop state.
- The preview labels its sample state explicitly. Its controls do not establish
  microphone capture, transcription, playback, persistence or native language
  switching. Those need a running native application check. No app instance was
  launched or restarted, and no deployment was performed.

The existing large ConversationPage and TurnView owners were edited in place;
this UX change does not attempt their separate responsibility decomposition.
