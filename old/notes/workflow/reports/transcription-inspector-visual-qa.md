# Recording inspector visual verification

Date: 2026-09-13

## Rendered surfaces

Used the existing Vite process at `http://127.0.0.1:1420`, with an ignored
`.local/transcription-inspector-qa` fixture importing the production
`TranscriptionInspector`, `DetailDialog`, and application styles. Audio data and
transcript were explicitly synthetic; no provider calls or live recordings.
Screenshots were inspected inline through the browser tool, not saved as files.

- Light, 1280 × 720: waveform, colored spectrogram, frequency labels, detected
  activity, common time axis, intensity legend and original Spanish/Arabic text.
- Clicking the timed `jardinería` word displayed its label on the waveform,
  highlighted its interval across both plots, and exposed clipped/provider times.
- Dark, 360 × 800: unavailable provider timings were stated explicitly, with no
  invented word controls. Final page scroll width was 360px; dialog width 324px.
  No horizontal page overflow. The modal retains its own vertical scrolling.
- Keyboard focus selection and overlay toggle are covered by production component
  tests. Browser screenshots establish rendering, not native microphone behavior.

## Fixes based on inspection

- Replaced stretched SVG tick text with ordinary text on a shared aligned axis.
- Expanded the narrow plot-label column to avoid clipping `Spectrogram`.
- Used a non-scaling waveform stroke so the dark narrow plot remains visible.
- Sampled spectral windows render at native `frameStartSeconds`/`windowSeconds`,
  including unsampled gaps, rather than uniformly stretching frames across time.

## Automated checks

- Recorder hook: 11 tests pass, including wrong conversation/recording rejection,
  stale result isolation, completed inspection disposal and empty transcript.
- Inspector: 3 tests pass, covering unavailable timing, keyboard word selection,
  overlays, clipping and unchanged original transcript, and explicit modal close.
- Parent full frontend suite: 602 tests pass. Parent build passed after generated
  type integration. Final stylesheet check passed after visual corrections.

## Limits

The native application and microphone were not exercised in this review because
its desktop was previously locked. No device, provider timing quality, sound or
native save behavior is claimed verified. The inspector stores only the latest
completed original recording inspection in volatile conversation-scoped UI state;
no audio retention or attachment to edited draft text was introduced.
