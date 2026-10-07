# Read-aloud status card (2026-10-07)

Audit, decision and implementation for the small fixed card that appears
bottom-right while reading speech loads, plays or fails. Status: implemented;
verification results at the end.

## Audit (what the card was)

- `.reading-audio-status`, rendered by `ui/src/components/reading/ReadingHelp.tsx`
  and portaled to the body as a manual popover; positioned by
  `ui/src/styles/components/reading.css`. ReadingHelp is mounted app-wide from
  `ui/src/app/ReadingTools.tsx`, so the card can appear on any page.
- It belongs to reading read-aloud: every speaker control that goes through the
  shared reading actions (word speaker in hover help and Word help, saved-gloss
  words, phrase actions, the learner's typed bubble, pending bubbles, skill guide
  examples). Partner replies use `useMessageSpeech`, a separate path.
- The AI status pill does not cover this work. It knows partner-reply speech and
  Drill card audio only; word and phrase read-aloud never reaches it, and the
  speaker button only swaps its icon. The card was therefore the only progress
  line, the only Stop control and the only failure surface for that path.
- Three states. In flight: a status line and Stop reading. Failure: the friendly
  error notice, Response details, Retry, Close. Success: the card stayed until
  Close, showing a collapsed Response details of the speech receipt (ReadingTools
  maps the result to its receipt; the component contract and previews carried the
  whole result, audio included). The success state was the blank white box.
- Defects: the notice's own × hid the notice but left the box with only Close;
  no layout (children stacked in flow, 8px padding, no row, no motion).

## Decision

Keep the card, narrow it to in-flight and failure, remove the success state,
restyle it as a compact toast on the app's floating-card recipe. On a phone the
card rises in the page's tray slot above the recording panel instead of covering
it; on a wide screen it floats bottom-right as before. Approved in review after
a browser mockup built from the app's own stylesheet.

## Implemented behavior

- `ui/src/components/reading/ReadAloudStatus.tsx` owns presentation and
  placement: spinner and "Loading speech…" while audio is fetched, speaker icon
  and "Reading aloud…" while it plays, Stop reading beside either; on failure the
  ErrorNotice (inner dismiss off, no inner Retry) with Retry and Close in one
  actions row; nothing after success. The toast carries `data-level` from the
  friendly error so the card itself takes the level colour.
- ReadingHelp keeps the state: it no longer stores the speech receipt, and the
  card renders only while speaking or after a failure. Receipts remain in the AI
  panel's "Reading request history".
- Placement is the app's decision: `ReadAloudSlotContext` (ReadingContext.ts)
  carries a host element; ReadingTools provides the AI tray slot while the width
  tier is compact or narrow, otherwise null. With a slot the card renders in flow
  (`data-placement="slot"`); without one it is a manual popover in the body
  (`data-placement="corner"`). Shared components do not import the store.
- Modal inspectors host it: a modal dialog makes everything outside its subtree
  inert, so the floating card's Stop, Retry and Close were unreachable while
  Word help or Message analysis was open (a click landed on the dialog and
  closed it instead). `ReadAloudHostContext` lets the open inspector register
  its content; ReadingHelp then portals the status into that content, where it
  still floats bottom-right as a popover above the dialog. The partner message
  analysis dialog registers the same way. The popover is re-shown whenever its
  host changes, since a moved portal gets a fresh, still-hidden node.
- Styles: `.reading-audio-status` in components/reading.css, with
  `.reading-audio-line`, `.reading-audio-actions`, level and placement variants,
  `panel-rise` entry, coarse-pointer control height and reduced-motion handling.
- Fixture: `ui/tools/audio-status-preview.html` renders the real ReadingHelp
  with a stubbed speech service that plays for 2.5 s or fails three ways, laid
  out like Chat on a phone with a recording panel that offers the tray slot.

No translation keys were added or removed.

## Not changed

- Read-aloud still does not feed the AI status pill; the toast is its surface.
- `docs/design-system/components/bundle.css` copies the app cascade and still
  holds the old rules: `npm run design-system` fails before this change on an
  esbuild error for `recording-worklet.ts?worker&url` in
  `platform/audio/browser-recording.ts`, which this work does not touch.

## Verification

- `ui/src/components/reading/ReadAloudStatus.test.tsx` (7 tests, written
  first and watched fail): line while loading and playing then gone after
  success, Stop cancels, recognised failure as the card with Retry and Close and
  no inner dismiss, unnamed failure at the broke level, Retry re-speaks the same
  selection, slot placement in flow, corner placement as a popover, hosting
  inside an open Word help dialog and floating again once it closes.
- `ui/src/app/ReadingTools.read-aloud.test.tsx` (2 tests): phone uses the
  recording panel's tray slot; wide screen floats even when a slot exists.
- ReadingHelp suite and `tests/architecture/boundaries.test.ts` pass.
- Browser, fixture page at 800px (compact): line rises above the recorder,
  switches to playing, leaves on its own; failure card lands in the slot and
  Close removes it. At 1280×900: manual popover in the body, 6px from the right
  and bottom edges, offline failure in the warning tint, Retry with a playing
  outcome shows loading then playing then nothing. Dark theme checked.
- Full UI suite: see the handoff summary for the run on the final state. Two
  failures reproduce without this change and in files it does not touch:
  `src/app/shell/TopBar.test.tsx` (a "Total" row in the languages card) and
  `src/components/reading/TargetPhrase.test.tsx` (inline target-text count).
