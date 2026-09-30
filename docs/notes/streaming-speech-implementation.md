# Streaming speech implementation

Status: server, native shared delivery and conversation playback implemented and
locally verified 2026-09-30. Live provider conformance and subjective listening
remain unverified; no deployment or paid request was performed.

## Learner behavior and ownership

Send the complete accepted reply text once. Begin playing validated audio before
the full recording finishes. Do not speak uncommitted text, split the text into
additional paid requests, or change voice, language variety or pronunciation
policy. Stop, navigation, message revision and playback interruption must prevent
late chunks from restarting audio. A partial stream is never a successful cached
recording. Existing completed recordings remain reusable.

## Checkpoints

1. Server: opt-in streaming response on the existing speech route, using the
   timestamp-capable upstream stream. Keep source validation, admission and
   settlement with their existing owners. Bound every frame and the complete
   response; preserve redacted receipts on both success and partial failure.
   Test early delivery with the upstream deliberately held open, cancellation,
   malformed data and spending settlement. Server checkpoint completed before
   the authorized native/UI continuation.
2. Native: request streaming through HTTP content negotiation; parse ordered PCM frames
   with explicit sample offsets, keep the existing completed-result cache and
   publish provisional audio through a bounded mailbox tied to execution and
   consumer identities. Shared generation must not become duplicate requests.
   Cancellation detaches a consumer without cancelling another consumer's audio.
3. UI: consume the mailbox, buffer a small amount of PCM and schedule contiguous
   playback. Distinguish buffering from audible playback. Preserve volume, rate,
   interruption and word-following behavior. Final validated audio supports replay
   and inspection without replaying the already heard prefix.
4. Integration: deterministic delayed-stream tests across server/native/player,
   then an explicitly authorized live voice/model check and listening review.
   Do not deploy or make paid requests as part of offline verification.

## Implemented server wire contract

An explicit streaming Accept header selects newline-delimited JSON. Version 1
whole-result clients retain their current response. Stream records have version,
type and monotonically increasing sequence. Audio records carry base64 PCM,
sample offset and 24 kHz mono signed 16-bit format, with separate original and
normalized character timing. Completion carries total samples, final alignment
and usage; failure carries a fixed code plus redacted detail/diagnostics.
No completion record means incomplete, even if the connection closes cleanly.
Headers alone never establish successful generation or actual cost.

`POST /v1/audio/speech` accepts the existing request body. Set
`Accept: application/x-ndjson` to receive version 2 records; authenticated
`GET /v1/protocol` advertises `audio.speech_stream_versions: [2]`.
Sequences start at zero. `start` declares `pcm_s16le`, 24000 Hz and one channel;
it does not confirm provider admission. `audio` contains `sample_offset`,
`audio_base64`, `alignment` and a redacted `receipt`. Chunk timing is relative to
that chunk; final timing is accumulated against the PCM sample offsets.
`complete` contains `total_samples`, `alignment` and `usage` after settlement.
`error` contains `code`, `status`, a summary, `provider_error`, `diagnostics` and
structured exception information. Exactly one terminal record is expected.

The decoder limits a frame to 512 KiB, a response to 8 MiB, audio to the existing
PCM bound and the stream to 4096 frames. At most two encoded records wait for
the consumer. Original/normalized timing failures stay explicit in the receipt;
the corresponding completed alignment is unavailable instead of silently partial.

## Server verification

343 inference tests passed across the full-suite run and the corrected protocol
discovery assertion rerun. Ten new tests cover early delivery with the upstream
blocked, split UTF-8/JSON, sample offsets, final timing, invalid tails, limits,
missing timing, route accounting, partial failures and disconnect settlement.
Fast repository validation also passed. Tests used synthetic PCM and local mock
transports; no provider request, deployment, server launch or listening test ran.

The public timestamp-stream endpoint documents audio and alignment chunks
[@speech_stream_timestamps]. It does not establish our precise voice/model's
first-audio latency. Chunk timing offsets require live conformance verification
before word-following is considered verified. No model or voice change is part
of this work.

## Required invariants

- First audio is observable while the provider is still producing later audio.
- Byte chunks may split JSON, UTF-8, lines or audio frames; parsing stays bounded.
- Original source and normalized timing remain distinct. Missing/invalid timing
  is disclosed, not invented. Audio and metadata limits fail explicitly.
- Consumer backpressure bounds memory; disconnect releases work and semaphore
  ownership. Potentially submitted work retains uncertain billing on cancellation.
