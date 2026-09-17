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

## Checkpoint 1: native audio boundary (ffbd7ac)

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

## Checkpoint 2: independent audio settings

Implemented separate persisted `audio.transcription` and `audio.speech` settings,
each containing its own access route and model. Chat keeps its existing route and
Standard/Fast models. Changing chat access leaves both audio selections unchanged.
The resolver captures the selected capability's endpoint, model, credential
reference and settings revision. Missing credentials do not select another route.

Model saves atomically validate and persist all model/audio settings using the
existing revision and invalidation rules. Late audio cannot publish after a
settings change; its usage remains recorded. Minimal Models controls expose the
two audio routes and models; the existing access tabs are explicitly labeled Chat
access. Rich capability/quality UI is still deferred.

Schema 19 replaces the old transcription-model column with typed JSON audio
settings. Older development workspaces require explicit Factory Reset; no migration
or data reset was performed. Native-generated UI contracts now expose AudioSettings
and AudioRouteSettings. Existing server payloads/endpoints still work unchanged:
this checkpoint selects access modes, not new server-side vendors. Direct access
still uses the existing OpenRouter TTS and Groq STT adapters. Provider identity and
provider-specific credentials for ElevenLabs/Azure remain part of their integration.

## Checkpoint 3: ElevenLabs adapter foundation

Implemented server-internal typed audio requests, results, receipts and an adapter
protocol in `server/app/inference/audio_contracts.py`. `elevenlabs.py` implements
that protocol with a fixed credential destination, one HTTP request, bounded reads,
a total deadline, redirect refusal and no automatic retries. Shared HTTP client
authentication, cookies and other provider key headers are not forwarded.

Synthesis sends source text directly, disables text normalization, selects 24 kHz
PCM and returns a standard mono WAV. Voice IDs are supplied explicitly; the
adapter does not pretend OpenAI voice names identify ElevenLabs voices.
Transcription accepts two- or three-letter hints independently of Whisper's list,
disables event tags and cleanup, preserves script/wording, and normalizes word
timings. Silence, invalid timing and malformed responses fail explicitly. Low
confidence or Latin output is retained as evidence, not silently translated.

Receipts retain provider/request/model identity and unknown dollar cost. Duration
and word confidence are not fabricated billing evidence. Malformed/partial success
responses retain a possible-charge outcome; cancellation propagates to the owner.
These are tested adapter behaviors, not guarantees about linguistic accuracy.
[@elevenlabs_stt_20260917] [@elevenlabs_tts_20260917]

**Not yet activated:** the app and hosted endpoints still use existing providers.
There is no new environment loader, direct key field or provider switch in this
checkpoint. Public wire contracts, captured provider/voice settings, routing,
credential checks and allowance accounting must be integrated next. In particular,
the hosted layer must distinguish its estimated service allowance from an actual
provider invoice instead of treating missing cost as zero or a failed synthesis.

[Credential preparation and rollout instructions](audio-provider-setup.md) explain
which steps can be done now and which require that integration. Local/server secret
owners remain separate from the app's bearer session token. GCP configuration was
read from deployment source; no live project state or keys were accessed.

## Next checkpoints

1. Wire the ElevenLabs adapters: captured provider/protocol identity, local server
   configuration and provider credential controls. Update hosted contracts, checks and accounting
   together; remove OpenAI voice and two-letter language assumptions at the adapter
   boundary. Normalize audio, timings, usage and errors. Preserve verbatim speech.
2. Azure adapters and endpoint/region configuration, with explicit provider choice
   rather than automatic retry/fallback after a charged request.
3. Model/language/voice capability catalog and UI. Keep documented support, observed
   quality and connection availability distinct; allow experimental recording.

## Checkpoint 1 verification

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

## Checkpoint 2 verification

Passed: all 735 UI tests, 376 native tests, TypeScript, style checks, strict library
Clippy and the regenerated-contract check. Native results include 16 ignored tests
and the two explicitly excluded checkpoint-1 failures described above. Coverage
includes all 27 combinations of chat/STT/TTS access modes, credential isolation,
missing-key errors, persistence across reopen, rejected/stale settings writes,
late speech rejection with usage retention, and independent UI route changes.
The transaction fixture now selects its TTS route explicitly instead of relying
on the old global chat switch. The two checkpoint-1 native exclusions remain.

No paid provider requests, credential changes, application data reset, restart or
deployment were performed.

## Checkpoint 3 verification

Passed: 346 server tests, including 33 new adapter tests; seven Firestore emulator
tests skipped because the emulator was not enabled. Whitespace checks passed.
Controlled adapter HTTP tests cover Unicode source and
results, language hints including Irish and Gaelic, normalized audio/timing,
credential isolation, redirects/refusals, interrupted and oversized output,
malformed timestamps, silence, unknown costs and cancellation. These are not live
provider or language-quality evaluations. Existing packaging checks cover the
new runtime modules; no new dependencies or database schema were introduced.
No live provider request, key change, cloud operation, app restart, push or
deployment was performed. Native/UI behavior is unchanged in this checkpoint.
