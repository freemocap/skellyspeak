A dismissible error whose explanation stays visible while technical details are collapsed.

Source: `ui/src/components/feedback/ErrorDetails.tsx`, styled by `errors.css`.

## Props

- `label` — the operation or area, such as “Speech”.
- `explanation` — optional explicit failure explanation, announced with the label.
- `errorKey` — a new key re-shows an error the learner dismissed.
- `children` — plain text becomes the visible explanation when no explicit explanation is supplied. Other nodes contain expandable diagnostics and actions.

## Rules

Show the actual failure reason immediately. A category such as “Request failed” is insufficient when a more specific reason exists. Preserve redacted request IDs, error codes, models and validation details in the expandable content. State when the underlying system supplied no explanation; do not invent a cause or claim that retrying will resolve it.
