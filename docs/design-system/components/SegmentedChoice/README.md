One of a few options, shown as joined buttons with the chosen one raised.

Source: `SegmentedChoice` in `ui/src/components/controls/SegmentedChoice.tsx`, styled by `.segmented` in `buttons.css`. Used by the voice panel's Recording settings and the conversation start's Options.

## What you provide
- `label` — names the group for assistive technology (`role="radiogroup"`); each option is a `role="radio"` button.
- `value`, `onChange` — the chosen option and the change handler.
- `options` — `[value, label, tooltip?]` for each option, in order.
- `disabled` — optional; disables every option.

## Rules
- For two to five short, mutually exclusive settings that take effect when chosen. Longer lists use a select; actions use `.btn`.
- The chosen option is filled in `interaction-fill` with `ink-on-fill` text on the `chrome` track, so it reads at a glance; options reach `touch-target` height on coarse pointers.
- Where the visible label sits is the caller's layout (a row with the label beside it, or a grid of rows); the control does not draw one.
