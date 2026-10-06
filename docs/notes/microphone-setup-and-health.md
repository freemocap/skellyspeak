# Optional microphone setup and capture health

Implemented in source, 2026-10-05. Physical-device validation remains outstanding.
This extends the earlier recorder-feedback audit; its earlier statement that native
source was unchanged applies only to that first batch.

## Learner behavior

The existing onboarding access screen includes an optional microphone picker and
Test microphone action. No additional mandatory step, spoken phrase, AI access,
or successful test is required. Existing Continue and Set up later retain their
meaning. Merely mounting the card lists inputs and reads the selected device;
it never requests microphone capture. Browser device names may remain unavailable
until permission is granted.

The same test lives with the microphone picker in Settings and Chat/Practice
recording settings. An explicit press shows pending feedback immediately, opens
the selected input, displays the actual device label when the platform supplies
it, and shows a live level meter. Sound detected only means a signal reached the
app, not that speech was understood, clear, or from the intended device.

Stop test, leaving the surface, changing selection, or capture lifecycle
suspension stops the test. Frontend tests stop after 15 seconds; native ownership
also expires after 20 seconds if the webview disappears. Late startup is cleaned
up by its original identity. No finish/transcribe operation, AI request, saved
clip, or audio upload is part of the test. Audio exists briefly in memory for
level measurement. A failed stop retains capture exclusion and exposes retry.

Chat and Practice display the actual capture label and signal observations during
recording. Auto mode retains its existing native dB meter rather than adding a
second meter. Browser track termination produces an immediate capture error.
No arriving sample batches for three seconds stops active capture with a
connection message, without starting transcription. Four seconds without an
observed RMS level above 0.001 produces an advisory quiet-input message; delivered
silence is not a missing stream, and it does not automatically stop recording.
Ordinary pauses are allowed and subsequent sound clears the warning.

These are conservative initial thresholds, not validated microphone-quality
criteria. The visual meter uses available samples (including downsampled waveform
samples on some paths); it is not a calibrated loudness, speech, pronunciation,
or clipping assessment. No language-dependent rules are involved.

## Ownership and boundaries

- Native `speech/recording/microphone_test.rs` owns a separate, transient test
  session. Test startup and normal recording startup acquire the test lock before
  the existing capture lock, preventing overlapping native capture owners.
- Desktop tests use the existing capture implementation. Mobile tests use the
  browser recorder in streaming mode with a local sink and no audio retention.
- The shared frontend capture authority excludes playback while testing.
- The pure `domain/audio/microphone-health.ts` monitor separates sample delivery
  from signal amplitude. The recorder hook owns cancellation and diagnostics;
  presentation components translate observations into messages.
- Rust exports the new test result and actual capture device label. Contracts
  were regenerated, not edited manually. No persisted format or migration changes.
- Onboarding saves device selection through the existing microphone commands;
  it does not add a second preference or onboarding completion flag.

## Verification

- 181 selected UI/architecture tests passed, including the full Practice page,
  Settings, onboarding, recorder hooks, browser capture and command registration.
- Native library suite: 827 passed, 5 ignored; no failures.
- Native Clippy with warnings denied, binary check, and generated-contract check
  passed.
- Fast checks and production UI build passed. Build retains its bundle-size advisory.
- Extra design-system generation check remains blocked by an unrelated
  ConversationFeedbackCard preview fixture lacking `feedback.answers`; this is
  not a passing documentation-generation check.
- No live OS permission, physical microphone, unplug/reconnect, or mobile WebView
  test was performed. Automated tests simulate these lifecycle boundaries.

## Focused follow-up

Validate thresholds with quiet voices, muted devices, Bluetooth reconnects,
permission delays, input processing and app suspension on desktop/mobile. A
functioning but unintended microphone cannot be reliably identified from audio
alone; actual-device labeling and the explicit local test address that case.
Noise/clipping assessment, local playback review, and a pre-upload confirmation
for suspiciously quiet clips remain outside this initial signal-check pass.
Do not infer microphone failure solely from an empty transcription result.

Other uncommitted language/configuration work in the shared checkout was preserved.
No commit, deployment, release version, or tag was created.
