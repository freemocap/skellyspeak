# One-row top bar and chat header — 2026-10-07

Status: implemented and verified in the layout preview, in headless Edge at true
viewport widths with and without touch, and across live coach panel open/close.
Not yet checked in the running desktop app or the phone build.

## Rule

The top bar and the chat header are one row at every width. Nothing in them
wraps. When a row is short of room it gives up parts in a fixed order, decided by
measuring the row itself, never by the window width: the chat header's room also
changes when the docked coach panel opens or closes.

## History

- **First pass (superseded).** At 860px and below the header was made one row by
  moving difficulty into the settings sheet and hiding the counters' glyph and unit
  at 480px and 400px. All three were window-width rules. Review on 2026-10-07 found
  three failures, reproduced in the preview with the learner's setup (Irish,
  181 total XP):
  - 360px window: the top bar's progress pill took 177px and the language picker
    showed "G…" (14 of 45px).
  - 412–860px: difficulty was hidden although the header had 300px or more to spare.
  - 900–919px with the coach open: the header was 94px tall, because the identity
    still wrapped above 860px and the select dropped to a second row.
- **Current design (implemented).** Both rows measure their own room.

## Decision (implemented)

**Chat header**, fullest layout first:

1. Everything: counters with their shape and unit, difficulty beside the partner.
2. Compact counters: the points drop their shape (the Progress tab draws it
   large) and XP drops its unit and padding; difficulty stays.
3. Difficulty in the settings sheet, where it is the first group; counters full.
4. Difficulty in the settings sheet and compact counters.

A layout fits when the partner's whole name shows and nothing runs past the row.
When none fits, the last is kept and the partner's name shortens with an ellipsis.

**Top bar:** the progress pill folds to the skill level (radar and "Lv N") when the
target language's own name would otherwise be cut, or the bar would overflow. The
language picker is one line at every width: the variety gives way first, then the
language's name in the interface language. While folded, the reward pop sounds and
flashes on the pill instead of the hidden XP number. The XP numbers stay in the
Progress page and in the chat header's counters.

## Implementation

- `ui/src/components/layout/useFitStage.ts`: tries a bar's layouts in order by
  setting its `data-fit` attribute and keeps the first without overflow. It runs
  synchronously before paint, and again when the bar resizes, its content changes,
  the root element's appearance attributes change, or a font loads.
- `ui/src/features/conversation/session/ConversationHeader.tsx`: the header's four
  layouts and fit test; it reports where difficulty is (`onDifficultyPlace`).
- `ui/src/features/conversation/ConversationPage.tsx`: always gives the select to
  the header and, while the header reports no room, to the settings sheet too.
- `ui/src/app/shell/TopBar.tsx`: the bar's two layouts and fit test, and the
  reward pop's anchor.
- `ui/src/features/settings/language/LanguagePickers.tsx`: the endonym span has
  the `learning-picker-endonym` class the fit test measures.
- Styles: `features/conversation/header.css` (no wrap anywhere, difficulty layout,
  one-line picker), `features/conversation/reward-presentation.css` (compact
  counters), `shell/layout.css` (folded pill).
- `ui/tools/conversation-preview.tsx` renders the production language picker and
  evidence. `?lang=irish|indonesian|…` picks the target and `?coach=closed` starts
  with the panel closed.
- `ui/tools/one-row-bars-preview.html` shows both bars at 16 widths and tabulates
  the layout each bar chose, wraps, overflow and cut names. It accepts the same
  query parameters.

## Measurements

Headless Edge with a true viewport, partner "Uxía Castro", target Irish unless noted.

| Viewport | Top bar | Header layout | Difficulty |
|---|---|---|---|
| 360px | folded | 4, name shortened | sheet |
| 412px | full | 4 | sheet |
| 520px | full | 2 | header |
| 649px | full | 1 | header |
| 861px, coach open | full | 3 | sheet |
| 919px, coach open | full | 2 | header |
| 919px, coach closed | full | 1 | header |
| 1228px, coach open | full | 1 | header |
| 412px, Bahasa Indonesia | folded | 4 | sheet |
| 649px, Bahasa Indonesia | folded | 1 | header |

In every capture both bars are one row, nothing overflows, and the language's own
name shows whole. Touch emulation at 360px and 412px gives the same layouts. The
649px fold for "Bahasa Indonesia" comes from the Practice and Progress labels,
which still follow the window-width rule at 600px.

## Verification

- `useFitStage.test.tsx`: fullest fitting layout, last-layout fallback, return to
  a fuller layout on resize, refit on content change and on root appearance
  change. Disabling the content observers fails the last two.
- `ConversationHeader.test.tsx`: the four layouts in order, and difficulty
  returning to the header when the row regains room.
- `ConversationPage.conversation.test.tsx`: difficulty stays in the header in a
  narrow window with room, and leads the settings sheet in a wide window without.
- `TopBar.test.tsx`: the pill folds while the endonym would be cut and unfolds
  with room; the reward pop plays on the pill while folded.
- Live coach toggles in headless Edge: 919px open (layout 2, header 540px) to
  closed (layout 1, 868px); 861px closed (layout 1, 810px) to open (layout 3, 482px).
- The in-app browser pane cannot check resizing: while hidden it runs no animation
  frames or resize observers. Its measurements are valid only for first layout.
- `npm run check:fast` passes, and `vite build` bundles. The full UI suite has 1919
  passing tests and one failure, in `GuideDocument.test.tsx`. `tsc` reports seven
  errors in `domain/reading/saved-reading-result*`. Both come from concurrent
  uncommitted work outside these files, so `npm run build` stops at `tsc`.

## Open

- Check the running desktop app and the phone build.
- `npm run previews:check` still fails in other fixtures (`skill-levels-preview`,
  `xp-payout-preview`, `practice-preview`, `progress-preview`), which predate this
  work. The conversation preview's coach tab type drift is fixed here.
