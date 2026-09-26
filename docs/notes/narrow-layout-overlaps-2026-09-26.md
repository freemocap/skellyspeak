# Narrow-layout overlap fixes — 2026-09-26

Verification result for three reported UI overlaps. Each was reproduced before the
fix and re-measured after it. Measurements below come from a temporary layout
harness that loaded the production stylesheets verbatim (the flattened
`ui/src/styles/index.css` import order) into a local page rendered by headless Edge
at exact viewport widths. The harness was review tooling and has been removed.

This note records observed behavior, not a general layout policy.

## 1. Partner-reaction chip covered the reply text

**Symptom.** The small reaction chip on a partner reply sat on top of the first
line. Worst on a phone, where it could hide the start of the reply.

**Cause.** `.persona-reaction` (persona.css) is absolutely positioned at
`top: -17px; inset-inline-start: 9px` and reserved no space in the text flow, so the
reply's first line ran underneath it. Two separate collisions were measured:

- Horizontal: the chip's right edge sat 5.5px past the text start in every case
  with a chip (`intrusionPastTextStart: -5.5`), covering 35.7px² of the first line.
- Vertical, coarse pointers only: `reset.css` applies
  `@media (pointer: coarse) { button { min-height: var(--touch-target) } }`, which
  grew the chip from `-17..11` to `-17..27` and took its covered area from
  effectively zero to about 11px of the first line.
- RTL: the speech control's reserved gutter is also on the inline-start side, so
  the chip additionally started underneath the speech button.

**Fix (implemented).**

- `foundations/tokens.css`: added `--reaction-badge-gutter: 35px` and
  `--reaction-badge-size: 28px`. The chip is now fixed in every density and pointer
  mode, so the line below it always has the same clearance and no coarse-pointer
  `min-height` can enlarge it (`min-height: 0` plus an explicit height).
- `features/conversation/persona.css`: the chip uses those tokens, rides higher
  (`top: calc(-1 * var(--space-11))`), and an RTL reply starts it past the speech
  control.
**Measured after the fix** (fine pointer, 1256px viewport, both directions):
`COVERS_TEXT=no`, `covered=0px²` for chip and speech control on long and short
replies. With the coarse-pointer sizing mirrored: same result, chip stays 28px.

**Rejected first attempt.** Reserving the chip's width as a bubble gutter also
cleared the text, but it left a dead gutter down the whole left side of every
bubble carrying a chip, and made the reply narrower than the same reply without
one. Raising the chip instead costs nothing horizontally: measured bubble width is
identical with and without the chip (`246.3px` both ways), because the chip rides
in the bubble's existing top padding and overhangs the outline. That overlap of the
outline is preferred, not a defect: it keeps the vertical space useful.

**Left as-is.** The chip remains a 28px target on a coarse pointer rather than the
44px touch target. It is a status readout with its own dialog, not a primary
control. If a 44px target is required, the chip needs a designed second row inside
the bubble instead.

## 2. Narrow chat header squashed the partner name / overlapped controls

**Symptom.** At narrow desktop and phone widths the partner name was squeezed and
the control row sat on top of it.

**Cause.** `.conversation-title` kept `flex-basis: auto`, so it never shrank below
the name's min-content width, while `.chat-heading-actions` (`flex: none`) kept its
full width. The row overflowed and the two boxes overlapped.

**Measured before the fix** (596px viewport, long partner name):
`conversation-title [13.5..263.8]`, `chat-heading-actions [269.8..582.5]` — a
collision of about 876px². The control row's own min-content was 313px, so the
`New` button was squeezed from 56px to 14px.

**Fix (implemented, `features/conversation/header.css`, `max-width: 860px`).**

- `.conversation-title` becomes `flex: 1 1 0; min-width: 0`.
- `.partner-identity` and its `strong` may shrink to nothing, and the name
  truncates with an ellipsis instead of wrapping.
- `.chat-heading-actions` stays `flex: 0 0 auto`, so its controls keep their size
  rather than clipping.
- Below 600px the settings button's secondary summary line is hidden. The button
  already carries the same text in its accessible name, so nothing is lost to a
  screen reader.

**Measured after the fix.** At 400–860px the name truncates
(`scrollWidth 211 > clientWidth 111`) with no unrelated-box collisions and no
clipped control. At 676px and above the summary is visible again and the row fits.

