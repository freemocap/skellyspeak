The shared modal for detail views: reports, explanations, YAML, evidence.

Source: `ui/src/components/dialogs/DetailDialog.tsx`, styled by `dialogs.css`. It portals a native `<dialog>` into the body and opens it modally. The preview shows the same markup placed inline, because a static render can't open a modal.

## Props
- `title` — the dialog's accessible name and close-button label.
- `children` — the content; start with an `<h2>`.
- `onClose` — called on the close button, Escape and a backdrop click.
- `size="wide"` — for wide data reports (learner model tables, YAML).

## Rules
- One dialog at a time. The backdrop is `appearance-scrim`; the surface uses `floating-shadow`.
- Keep content-specific layouts (like the audio timeline) as explicit variants, not new dialogs.
