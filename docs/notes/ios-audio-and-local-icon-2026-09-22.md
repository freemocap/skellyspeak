# iPad audio and local build icon investigation

## Observed

After successful sign-in, the user reported silent playback, missing microphone
capture and a default Tauri installation icon. Device diagnostics from process
816 recorded `Microphone audio is missing.` at `mic_transcribe`. Hosted speech
generation succeeded and validated its WAV response. The log did not show a
playback failure explaining the silence.

The UI selected browser capture using Android/iPhone/iPad user-agent matching.
The native mobile implementation requires browser WAV input and does not capture
samples itself. Thus a desktop-style iPad user agent skips capture and reproduces
the observed missing-audio error. Native now returns `browserCapture` with the
recording ID; the UI follows that explicit contract instead of guessing the OS.

Local `ios init` scaffolds the default icon. The release workflow applied authored
artwork separately; the local diagnostic build had skipped that step. The root
Tauri wrapper now generates the authored icon before iOS build/dev, using temporary
output for other platforms and copying only iOS assets into the generated project.
It runs the same opaque-PNG conversion used by distribution. Generated artwork
was visually inspected and is the SkellySpeak logo.

## Playback hypothesis and implementation

Playback authority can stay blocked by a missing webview focus event, including
after external sign-in. A trusted interaction inside the visible webview now
restores focus authority. Visibility, page-hide and native-suspension blockers
remain independent; no historical speech is replayed. This is a possible cause
of the observed silence, not a confirmed device diagnosis.

## Verification

19 targeted recorder, browser recording and playback lifecycle tests pass.
The recorder test verifies browser audio reaches transcription despite a desktop
user agent. Lifecycle tests verify real interaction restores focus but synthetic
interaction, background visibility and native suspension cannot bypass blockers.
Contracts regenerated from Rust; formatting and diff whitespace checks pass.
Real device microphone, playback and installed icon verification remain pending.

Full UI verification: 161 test files, 1,084 tests passed. iOS debug archive build
succeeded; final bundle microphone purpose string and sign-in scheme registration
verified, and strict signature verification passed. The authored icon appears in
the generated catalog. Installed the updated development build on the attached
iPad for user testing; audible output and captured voice remain unverified.

## Second device attempt: browser decoding failure

The user reported audio worked once and stopped. New device process 829 logged a
microphone `EncodingError` with message `Decoding failed`. This is distinct from
the earlier missing browser-capture input. The compressed MediaRecorder output
was being passed to AudioContext.decodeAudioData before WAV encoding. No raw
recording was copied or inspected; the exact codec/container defect is unknown.

Replaced that compress/decode round trip with an AudioWorklet capturing mono PCM
samples, then the existing WAV encoder. The worklet batches samples, flushes its
last partial batch before acknowledging Stop, and does not monitor the microphone
through the speakers. Every recording owns a fresh stream/context/processor;
finish, cancellation, timeout and failure release them. Duration remains bounded
at two minutes, and a missing finish acknowledgement fails after five seconds.

Tests exercise three consecutive recording instances with different samples,
assert independent WAV contents and stream/context cleanup, and verify the
worklet's final partial batch precedes its completion acknowledgement. Sixteen
targeted tests pass. Actual repeated iPad recording remains pending a device test.
This diagnosis is for microphone conversion; it does not establish an independent
cause of speaker playback failure.

Verification after PCM replacement: all 1,086 UI tests across 162 files passed;
TypeScript/Vite and the iOS archive/export build succeeded, with the worklet emitted
as a bundled asset. Strict app signature verification passed. Installed the
updated build on the attached iPad. End-to-end repeated recording remains pending.
