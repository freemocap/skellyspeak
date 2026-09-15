# Wave 3: fluency timing foundation

## Bounded scope

This round prepares strict provider timing parsing, local PCM energy analysis and
word alignment, plus hosted multipart support for `verbose_json` and repeated
`timestamp_granularities[]` values. The existing live recording path still requests
plain JSON and carries text only. No new fluency feature is claimed in the app.
The server change is source implementation, not a hosted deployment.

Groq's API reference specifies verbose JSON for word/segment timestamps
([@groq_transcription_api]). Both values must survive multipart forwarding.
Duplicate or unknown granularities and timing requests with plain JSON are errors.
Existing decoding limits and duration-based accounting remain in effect.

The signal analysis is an uncalibrated energy heuristic. It cannot establish that
sound is speech or that a word was hallucinated. Alignment retains the original
transcript and reports unsupported words separately; it does not silently rewrite
messages. No syllable-rate estimate, clause classification or proficiency score
is introduced.

## UI ownership audit and next integration

The UI agent traced `useMicRecorder` → `GuidedPage.onTranscribe` → shared
`InputEvidence` → native submission. The callback currently drops empty text,
which would hide a notice when all words are removed. Typed edits also retain
speech provenance. Future timing receipts must bind recording ID, conversation,
exact transcript and draft/edit identity; native acceptance must validate that
the submitted text still matches. Typed revisions cannot reuse old alignment.

Structured results must reach the UI even with empty text. Any eventual removal
notice belongs above the composer and with the submitted message, including
auto-send. Missing timing belongs in the explicit evidence view as unavailable,
never as zero fluency. No UI code changed in this audit.

## Verification

Completed: 595 frontend tests, 315 native tests (one live test ignored), and 233
server tests (seven environment-dependent tests skipped). Build, formatting,
Clippy and documentation checks passed. The first full native run caught an
invalid bibliography review-state label; it was corrected and the full native
suite passed on rerun. Timestamp forwarding is tested through the real server
handler with controlled upstream responses. The six native timing tests use
synthetic silence/noise/clicks, speech-like regions, stretched word endpoints,
multilingual text, invalid timestamps and zero-speech input. No real-recording
accuracy claim is made.

No live inference, deployment, schema reset, application restart or
Git writes are authorized or performed in this round. Complete message persistence,
custom-endpoint timing capability and learner-visible notices remain subsequent
work. The local signal heuristic requires real recording validation before use
as a transcript-removal gate.
