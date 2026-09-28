The message composer: Chat's voice panel, where the learner speaks or writes in the target language.

Source: `ComposerInput` in `ui/src/features/conversation/composer/ComposerInput.tsx`, built on the shared `VoicePanel` (`ui/src/components/media/VoicePanel.tsx`) and styled by `components/voice.css`. It lives inside `.chat .composer`. Practice uses the same panel through `RecordDock`.

## Layout
- A two-by-two grid: the face (the stream while recording, the draft, or one arrow pointing at the pad with "Press the microphone to start") with the microphone pad at its inline end; one row of controls under the face; the Tap / Hold / Auto toggle under the pad.
- The pad is only ever the microphone icon: `interaction-*` when ready, `recording-fill` with a `recording-mark` outline and `recording-glow` while recording, faded while waiting.
- The control row never wraps: Recording settings, then Type and Auto-send. Chat's Auto is shown and answers "Coming soon".

## Props the caller provides
- `input`, `onInput`, `onSend` — the draft and its handlers. The draft opens from Type or when there is text; Enter sends; Shift+Enter adds a line.
- `available`, `sending`, `recording`, `transcribing`, `autoSend`, `onAutoSend` — state owned by the conversation; the panel only reflects it.
- `mode`, `onMode`, `onHoldStart`, `onHoldEnd` — Tap or Hold.
- `targetLanguageTag`, `targetLanguageName` — sets `lang` and the placeholder ("Write in Spanish…").
- `onToggleRecording`, `onDiscardRecording`, optional `stream` (the live waveform over the spectrogram, the same `LiveRecording` Practice shows), `settings`, `micShortcut`, `transcriptionWarning`.
- The page puts a drag grip above the panel; a dragged height goes to the face.

## Rules
- Red means recording and nothing else; errors keep the danger family.
- No standing instruction on the surface: the phase is announced to screen readers, and keyboard hints are tooltips.
- Recording and request ownership stay with the caller. Never put send logic in the panel.
