The message composer: where the learner writes or records in the target language.

Source: `ComposerInput` in `ui/src/features/conversation/composer/ComposerInput.tsx`, styled by `composer.css`. It lives inside `.chat .composer`.

## Props the caller provides
- `input`, `onInput`, `onSend` — the draft and its handlers. Enter sends; Shift+Enter adds a line.
- `available`, `sending`, `recording`, `transcribing`, `autoSend` — state owned by the conversation; the composer only reflects it.
- `targetLanguageTag`, `targetLanguageName` — sets `lang` and the placeholder ("Write in Spanish…").
- `onToggleRecording`, `onDiscardRecording`, optional `waveform`, `micShortcut`, `transcriptionWarning`.

## Rules
- The frame is `field` with a 1.5px `line` border and `radius-xl`; text is `type-body` times the script scale.
- Recording and request ownership stay with the caller. Never put send logic in the composer.