- Midstream errors retain request identity and validated metadata. No automatic
  retry after partial audio, and no successful cache entry for an incomplete result.
- Native/UI completion, identity and cancellation guards are tested before the
  streaming path is enabled in the application.

## Implemented native and playback behavior

Native sends an opt-in streaming Accept header on the same single synthesis
request. The response Content-Type chooses the incremental decoder or the existing
version 1 WAV decoder. This replaces the proposed extra capability probe: content
negotiation avoids another request/response dependency and does not retry synthesis
when a service fails. A service returning whole-result audio remains usable.

The incremental decoder validates sequence, format, offsets, PCM sample boundaries,
limits, final sample count and EOF. Its final cumulative-alignment record has a
4 MiB frame bound; the encoded response has a 16 MiB bound. PCM retains the existing
4 MiB WAV bound. An error, missing terminal or trailing record cannot become a
cached success, and partial streams cannot trigger automatic rate-limit retries.
Validated partial receipts survive authority revocation; private source content
and credentials are redacted before retention.

Provisional delivery is a separate four-entry mailbox, up to 16 MiB of PCM total,
keyed by shared execution. Reads are non-consuming, capped at 24,000 samples and
bound to the current session, operation, source and execution. Entries expire after
three minutes without audio. Evicted streams never restart at sample zero. The
shared producer continues settlement when a consumer stops; cancellation does not
cancel another subscriber or create another synthesis request.

Conversation playback polls pending requests every 100 ms and active streams every
80 ms, starts after a small PCM buffer, and schedules approximately 160 ms ahead
on the audio clock [@speech_buffer_schedule]. An underrun reports preparation and
holds the source clock. Completion validates that the complete WAV matches the
heard prefix, queues only its remaining samples, and retains that exact WAV for
inspection/replay. Navigation, revision, microphone/lifecycle interruption and Stop
invalidate pending reads and release scheduled nodes. Completion does not restart
the recording. Existing retained WAV playback remains on the existing media player.

The streaming player preserves pitch with bounded waveform-similarity overlap/add
for the existing 0.5–1.5 speed range [@speech_time_scale_review]. At speed 1, samples
pass through unchanged. Speed changes affect the next scheduled windows. Volume
remains live. Character timing accumulates relative to sample offsets. During a
partial stream, word following uses only complete, exactly mapped source words;
missing timing does not become an invented full-utterance estimate. Final validated
alignment and inspection behavior remain available.

This implementation enables early playback for conversation reply speech. The
independent reading and Drill callers still await the shared completed result;
their ownership, cache and playback contracts are unchanged.

## Final local verification

- UI: all 1,527 tests in 238 files pass. This includes the new player/tempo tests,
  stream continuation and interruption races, cursor/source guards, buffering,
  completion without duplicate playback and partial word timing. The full run
  exposed a stale coach fixture missing `revisionSuffixCounts`; the fixture now
  supplies the required field. No coach production behavior changed.
- Native: all 709 library tests pass, with four existing ignored tests. Coverage
  includes real delayed HTTP, independent cancellation of shared consumers,
  source-bound provisional delivery, partial receipt retention on access revocation,
  redaction, and refusal to cache incomplete audio.
- Server: all 612 tests pass; seven platform/environment tests skip. The full suite
  caught the new runtime modules missing from explicit container packaging; Docker
  copies and both upload allowlists now include them. Windows' default pytest temp
  directory was inaccessible; the successful run used a fresh workspace-local temp
  directory. Tests do not deploy anything.
- UI production build, generated-contract check, preview TypeScript and fast
  repository checks pass. The build
  retains its existing large-bundle advisory; the test environment reports its
  existing canvas stub notices and a server test-client deprecation warning.
- Browser: `ui/tools/streaming-speech-preview.html` exercised the real browser audio
  engine using a two-second synthetic PCM fixture, muted. At 1x the first playing
  indication arrived at 184 ms and completion at 1,705 ms. At 0.5x the values were
  201/1,701 ms; at 1.5x, 181/1,701 ms. All reached the full source duration without
  error. A stopped run stayed stopped after late chunks. These are fixture timings,
  not provider latency or physical sound measurements.

The temporary preview used port 1421 and was stopped after verification. Port 1420
was not used. The preview is a reusable developer fixture, not a product surface.
No native app launch, real provider voice/model conformance, deployment or subjective
listening claim is made. Provider timing semantics, device-specific audio quality
and actual first-sound latency still need a live listening run.
