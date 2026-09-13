# Wave 3: transcription inspector

## Scope and ownership

The recorder retains its simple live waveform. A separate inspector presents the
latest completed recording's derived waveform, STFT spectrogram, local audio
activity and available provider word alignment on a shared time axis. The
inspection belongs to a recording and conversation, not the mutable composer.
Editing text does not relabel the recording. Navigating away discards the volatile
inspection; raw audio is not saved for replay and older recordings are not loaded.

Native code computes bounded arrays from the PCM WAV used for transcription.
Spectral colors encode decibels, not proficiency. The local activity gate remains
an energy heuristic with explicit limitations. Unsupported words are identified
separately; the original transcript remains unchanged.

Direct Groq transcription can request verbose word/segment timestamps. Hosted and
custom routes retain their current JSON request and report word timing unavailable;
there is no automatic retry or route fallback. Hosted timestamp source support
from the previous slice is not a deployment or a server capability negotiation.

The UI uses a native-generated typed result and validates recording/conversation
identity before accepting it. The existing receipt and admission path still
governs whether transcription can be published. No timing evidence is attached to
learner estimates in this slice.

## Verification

Native checks passed: the full suite reported 320 passing tests and one ignored
live test; a further focused cross-rate tone test also passed. Inspector tests
cover spectral peak location/power, 8–192 kHz sample rates, bounded long recordings,
invalid WAV input and aligned/unsupported words. Transport tests inspect actual
multipart requests over local HTTP and distinguish verbose direct Groq from
plain-JSON hosted/custom routes. Clippy and contract generation passed.

The full frontend suite passed 602 tests, including recording ownership, stale
result handling, original transcript presentation, missing timing, keyboard word
selection, clipping labels, overlay toggling and modal dismissal. Build, styles,
generated contract checks and documentation checks passed. The UI agent inspected
the production component using synthetic data at 1280px light and 360px dark,
including word selection and unavailable timings. The pass fixed compressed time
labels, a clipped narrow heading and a faint dark waveform. The final narrow view
had no horizontal overflow. See `transcription-inspector-visual-qa.md`.
After those presentation fixes, the build and 14 focused hook/inspector tests
passed. Native microphone/device and live provider verification remain pending
because the Mac is locked; these checks do not claim actual recorded speech QA.
No Git writes, deployment or paid
inference are part of this round.
