The message composer: Chat's voice panel, where the learner speaks or writes in the target language.

Source: `ComposerInput` in `ui/src/features/conversation/composer/ComposerInput.tsx`, built on the shared `VoicePanel` (`ui/src/components/media/VoicePanel.tsx`) and styled by `components/voice.css`. It lives inside `.chat .composer`. Practice uses the same panel through `RecordDock`.

## Layout
- A two-by-two grid: the face (the stream while recording, the draft, or one arrow pointing at the pad with "Press the microphone to start") with the microphone pad beside it, on the side set in Recording settings; one row of controls under the face; the Tap / Hold / Auto toggle under the pad.
- The pad is only ever the microphone icon: `interaction-*` when ready, `recording-fill` with a `recording-mark` outline and `recording-glow` while recording, faded while waiting.
- The control row never wraps: Recording settings, then Type and Auto-send. Chat's Auto is shown and answers "Coming soon".
- The panel is a zone in its place's colour, like the side panels. It has a thin outline, a stronger top edge facing the content, and a tint behind its controls: `coach-*` in Chat (`composer.css`), `practice-*` in Practice (`drill.css`). The face, pad and controls stay neutral working surfaces; the pad is opaque so a tint cannot muddy it.
- Recording settings offer the microphone button's side (Left or Right) and the stream's time direction (Time → or ← Time), independently. Each panel keeps its own choice on the device; until then the button sits at the end of the reading direction and time runs the same way (`useRecorderLayout`).

## Props the caller provides
- `input`, `onInput`, `onSend` — the draft and its handlers. The draft opens from Type or when there is text; Enter sends; Shift+Enter adds a line.
- `available`, `sending`, `recording`, `transcribing`, `autoSend`, `onAutoSend` — state owned by the conversation; the panel only reflects it.
- `mode`, `onMode`, `onHoldStart`, `onHoldEnd` — Tap or Hold.
- `targetLanguageTag`, `targetLanguageName` — sets `lang` and the placeholder ("Write in Spanish…").
- `onToggleRecording`, `onDiscardRecording`, optional `stream` (the live waveform over the spectrogram, the same `LiveRecording` Practice shows), `settings`, `layout` (the pad side and time direction, from `useRecorderLayout`), `micShortcut`, `transcriptionWarning`.
- Optional `prompt`: what the empty face says instead of "Press the microphone to start". A new conversation passes the greeting to say ("Say **hola** to start", the greeting as a `.target-word`), and screen readers reach it, since it adds something the pad does not.
- The page puts a drag grip above the panel; a dragged height goes to the face.
- In the compact and narrow layouts, the page puts one row above the panel: reply help, the status line and, when narrow, the Coach button at its end (`.composer-assist`).

## Rules
- Red means recording and nothing else; errors keep the danger family.
- No standing instruction on the surface: the phase is announced to screen readers, and keyboard hints are tooltips.
- Recording and request ownership stay with the caller. Never put send logic in the panel.
