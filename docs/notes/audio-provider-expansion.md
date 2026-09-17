# Audio provider expansion

## Agreed direction

Separate recognition (STT), synthesis (TTS) and chat routing. Use typed internal
requests/results with provider-specific transport adapters. Introduce ElevenLabs
first, Azure second, then audio capability/status UI. Comparative language-quality
evaluation is deferred by the user; integration and correctness tests are required.
Provider documentation supports initial selection, not a claim of tested quality.

Preserve recording, playback, operation ownership, admission, cancellation,
credential isolation, bounded responses and explicit retries. Deployment remains a
separate authorized action. Hosted secrets and user-owned credentials have distinct
owners; do not put secrets in language content or UI bundles.

## Implemented checkpoint: native audio boundary

`ai::audio` owns the internal synthesis and transcription inputs/results and the
entry points used by recording, scheduling and publication. Synthesis admission
validates through that boundary without returning provider JSON to conversation
code. Existing adapters retain their payload construction and response validation.

Whisper-compatible transcription HTTP and its loopback tests now live in transport,
outside connection settings. Word timing is normalized into `TranscriptTiming`;
alignment does not require Whisper segment probabilities. Those segments remain
optional, explicitly named diagnostic evidence. Text-only output has no invented
timings. Synthesis results preserve partial usage and failures.

This is an internal seam extraction, **not completed independent configuration or
a provider switch**. Current routes, model defaults, stored schemas, credentials,
hosted endpoints and frontend contracts are unchanged. Shared HTTP error reading
still resides in connection access; relocating that shared helper is not needed
for this checkpoint. Existing large speech/fluency files retain cohesive decoder
and timing suites; this change is not a general file-size cleanup.

## Next checkpoints

1. Independent persisted STT/TTS selection, captured with each attempt. Distinguish
   access mode (hosted/direct/custom) from provider/protocol. Update hosted contracts,
   credential checks and accounting together; remove hard-coded OpenAI voice and
   two-letter language assumptions at the adapter boundary.
2. ElevenLabs adapters, local server configuration and minimal credential controls.
   Normalize audio, timings, usage and errors. Preserve verbatim learner speech.
3. Azure adapters and endpoint/region configuration, with explicit provider choice
   rather than automatic retry/fallback after a charged request.
4. Model/language/voice capability catalog and UI. Keep documented support, observed
   quality and connection availability distinct; allow experimental recording.

## Verification

Passed: 70 AI tests (including localhost HTTP adapters), 20 speech/diagnostic tests,
and 96 conversation-execution tests (3 existing ignored tests; the queue-budget
test below explicitly excluded). The 12 speech request/publication tests also
passed individually. Strict library Clippy, formatting, generated-contract check
and whitespace checks passed.

The full native suite is **not green**. The unchanged starter-persona test requires
exactly three vibe traits, while the Italian, Irish and Scottish Gaelic content
has two (the validator permits two). The unchanged
`queue_budget_counts_chat_coach_and_paused_work_transactionally` test remained
running for several minutes; those broad runs were stopped, then the remaining
execution suite completed with the explicit exclusion above. Initial sandboxed
HTTP fixtures could not bind localhost; their rerun with localhost access passed.

No paid provider requests, application restart, deployment or quality evaluation
has been performed for this checkpoint.
