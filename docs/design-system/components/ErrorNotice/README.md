An inline error with a compact corner X. Source: `ui/src/components/feedback/ErrorNotice.tsx`; styles: `errors.css`.

Pass the stable failure value as `error`, and include its explanation, retry actions and expandable diagnostics in `children`. Dismissal hides the presentation without clearing the underlying failure or diagnostic record. A different failure value reappears; object failures distinguish repeated attempts with the same message. String failures must be cleared between attempts to distinguish identical messages.

The control is positioned at the logical trailing corner, reserves no action row, supports keyboard focus, and keeps a 44px touch target. `as` preserves paragraph or inline semantics where needed; use the default block wrapper for diagnostics and other block content.
