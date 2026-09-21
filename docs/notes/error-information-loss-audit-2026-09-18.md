# Error and response information loss audit — September 18, 2026

Superseded for current logging status by the [centralized diagnostics audit](centralized-diagnostics-audit-2026-09-21.md). Historical findings below are retained as incident evidence.

Follow-up: the [September 21 Linux incident and expanded audit](linux-appimage-audio-and-error-retention-2026-09-21.md)
records additional confirmed losses, repairs and remaining findings. The prior
repair did not eliminate every category-only error path.

Status: the findings below record the original audit. The repair described in
[response observability implementation](response-observability-implementation.md)
is now implemented in source and locally verified. No live provider requests,
runtime restarts, data reset or deployment were performed.

## Scope and result

Inspected active server provider JSON/streaming/grouped/audio paths, native HTTP
adapters and response decoders, native publication/receipt models, frontend IPC,
fault logging, speech playback and microphone error handling. This is a focused
cross-layer audit, not an exhaustive audit of every settings, storage or platform
error. Archived code was excluded.

The recurring issue is that redacting private values is implemented as replacing
an entire error with a category. Some paths retain richer information only in
server logs; others destroy it before any durable record. Tests frequently verify
that secrets are absent without also requiring useful diagnostic fields to survive.

## Confirmed findings

### 1. Hosted/custom chat and Groq discard provider reasons before delivery — high

- `server/app/main.py:137` defines `UpstreamHTTPError` with only upstream HTTP
  status/provider. `provider_json` logs a sanitized response at line 150, then
  throws away its structured reason. HTTP-200 responses containing `error` lose
  their details in the same way.
- `server/app/inference/grouped.py:114` narrows HTTP errors again to code, status
  and optional retry delay. Neither sanitized reason nor service request ID is
  part of an item error.
- `native/src/ai/transport/grouped.rs` accepts that narrow event and maps provider
  HTTP codes to generic authored prose. Its event uses `deny_unknown_fields`,
  so a server-only addition would break the current decoder rather than help it.
- `server/app/main.py:633` logs streaming refusals, but the emitted error at line
  659 retains only generic prose and optionally the HTTP status.

Impact: missing permission, unavailable endpoint, account limitation and invalid
parameter explanations disappear from the app. Sanitized provider bodies may be
recoverable in server logs, but are not available in the operation's error.

### 2. Direct API-key failures discard bodies entirely — high

- `native/src/ai/transport/provider/request.rs:111`: direct chat returns before
  reading the provider error body; the message contains HTTP status and general
  advice. Authentication errors take an even earlier canned-message branch.
- `native/src/ai/transport/speech_provider.rs:405`: direct TTS follows the same
  pattern. At line 222, an in-stream error becomes only “Provider reported a
  speech generation error,” discarding its code and reason.
- `native/src/ai/connections/access.rs:311`: the shared byte reader used by direct
  transcription and checks similarly discards error bodies.
- `native/src/ai/transport/provider/keys.rs:29`: key verification discards the
  provider response and substitutes status-based prose.

Impact: these direct failures cannot be explained later from server logs because
there was no server request. Provider request IDs are also not retained here.

### 3. Decoders erase failure location and sometimes partial receipts — high

- `native/src/ai/transport/provider/response.rs:45`: JSON shape errors, absent
  content, bad choice count, missing IDs and invalid usage all become one
  “incomplete or malformed completion” error. Valid request ID, model, finish
  reason and usage cannot survive a failed `Result<Completion>` decode.
- `native/src/ai/transport/grouped.rs:112`: wraps even the decoder's existing
  error in a second generic “invalid AI completion” message.
- `native/src/ai/transport/service_audio.rs:35`: invalid JSON, version/model/format
  mismatch, base64 errors, WAV format mismatch and sample-read failure all become
  “Invalid or interrupted audio response.” Receipt fields survive some later WAV
  failures, but not early envelope failures.
- `native/src/ai/transport/transcription_provider.rs:41`: UTF-8/JSON errors, timing
  mismatches, invalid durations and invalid word intervals become one unknown
  transcription response error. `server/app/inference/elevenlabs.py:_transcript`
  similarly replaces several distinct validation failures with one code.

Impact: users and diagnostics cannot distinguish provider refusal, malformed
output, an unsupported response format or a client contract mismatch. Preserve a
safe stage/path/expected-type reason and validated receipt independently of result
acceptance; never accept invalid output merely to retain its receipt.

### 4. Successful transcription loses returned metadata — medium

`server/app/inference/audio_service.py:131` returns detected language, language
probability and usage (provider/request/model/cost/allowance metadata). The native
`Transcript` at `transcription_provider.rs:55` reads only text and timing.
`native/src/ai/audio.rs:32` has no receipt/language-confidence fields, and
`native/src/speech/recording/transcription.rs` stores no provider request ID.

Impact: successful STT cannot be correlated to the upstream request from the
workspace, and returned language-confidence evidence disappears. Keep estimated
allowance distinct from actual cost; preserving fields must not fabricate billing
or learning evidence.

### 5. Structured errors become strings at persistence/display boundaries — medium

`native/src/model.rs:413` has `code`, `message` and a special-case `refusal`, but no
general stage, provider code/status, provider request ID or validation location.
`native/src/conversations/execution/publication.rs:204` and transcription/speech
publication save the message string; most structured error identity is lost.
Frontend `faults.ts:40` also reduces errors to a message for display.

