# Fluency alignment disabled — 2026-09-20

## Observed and diagnosed

The user reported `Fluency timing: invalid timestamp interval.` during recording.
Read all JSONL streams in the 12 most recently modified local native/server run
folders at investigation time, spanning server starts from 16:32 UTC through the
16:48 UTC server run and native startup at approximately 16:51 UTC. This included
successful events, launcher/stdout/stderr streams and native diagnostics. The
literal error was not present in the local log files searched; device-side error
records and the actual provider word intervals were not captured here.

The 16:48 server run recorded a successful ElevenLabs transcription at
16:49:30 UTC: `/v1/audio/transcriptions` returned HTTP 200 in 624 ms, request ID
`397f7e47819748e285d15447a8d989a1`. Server success is not native publication success.
Several separate attempted server starts logged address-in-use failures; these
are unrelated to the native timing validation error.

Source tracing identifies the failing path: `mic_transcribe` passed a successful
provider response through `audio_inspection::attach_words`, which called
`fluency::align_timing`. Alignment errors replaced the successful transcript with
an error before the transcription receipt was completed. Both the ElevenLabs
server adapter and native service adapter accept `start == end`; alignment rejects
it. Given those upstream validations, a zero-duration provider word is the likely
trigger, but the original intervals are unavailable to confirm the exact word.

Learning, reward and statistics code do not consume this fluency alignment.
Coaching explicitly excludes acoustic fluency judgments from transcript evidence.

## Implemented

Removed fluency alignment from the recording inspection path. Provider timestamps
remain visible unchanged, including zero-duration words. No words are clipped or
classified as unsupported using the local energy heuristic. Attaching these
already validated timestamps is now infallible and cannot fail transcription.
Provider diagnostics and segment metadata remain intact.

Local waveform, spectrogram and energy activity inspection remain. The standalone
fluency analysis implementation and its tests remain in source, but no application
call site invokes its alignment. Provider schema/timestamp validation remains at
the transport boundary; this change does not accept malformed responses.

## Verification

All four audio inspection tests passed, including a regression for a zero-duration
word outside local energy activity and preservation of text/provider endpoints.
Changed Rust files pass rustfmt; `git diff --check` passes. Repository-wide rustfmt
reports pre-existing differences in unrelated files, which were left untouched.
Full native library suite: **443 passed, 0 failed, 2 ignored**. The first
sandboxed run could not bind loopback ports (22 fixture failures); rerunning
with loopback access passed.

No runtime rebuild/install or live microphone verification is implied. The native
app must be rebuilt/restarted to use this fix; restarting only the server cannot
change native post-processing. No commit or deployment was performed.
