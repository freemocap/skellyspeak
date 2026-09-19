A collapsible, dismissible error: a short summary that expands to the details.

Source: `ui/src/components/feedback/ErrorDetails.tsx`, styled by `errors.css`.

## Props
- `label` — the short summary ("Request failed"), announced as an alert.
- `errorKey` — a new key re-shows an error the learner dismissed.
- `children` — the details: what happened and what is kept or what to do next.

## Rules
- Write the summary in plain words; put codes and raw messages in the details.
- Say what is safe ("Your message is saved") before what failed, when that's true.