Impact: a useful sentence can survive, but consistent filtering, correlation and
cause-specific recovery cannot. The current ElevenLabs fix improves that sentence;
it does not resolve the underlying general error-model gap.

### 6. Redaction itself deletes actionable identifiers — medium

`server/app/diagnostics/provider_errors.py:39` removes all quoted values.
A local call to `scrub` reproduced:

- `Missing permission "text_to_speech".` → `Missing permission [redacted].`
- `Model "eleven_v3" is unavailable for this account.` → `Model [redacted] is unavailable for this account.`

The sanitizer correctly removes supplied request text and the actual key in the
same reproduction. Do not disable that protection. Preserve validated public
identifiers in typed diagnostic fields rather than treating every quoted value
as private or allowing arbitrary provider bodies. This also limits how specific
the new ElevenLabs message can be when its provider uses quoted identifiers.

### 7. Browser media errors are replaced or reduced to booleans — medium

- `ui/src/features/conversation/speech/speech-player.ts:52` calls a parameterless
  callback and discards `audio.error` before cleanup; its caller can only report
  a generic playback failure.
- `ui/src/platform/audio/browser-recording.ts:49` and `:61` discard recorder error
  details and report generic capture failure.
- `ui/src/features/conversation/speech/TranscriptionInspector.tsx:103` catches
  playback rejection without retaining the error and sets a boolean.

Impact: autoplay denial, decode failure, unsupported media and capture faults
can become indistinguishable. Preserve safe browser error name/code and report it
through the existing fault mechanism.

### 8. Diagnostics cannot reconstruct many failures after dismissal — medium

`ui/src/platform/diagnostics/log.ts:61` persists a small enum/cause/command set,
not structured provider or validation fields. Unknown errors become `unknown`.
`native/src/diagnostics/mod.rs:350` and `:402` retain line/count metadata but strip
ordinary native log/panic content. These are explicit privacy policies, but leave
no replacement diagnostic reason for numerous paths. Server internal exception
handlers similarly retain class/category without a safe cause/location chain.

Impact: a transient UI error may be richer than the retained log; after dismissal
or restart its reason can be unrecoverable. Add reviewed reason/stage/location
fields instead of turning raw stack/argument/body logging back on.

### 9. Connection checks and validation handlers lose specific reasons — medium

`server/app/diagnostics/provider_health.py:38` returns only provider/state/status/
duration, although a sanitized error is logged. The user cannot distinguish a
restricted probe permission from a bad credential. `server/app/main.py:132`
replaces framework validation errors with “Missing or invalid request parameters,”
dropping even safe field locations/types. Native hosted refusal handling discards
general server `detail`, including locally authored validation explanations.

Impact: settings and protocol failures offer generic guidance despite known,
actionable causes. Safe field paths/reason codes should survive; submitted values
and arbitrary body text should not.

## Paths that already preserve useful evidence

- Frontend IPC `ui/src/platform/ipc/native.ts` logs and rethrows the original
  rejection; it is not the source of the current TTS message loss.
- The fault surface preserves an incoming message, and speech displays the saved
  operation error. It cannot restore details discarded upstream.
- Native speech streaming retains usage before checking content and continues
  collecting later metering. Speech publication retains its usage on failure.
- Native completion publication stores model/request/token metadata when decoding
  succeeded, even if domain validation later fails. Inference diagnostics retain
  selected finish reasons and structured-output inspection paths.
- Hosted allowance refusal handling already models reason, retry timing, scope
  and request correlation. It demonstrates that privacy does not require dropping
  the entire error model.

## Agreed information-retention rule

The user clarified the policy after this audit: retain all response information
that can be retained without credentials or content. This applies to successes,
failures and partial results. Observability and transparency are product
requirements, not optional debug output.

A small fixed envelope is useful for common fields but is not the retention
boundary. Keep additional non-sensitive provider metadata in a bounded structured
representation, even when the current UI has no dedicated field for it. Explicitly
record redaction, truncation, unreadability and field omission. Unknown fields
require sensitivity handling, not automatic raw retention or silent deletion.
Brief user-facing messages may summarize the evidence; expandable details and
retained records must preserve it. This rule is now recorded in root AGENTS.md.

## Original proposed repair order (implemented in the follow-up)

1. Define a shared diagnostic representation with common searchable fields plus
   retained non-sensitive provider metadata and explicit redaction/truncation
   records. Common fields include stage, provider, HTTP status, reason/code,
   redacted message, service/provider request IDs, model/finish metadata,
   validation details and retry/rate-limit metadata. Preserve both successful and
   failed responses; keep execution outcome and billing uncertainty separate.
2. Carry it through adapters, HTTP/grouped/streaming responses, native models,
   persistence and diagnostic views. Update both ends of strict grouped decoding
   together. Preserve extra safe fields instead of narrowing every hop again.
3. Retain validated partial metadata independently of content validation, including
   transcription receipts and language metadata. Keep estimate/actual provenance.
4. Forward browser media errors and persist their non-content diagnostic fields.
5. Test information fidelity end to end alongside redaction: useful reason codes,
   permission/model identifiers, validation locations, request IDs, usage, timing
   and extra safe metadata must survive. Credentials, content and echoed values
   must be removed, with explicit markers explaining any losses.

The original ElevenLabs-only patch has been superseded by the cross-layer
implementation linked above. The numbered findings retain their original source
references as historical audit evidence; line numbers have changed.
