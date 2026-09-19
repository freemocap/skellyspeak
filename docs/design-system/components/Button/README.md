The shared action button (`.btn`), with primary, default, danger and tiny variants.

Source: `ui/src/styles/components/buttons.css`. It is a class, not a React component: put it on a native `<button>`.

## Variants
- `.btn` — default: `sheet` fill, `line` border, `ink` text; hover lifts to `chrome` with an `ink-3` border.
- `.btn.primary` — the one main action in a view: `interaction-fill`, `ink-on-fill` text, `interaction-fill-hover` on hover.
- `.btn.danger` — destructive actions (delete, reset): `danger-line` outline, `danger-ink` text; fills with `danger-fill` on hover.
- `.btn.tiny` — compact secondary actions: `type-meta`, wide tracking.
- `:disabled` — half opacity, no hover.

## Rules
- At most one `.primary` per view. Labels are short sentence-case verbs ("Review", "Retry failed").
- Height comes from `control-height` (32px compact / 40px standard, 44px on touch). Don't set heights.
- Use `.btn.danger` for anything that deletes data, and confirm first.
