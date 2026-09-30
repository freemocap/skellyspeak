# Practice tab: empty layout, starter phrases and card provenance (2026-09-29)

Status: implemented in the working tree, not committed. Round 1 and review
round 2 are both in the working tree. Round 2 was verified with the checks
listed under [Round 2 verification](#round-2-verification), in the offline
preview and in the running desktop app.

Design reference: the "Practice panel" design canvas (artboards 1, 2, 2b and 3).

## Implemented behavior

### Empty practice layout

- The Practice tab keeps its full layout with no cards, drawn by the real
  components in their own empty states. (Round 2. Round 1 drew hand-made
  placeholders in `EmptyPractice.tsx`; that file and its `drill-empty-*`,
  `drill-stage-empty` CSS are deleted.)
  - Stage: `DrillComparison` takes `target: null` for no card. The card area
    shows one plain, muted "No card selected" line; the reference and attempt
    plots are empty frames with no instructions; both Play buttons are
    disabled. Voice speed, time scale and time direction stay available.
  - Recording panel: the real `RecordDock` with `empty`. The pad, Tap / Hold /
    Auto and Detect attempts are disabled; the stream shows "Add a practice
    card to record.", which is also its announced status. Recording settings
    and the microphone choice stay available.
  - Attempt list: the real list in its own empty state. At full width that is
    the legend, Show unscored and "No attempts yet. Record one to compare.";
    on phones it is the compact history box (see open follow-ups).
- Only a card list that has been read and is empty says there are no cards
  (`empty` on both `DrillLayout` and `RecordDock`). While the list is being
  read the recorder shows its usual "Preparing the session" state; a list that
  failed to load shows its error with Try again.
- At full width the cards panel stays open while there are no cards (it cannot
  be folded) and is one large "Add practice cards…" button with "No practice
  cards yet" as its description. The phrase bar drops its own Add button then.
- In the compact and narrow layouts the phrase bar leads with "Add practice
  cards…" while there are no cards.

### Starter pop-up (`QuickStart.tsx`)

- Opens on entering Practice when the visit's first card list is empty, unless
  "Don't show this again" was ticked (`localStorage`
  `skellyspeak_practice_starter`, via `usePersistentToggle`). It is decided once
  per visit, so deleting the last card does not open it.
- Four levels: Absolute zero, Beginner, Intermediate, Advanced. Each has one
  line on what it holds, under its name in `ink-3` ("Single words and
  greetings", "Everyday short phrases", "Fuller sentences to ask and explain",
  "Longer, more natural speech"), which is also its button's accessible
  description. Each button says what it does ("Add 8 beginner phrases").
- Layout: two by two while a column can hold a level's button on one line, one
  level per row below that (a container query on the level list at 36rem, not
  `auto-fit`). Each card ends in its button, so the buttons line up and match
  in size. The list clears the dialog's floated close button, which would
  otherwise narrow it at compact widths.
- Absolute zero shows the language's authored greeting as a real target bubble
  (with Add to Practice), beside the level's name and line where the card is
  wide enough and under them where it is not. The bubble is capped by the card
  rather than by the chat stream's share of a column. The other levels have no
  sample.
- One press: one short-phrase generation request at that level, then every
  non-duplicate candidate is accepted, the preview is discarded, the card list is
  re-read with the first new card selected, and the pop-up closes. A failure
  stays on that level's card with Retry, above its button; nothing is added.
- A one-line tip shows the Add to Practice icon (`AddToPracticeHint`).
- "Don't show this again" is the shared form checkbox row (`.check-row`), in
  `type-ui` beside Close.
- The Add practice cards dialog no longer has a quick-start mode.

### Keeping a generated phrase

- Keep is the same icon-only control as a message's Add to Practice
  (`message-add-drill`, `deck-add` icon; accessible name "Keep “…”", tooltip
  "Add to Practice"). "Added" and "Already in your practice cards" stay chips
  in the same place. "Keep all N" is unchanged.
- Once there are results, one line above them reads "Click [icon] to add a
  phrase to your practice cards." `AddToPracticeHint.tsx` draws this line and
  the starter's tip (`tr.rich`, `.drill-hint`, `.drill-hint-icon`).

### Provenance on target bubbles

- `TargetMessage` takes a required `provenance: MessageProvenance | null`. Only
  a non-null value shows the "How this was added" tip (`MessageProvenance.tsx`).
  Every existing caller passes `null` except:
  - the practice card on the stage (`selected.source`, `createdAt`), and
  - generated candidates in the Add practice cards dialog (candidate source and
    the model's reported labels).
- The tip states: generated (with skill, length, level and topic when present),
  from a conversation (who said it), or added by the learner; the date added; and
  the model's own labels, kept separate from what the source records.
- `lengthLabel` moved from `CandidateList.tsx` to `MessageProvenance.tsx`.

### Other

- New `.btn.outline` (blue outline on a neutral ground) in `buttons.css`, used by
  the starter buttons and Generate.
- New strings added to all seven locales; strings orphaned by this work, and the
  already orphaned "Add a card to start practising.", removed. Round 2 adds seven
  strings and orphans none (localization usage: 0 removal candidates).
- `ui/tools/practice-empty-preview.html`: offline fixture for the empty layout,
  the starter (`?starter=closed` hides it) and a generated card's provenance tip
  (`?card=generated`). Generate and every starter level return eight fixed
  phrases (one already a card), and keeping one adds it to the fixture's list.

## Review round 2 (2026-09-29, from Jon in the desktop app)

Status: done in the working tree; the behavior is described above. Review
screenshots are in [practice-empty-state-2026-09-29/](practice-empty-state-2026-09-29/);
the `after-*` files there are the result (desktop app and preview).

1. Keep rendered as vertical "K e e p". Done. The cause was as reported: a text
   label inside the square `message-add-drill` control.
2. Starter layout. Done. The overflow was not `box-sizing` (the reset sets
   `border-box` everywhere). Each card was a grid with one implicit `auto`
   column, so a wide child could widen the column past the card and the
   full-width button with it. In the app, Absolute zero's greeting bubble has
   Play and Translate and is that wide child. Cards are now flex columns in
   `minmax(0, 1fr)` tracks.
3. Empty practice page. Done, using the real components; `styles:dead` lists
   none of the removed classes.

### Round 2 rulings

Decisions taken where the review left a choice or was silent:

- Starter columns: 2×2 above a 36rem level list, one level per row below it. A
  2×2 grid at phone width cannot hold "Add 8 absolute zero phrases" on one line.
  English labels do not wrap at any width; a translation longer than its column
  may wrap rather than overflow.
- Starter sample: the greeting shares the description row where the card is wide
  enough (the review's second option). In narrower two-column cards it sits
  under the line, as in `starter-two-columns.png`, and Beginner keeps a blank
  band of the bubble's height.
- "Add a practice card to record." appears only once the card list has been
  read and is empty, keeping round 1's rule that nothing claims there are no
  cards before the first read.
- With no card the plot frames carry no text; "No card selected" is the one line.
- Keep's tooltip is "Add to Practice", the icon's name everywhere; its accessible
  name stays "Keep “…”" so each phrase's button is distinct.
- The Keep hint appears with the results, not before them.

### Round 2 verification

Run on the local working tree (local `main` level with `origin/main` at
`c9b24b22`, plus the uncommitted round 1 and 2 changes):

- `npm run check:fast` (includes styles and localization sources and usage),
  `localization:test`, `previews:check`, `graph:check`: pass. `tsc --noEmit` in
  `ui/`: clean.
- `vitest run` in `ui/`: 223 files, 1452 tests, all pass. The 10 failures noted
  for round 1 no longer occur on this checkout.
- New or changed tests: no-card `DrillComparison` and `RecordDock` states; the
  empty page at full width and on a phone; no "add a card" claim before the
  list is read (fails if the recorder keys on "no card selected"); level
  descriptions as button descriptions; icon-only Keep and the hint line. The
  attempt-history tests wait for the card before taking the attempt list, which
  now exists, empty, before any card loads.
- `styles:dead`: 15 unused classes, all already unused at `HEAD`.
- Preview at 1280×800, 680×820 and 390×844: empty page, starter, and Add
  practice cards with results (Keep 28×28, 44×44 on touch; hint on one line;
  Added and duplicate chips). Starter buttons measured equal in size and aligned
  per row at each width.
- Desktop app (running dev build; Spanish (Spain); no cards) at 1308×799 and
  390×844: empty page, starter, and Add practice cards before generating; the
  empty page also in the dark theme. Keep was not checked in the app with real
  results, which needs a paid generation that writes cards; it is covered by
  the preview and tests.

## Open follow-ups

- Phone attempt list: with no attempts (with or without a card) the compact
  history box is blank apart from its expand control. It could carry "No
  attempts yet. Record one to compare." as the full-width list does.
- Starter phrases per level: add authored sample phrases for each level to the
  language configuration (`content/languages/*.yaml`), load them through the
  contracts, and show them on the Beginner, Intermediate and Advanced cards.
- "Open conversation" in the provenance tip: the source records
  `conversationId` and `messageId`, but opening a conversation from Practice
  needs a navigation action that switches to Chat and opens that conversation
  (today `openChat` lives inside `useConversation`). The conversation's title
  could be shown once that lookup exists.
- Check the empty layout and the starter with a right-to-left language. The
  dark theme was checked for the empty page only.
- `styles:dead` reports 15 classes unused before this work (for example
  `drill-add-await`, `drill-peek`, `drill-sheet*`, `coach-verdict`).
- Resolved: local `main` was five commits behind `origin/main` when round 1 was
  written; it is now level.
