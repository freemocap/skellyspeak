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
- `features/conversation/persona.css`: the chip uses those tokens; an RTL reply
  starts it past the speech control.
- `features/conversation/messages.css`: the bubble reserves the chip's gutter.
  RTL reserves the wider of the two, because both controls share the lead gutter
  there.

**Measured after the fix** (fine pointer, 1256px viewport, both directions):
`COVERS_TEXT=no`, `covered=0px²` for chip and speech control on long and short
replies. With the coarse-pointer sizing mirrored: same result, chip stays 28px.

**Left as-is.** The chip remains a 28px target on a coarse pointer rather than the
44px touch target, because a 44px chip cannot clear the first text line without
reserving a full extra row. It is a status readout with its own dialog, not a
primary control. If a 44px target is required, the chip needs a designed second
row inside the bubble instead.

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

## 3. Language picker in the top bar did not shrink

**Status: partly addressed; needs a check in the running app.**

A reproduction showed the top bar's language picker keeping its intrinsic width
and extending about 6–12px past the bar's content edge, with the language name
wrapping to several lines rather than shortening. `min-width: 0` is now set down
the chain (`.topbar-language`, `.language-dropdown`, the picker's grid columns, and
its label row) and the label truncates with an ellipsis.

This one could not be fully confirmed in the harness: its synthetic picker does not
wrap the way the real `LearningPicker` does, so the final geometry is unverified.
It needs a look in the running app at a narrow window.

Not changed: the top bar was **not** overflowing its siblings. An earlier reading
that suggested a child collision was comparing the picker against its own
descendants; the picker's siblings fit with the picker ending at the bar edge.

## Follow-up

- Check the language picker at a narrow window in the running app.
- The header still shows two controls plus the XP chip beside the name below
  480px; the name gets very little room. If that reads as cramped, the next step is
  a deliberate narrow-header layout (the control row on its own line, or the XP
  chip collapsing to its star), not a smaller squeeze.
