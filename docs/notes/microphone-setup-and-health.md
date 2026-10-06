# Microphone setup and capture health

Implemented in source. Signal monitoring and the native local test landed
2026-10-05; the presentation was rebuilt 2026-10-06 after review. Physical-device
validation remains outstanding. This extends the earlier recorder-feedback audit;
its earlier statement that native source was unchanged applies only to that
first batch.

## Learner behavior (2026-10-06 presentation)

The 2026-10-05 presentation mounted the whole tester inside the shared device
picker, so the recorder's own control row grew a Test button, a device line, a
meter and two sentences. That is superseded. The microphone now has three
surfaces, each with one job:

- **The lamp**, in the recorder's control row after the settings button
  (`components/media/MicrophoneLamp.tsx`, mounted by `VoicePanel`). A dot and the
  word Mic, as quiet as Type or Auto-send. Grey at rest when the saved device is
  listed. While recording, the connected green, glowing with the level. Amber and
  "Quiet" after four seconds without an RMS level above 0.001. Red and "Stopped"
  when no sample batch has arrived for three seconds. Red and "Not connected"
  when the saved device is absent from the device list, cannot be opened, or
  when no input exists at all. A live recording outranks the device list, which
  can lag an unplug or a reconnect. The sentences live in the lamp's accessible
  name and tooltip (with the actual capture device's name), and problems are
  announced through a polite live region; nothing under the recorder grows.
  Pressing the lamp opens Recording settings. Narrow widths keep only the dot
  while all is well and keep the word for a problem.
- **The check**, one row under the device picker
  (`components/media/MicrophoneCheck.tsx`): a Check microphone button, a thin
  level bar and a few words: "Say something", "Hearing you" or "No sound. Check
  mute or move closer." with the seconds left and the input that actually
  opened, then "Heard you" or "No sound heard" when it ends. "Local check.
  Nothing is saved or uploaded." shows only while it runs. It is mounted in
  Recording settings (every width), Settings › Voice › Microphone and onboarding
  step 2. It is never mounted in the recorder's row or the desktop footer.
- **Two notices over the face**, where the eye is while recording. Sustained
  quiet (the lamp's amber state) is also a band across the live stream with the
  same sentence; it is visual only, since the lamp announces it. A manual
  recording that never carried sound above the floor, and ran at least one
  second (shorter presses count as accidental), leaves a card over the face
  when it stops: "It sounds like nothing reached your microphone." with Check
  microphone and Dismiss. Check microphone opens Recording settings and starts
  the check at once (`MicrophoneCheckStart` context); the next recording, a
  change of owner or Dismiss clears the card. The take is still transcribed as
  before; the card only adds the likely cause. The recorder hook exposes this as
  `silentTake` / `dismissSilentTake`; Practice's listening mode cuts attempts by
  its own threshold and never raises it.
- **Device presence** (`platform/audio/useMicrophonePresence.ts`): the saved
  choice is checked against the device list on mount, when the choice changes
  and on the platform's `devicechange` event, without requesting microphone
  access. A failed listing is reported as a fault and shows as an unknown state
  with the reason in the lamp's tooltip, not as an alarm.

The shared picker (`MicrophoneSelector`) is a picker again: the select and
Refresh, with the "(not connected)" option for a saved device that is missing.
Onboarding keeps the optional picker and gains the check row; completing
onboarding still never depends on microphone access or a successful check. The
Practice recorder's Auto mode keeps its native dB meter in the row; the lamp
sits beside it.

Sound detected only means a signal reached the app, not that speech was
understood, clear, or from the intended device. The thresholds are conservative
initial values, not validated microphone-quality criteria. The level bar and the
lamp's glow use available samples (including downsampled waveform samples on
some paths); neither is a calibrated loudness, speech, pronunciation or clipping
assessment. No language-dependent rules are involved.

## Capture behavior (unchanged from 2026-10-05)

An explicit press starts the local test: it opens the selected input, shows
pending feedback immediately, names the actual device when the platform supplies
it and polls a level every 100 ms. Stop, leaving the surface, changing selection
or capture lifecycle suspension stops it. The frontend stops after 15 seconds;
native ownership also expires after 20 seconds if the webview disappears. Late
startup is cleaned up by its original identity. No finish/transcribe operation,
AI request, saved clip or audio upload is part of the test; audio exists briefly
in memory for level measurement. A failed stop retains capture exclusion and
exposes retry.

During recording, browser track termination produces an immediate capture
error. No arriving sample batches for three seconds stops active capture with a
connection message, without starting transcription. Four seconds without an
observed RMS level above 0.001 is advisory: delivered silence is not a missing
stream, so recording continues and later sound clears it.

## Ownership and boundaries

- Native `speech/recording/microphone_test.rs` owns a separate, transient test
  session. Test startup and normal recording startup acquire the test lock before
  the existing capture lock, preventing overlapping native capture owners.
- Desktop tests use the existing capture implementation. Mobile tests use the
  browser recorder in streaming mode with a local sink and no audio retention.
- The shared frontend capture authority excludes playback while testing.
- The pure `domain/audio/microphone-health.ts` monitor separates sample delivery
  from signal amplitude. The recorder hook owns cancellation and diagnostics;
  `useMicrophoneTest` owns the check's session and countdown; presentation
  components translate observations into words.
- `VoicePanel` takes `device` (the saved choice) and `microphoneCheck` (the check
  row for its settings dialog) from its owners; Chat and Practice pass both.
- Styles: `components/microphone.css` owns the picker row, the check row and the
  level bar; the lamp belongs to the recorder in `components/voice.css`. The
  lamp's glow reads `--lamp-level`, a root token written from the component.
- Rust exports the test result and actual capture device label. Contracts were
  regenerated, not edited manually. No persisted format or migration changes.
- Onboarding saves device selection through the existing microphone commands;
  it does not add a second preference or onboarding completion flag.

## Verification (2026-10-06)

- Full UI suite: 276 files, 1,843 tests passed, including new suites for the
  presence hook, the lamp, the check row, the recorder's row and face notices,
  the recorder hook's silent-take signal, and the updated onboarding tests.
- Fast gate passed (localization sources and usage with 0 removal candidates,
  styles, diagnostic policy, tooling tests). Production UI build passed.
- `conversation-preview.html` gained a Mic fixture (sound, quiet, stalled,
  missing), a Silent take switch (also set by stopping in the quiet scene) and
  the check in Recording settings; the desktop control row measured one 28 px
  line: settings, lamp, picker, Type, Auto-send.
- `onboarding-live-preview.html` answers the microphone commands with a sample
  device and signal, so step 2's block and its check can be reviewed there; its
  missing `execution` preference was added while editing it. `previews:check`
  still reports two pre-existing type errors in other preview fixtures
  (practice, progress), unrelated to this work.
- Browser probes of both previews (DOM state, aria names, computed colours with
  transitions disabled) confirmed the lamp's five tones in light and dark
  themes, the check row's countdown and result, and that the recorder shows no
  device or signal prose under its grid.
- No live OS permission, physical microphone, unplug/reconnect or mobile WebView
  test was performed. Automated tests simulate these lifecycle boundaries.

## Focused follow-up

Validate thresholds with quiet voices, muted devices, Bluetooth reconnects,
permission delays, input processing and app suspension on desktop/mobile. Confirm
that WebView2 and the mobile webviews deliver `devicechange` for the inputs
native lists; if they do not, re-list when Recording settings opens and when a
recording starts. A functioning but unintended microphone cannot be reliably
identified from audio alone; actual-device labeling and the explicit local check
address that case. Noise/clipping assessment, local playback review, and a
pre-upload confirmation for suspiciously quiet clips remain outside this pass.
Do not infer microphone failure solely from an empty transcription result.

No commit, deployment, release version, or tag was created.
