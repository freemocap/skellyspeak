A spinner with a status label for work in progress.

Source: `ui/src/components/feedback/ActivityIndicator.tsx`, styled by `activity.css`.

## Props
- `label` — what is happening, with an ellipsis ("Generating a persona…"). Always required: screen readers announce it (`role="status"`).
- `compact` — hides the label visually, keeping it for screen readers; use it only where the context already says what is loading.

## Rules
- For streamed partner text, the stream caret (`.stream-caret`) shows progress instead.
