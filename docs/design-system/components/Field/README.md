Labelled form inputs (`.form-row`) and the bare text field (`.field`).

Source: `ui/src/styles/components/fields.css`.

## What you provide
- `.form-row` wrapping a `<label>` and an `<input>` or `<select>`; the label sits above in `type-ui` / `ink-2`.
- `.field` on a standalone input or textarea that should grow in a flex row.
- `.field-note` for help text below a field (`ink-3`).

## Rules
- Fields sit on `field` with a `line` border and `shadow-input`; focus turns the border to `interaction-ink`.
- Under 860px wide, field text grows to `type-reading`.
- Checkboxes use `.check-row .check-label`; their accent is `interaction-fill`.
