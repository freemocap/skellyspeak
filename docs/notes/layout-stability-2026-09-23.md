# Chat and Drill layout stability — 2026-09-23

Status: agreed direction, first implementation pass done (uncommitted), verified
with automated tests and a measured preview. Not yet checked in the running
Tauri app.

Design canvas: "Stable Chat and Drill" (private Artifact, owner's gallery).

## Decision

Async results must fill space that is already there, not add elements. The six
rules agreed on the canvas:

1. Slots, not conditionals: a region that will receive system data renders at its
   final footprint on first paint; results change what is inside it.
2. One control per reading aid carries that aid's progress; no separate status
   blocks, lines or activity rows inside the thread.
3. Preferences reserve space; clicks expand.
4. During a turn, heights only grow at the tail.
5. Follow the tail only when the reader is at the bottom; otherwise report it.
6. Drill regions keep fixed frames; empty, loading and failed states draw inside
   them, and each error sits in the region that failed.

## Implemented

Chat:

- `TranslationStatus` moved to `components/reading/` and takes `shown`. Pending
  translation is a one-line reserved slot only while the translation is set to
  show and has no text; otherwise it is an announced status that takes no space
  (`.hydrating-announce`), and the Translate control carries `is-hydrating`.
  `TargetMessage` takes `translationState` and keeps its Translate control on
  screen while translation is pending.
- `GlossAssistance`: pending word meanings no longer add a line; a line appears
  only for partial, held, failed or empty results.
- The per-turn activity line is gone from the thread. The latest exchange's
  activity (with its 3 s linger) shows in the composer's status row, which now
  has a fixed height (`LatestTurnActivity`).
- The pending reply has the landed bubble's shape: a reading line in the landed
  typography (`target-text`), the read-aloud gutter, and a footer in the actions
  slot. When reading aids are on, it also reserves the translation line and the
  annotated line pitch (`.aids-reserved`).
- The feedback badge always straddles the learner bubble's bottom edge, and the
  bubble always reserves that room. Previously arriving scores switched layout and
  added padding. Long corrections truncate; the dialog has the full text.
- `useConversationScroll` follows content growth (ResizeObserver) while pinned,
  and reports a changed tail as unseen while the reader is scrolled up; the stream
  shows a sticky "New messages" button.

Drill:

- Reference and take plots always have a frame (`.drill-plot-frame`) at the plot
  height; empty, loading and failed states draw inside it. Word-timing rows keep
  their height (`.drill-word-slot`). The seek slider is always present, disabled
  without a reference.
- The reference failure draws in the reference frame; the microphone failure sits
  in the dock pane. Page-level failures stay above the stage.
- `TakeQueue` holds its first row with an idle slot, so a new take fills a reserved
  row rather than pushing the report column down.

New strings in all locales: "New messages", "Loading reference…", "Next take",
"No take in progress".

## Verification

- `npm test`: 1217 passed (two consecutive full runs). One earlier full run had a
  single timeout-like failure in the existing DrillPage test "wires repeated
  takes…"; it passed 3/3 alone and in both later full runs.
- `npm run build`, `npm run styles:check`, `npm run localization:test`, the
  preview type-check and `npm run graph` pass.
- New tests: translation and word-meaning progress take no layout space unless
  set to show; no activity line in the thread; feedback badge place is constant;
  pending reply bubble shape; unseen-tail reporting; Drill frame states; idle
  take slot.
- `ui/tools/stability-preview.html` renders one exchange at four moments with
  measured heights. Exchange height at 643 px width:

  | Auto-translate | Before (sent → streaming → landed → settled) | After |
  | --- | --- | --- |
  | off | 205 → 232 → 313 → 220 | 219 → 223 → 220 → 220 |
  | on  | 205 → 232 → 368 → 302 | 287 → 287 → 300 → 302 |

## Open

- With word meanings set to show, glosses widen words and can wrap text onto
  another line when they arrive (+13 px in the sample). This cannot be known before
  the glosses exist.
- The canvas's visual chip redesign (status dots, fixed chip widths) is not done;
  this pass carries state on the existing message controls.
- Drill's "latest take" card moving into history, and the dashed match-chart slot,
  are not done.
- Browser scroll anchoring handles growth above the viewport; WKWebView (macOS/iOS)
  support should be checked in the running app.
- Not yet exercised in the running Tauri app.