## 3. Language menu broke every name into a column of characters

**Symptom.** In a phone-width window the top bar's language menu rendered each
language name as a vertical staircase of characters, and the variety submenu sat on
top of them.

**Cause.** Two independent problems:

- `.language-dropdown-panel` was `width: 100%` of `.language-dropdown`, which is as
  wide as the trigger. At a 375px-wide bar the trigger is 144px, so the panel was
  144px and the label column only **56.3px** — while "العربية (Arabic)" needs
  89.1px and "Español (Spanish)" needs 122.6px.
- `.language-dropdown-label` was `overflow-wrap: anywhere`, which is what turned the
  overflow into one character per line instead of a clean truncation.

**Fix (implemented, `features/conversation/header.css`).**

- The label is an identity, not prose: `white-space: nowrap` with an ellipsis.
- Below 860px the panel stops being sized to the trigger: `inline-size: max-content`
  with `min-inline-size: 100%` and `max-inline-size: calc(100vw - var(--space-8))`.
  It is wider than the bar, which is right for a menu, and it covers the controls
  beside the trigger while open. Desktop keeps the trigger-matched panel.

**Measured at a 375px bar.** Label column **56.3px → 165.3px**; every label on one
line; panel on screen at `{l:3, r:256.9, t:45.5, b:181.5}`.

**Regression to avoid: do not make this panel `position: fixed`.** The first attempt
did exactly that to escape the bar's `overflow-x: hidden`. It silently broke the
menu: `inset-block-start: 100%` then resolves against the viewport instead of the
bar, so the panel opened one full viewport height down — off screen — and pressing
the trigger appeared to do nothing. The `overflow-x: hidden` on the narrow bar does
not in fact clip the absolutely positioned panel, so no escape is needed.

**Earlier reading, superseded.** A first pass concluded the picker "did not shrink"
and added `min-width: 0` down the chain (`.topbar-language`, `.language-dropdown`,
the picker's grid columns and its label row). The real defect was the *panel* sized
to the trigger, so those rules were treating the symptom. They have been removed.

Also not a defect: the top bar was never overflowing its siblings. An earlier
reading that suggested a child collision compared the picker against its own
descendants; the picker's siblings fit, with the picker ending at the bar edge.

## 4. Composer placeholder wrapped to two lines

**Symptom.** In a narrow window the composer placeholder ("Write in Español
(Spanish)…") wrapped onto a second line.

**Cause.** The composer is passed `languageLabel(...)`, which formats as
*endonym (English name)* — `Español (Spanish)`. That is right for the chat-history
label, where the English name disambiguates, but it is the longest possible string
for a narrow single-line field.

**Fix (implemented).** `ConversationPage.tsx` passes `targetLanguage.endonym` to the
composer instead, so the placeholder reads "Write in Español…". The chat-history
label keeps the full form. This matches what the existing `Tour.test.tsx` already
expects (`getByPlaceholderText('Write in Español…')`).

**Measured.** Placeholder text width against the field's inner width, at four field
widths (380/340/300px, and with the old longer string): every case fits on one line
(118.4px of 211.6px at the widest; 118.4px of 131.6px at 300px). The old string
measured 183.0px, which is the case that was close to wrapping.

## 5. Disabled Send arrow was nearly invisible

**Symptom.** The composer's send arrow was too faint to read.

**Cause.** `.send:disabled { opacity: 0.5 }` faded the arrow to roughly 1.7:1
against its field. The opacity also muted the button's own outline, so the whole
control receded.

**Fix (implemented, `features/conversation/composer.css`).** Opacity is gone; the
disabled state is expressed with `color: var(--ink-3)` and the enabled state keeps
`--interaction-ink`. A disabled arrow is now muted but plainly visible, and it turns
accent-coloured the moment the learner types — a useful signal rather than a
faded-out control. The outline stays at full strength in both states.

## Follow-up

- Check the language picker at a narrow window in the running app.
- The header still shows two controls plus the XP chip beside the name below
  480px; the name gets very little room. If that reads as cramped, the next step is
  a deliberate narrow-header layout (the control row on its own line, or the XP
  chip collapsing to its star), not a smaller squeeze.
