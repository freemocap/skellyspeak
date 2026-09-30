# Bounded audit of server and client inference ownership

Status: the follow-up ownership changes below are implemented in source under the
user's explicit authorization. The user already released the separate timing fix.
This architecture change is uncommitted and undeployed and requires matching app
and server builds. It is not a production security certification.

## Implemented ownership changes

| Responsibility | Owner after this change |
| --- | --- |
| Accent instructions and transcription context/options/language mapping | Shared native transport/configuration |
| PCM decoding, WAV assembly, recording-clock character alignment, source/word projection | Shared native speech transport/analysis |
| Transcript word projection and recognition confidence | Shared native transport, before diagnostic list truncation |
| Prose assembly from provider frames and decision-answer projection | Shared native provider transport |
| Learner state, rating categories, modality and assessment publication validation | Existing native feature/domain owners; removed server duplicates |
| Credentials, fixed destinations, auth, admission, quotas, rate estimates, usage settlement, durable work ownership | Server |
| Bounded JSON/SSE framing, credential removal, content-free errors/logging | Server |

The server returns original bounded provider objects in audio version 3 envelopes.
Speech streams carry original JSON frames; complete-response synthesis carries the
same raw object. Native retains the original displayed source independently from
prepared provider text. Invalid optional timing yields local diagnostics and never
rewrites transcript text. Null timing tails no longer erase accumulated alignment.
Full-response synthesis uses the same native interpretation as streaming without
applying the stream-line size limit to an entire recording.

Grouped version 3 forwards original provider frames (including roles, unknown
choice fields, empty metadata frames and usage) with contiguous frame offsets.
Native assembles provisional text and completion; the terminal confirms completion
and carries observed usage. Structured provider responses, including decision
answers, remain original JSON. App/server compatibility checks reject old protocols
before normal generation. The outer discovery protocol and inventory format remain
version 1; their advertised inference/audio versions are 3.

The server accepts bounded mono 16-bit PCM WAV, validates actual sample bytes and
duration for admission, and forwards those bytes unchanged. Native recording
already produces this format. The media-decoding subprocess, decoder readiness
gate, image dependency and CI installation were removed. The generated service
catalog now contains only provider/task availability; language support stays native.
Removed inactive server synthesis-alignment, transcript-timing and confidence code.

Successful response content and diagnostics have separate boundaries. Unknown
response JSON survives within explicit limits; credentials are removed on the
server. Logs/errors redact content, including generated text echoed in error
messages, while retaining identifiers, costs, timing, codes and validation stages.
Streamed text is held transiently only as needed to scrub such echoes, never stored
or used to reconstruct the client response. Oversize/deep/nonfinite JSON fails
explicitly; sanitized key collisions are also explicit failures.

## Deliberately retained server work

Security and accounting must remain authoritative. WAV/header validation is an
abuse/billing check, not audio analysis. Minimal adapters still translate transport
field names, bind configured destinations/voice/credentials, and enforce the wire
audio format. Generic provider schema and token/context bounds prevent malformed or
unbounded spending. Retry coordination for grouped work remains with its durable
server claim; audio retry policy stays in its existing native owner.

No UI playback algorithm, buffering heuristic, hydration/concurrency ownership,
conversation history construction, local cache/storage contract or database schema
was changed. Existing large grouped/main files were retained to preserve their
transaction/cancellation boundaries; splitting them is a separate responsibility
review rather than a prerequisite for this behavior change.

## Verification and local readiness

- Native library: 763 passed, 5 explicitly ignored.
- Server suite: 567 passed, 7 environment-dependent skips; one dependency deprecation warning.
- Playback/alignment/practice UI: 257 passed across 37 files. The test environment
  reports its existing unimplemented canvas context; these are not visual/device checks.
- Strict native linting, generated contract checks and repository fast validation passed.
- Cloud upload manifest verification passed, including private-file exclusion.
- Local launcher configuration passed without provider credential verification.

Tests use synthetic responses and local HTTP fixtures; they do not establish live provider conformance
or current phone playback. No paid inference, deployment, version bump, tag or commit
has been performed in this pass.

The current local launcher configuration check passes; credentials have not been
verified. Restart `npm run server:local` and run a rebuilt native app against its
Custom URL connection. Restarting only the server is insufficient for this change.
Generate a fresh practice reference and verify words/Align to words, then compare
new streamed playback with cached replay. Existing cache records are left intact.

## Initial inspection (historical baseline)

The remaining findings describe the pre-change baseline. Their ownership proposals
are superseded by the implemented decisions above.

### Initial scope and conclusion

Reviewed active text, grouped operations, synthesis, transcription, request
validation, retry and diagnostic paths. This is not a complete security audit,
production configuration review or live provider conformance test.

The requested target is a thin credential-bearing relay, with app behavior and
response interpretation on clients. The current server is a provider adapter and
execution coordinator, not an information-preserving pass-through. In particular,
audio responses are rebuilt into a reduced application-specific contract. This
is a meaningful mismatch with that target. Existing code comments and the server
README describe normalization; they do not establish that its ownership matches
the user's desired architecture.

### Initial findings

| Path | Current behavior | Ownership recommendation |
| --- | --- | --- |
| Identity, admission, accounting, work claims | Holds secrets; authenticates; enforces resource/spend bounds; prevents duplicate submissions; settles usage and handles disconnects | Keep server-side. A thin relay still needs these responsibilities. |
| `main.py` ordinary text endpoint and `inference/contracts.py` | Preserves non-streaming response body, validates request shape and sets token/provider controls. Streaming parses and reserializes events; terminal/error policy can reject frames before forwarding. | Preserve bounded response information; distinguish hosting limits from interpretation of completion usefulness. |
| `inference/grouped.py`, `streaming.py`, `retry.py` | Multiplexes bounded concurrent work, converts prose deltas into a completion, keeps first-choice text and selected finish fields, performs bounded rate-limit retries under durable work ownership | Retain transport/accounting coordination. Review information loss from reconstructed choices: unknown choice fields and non-text deltas are not fully preserved. Do not move retries without redesigning durable attempt ownership. |
| `inference/synthesis_stream.py`, `synthesis_alignment.py` | Decodes PCM, retains full audio, merges/validates timestamps, creates a reduced alignment result; missing/invalid timing becomes null | Highest-priority boundary correction: forward bounded timing information and its clock semantics, and let shared native code interpret/validate it for use. Invalid interpretation must not destroy source evidence. |
| Synthesis adapter and `audio_service.py` | Adds accent instructions, chooses configured voice, requests audio format, creates WAV and computes estimated allowance | Secret routing/accounting remain hosted. Accent prompt construction and reusable audio assembly are candidates for shared native ownership. Provider parameters still need server limits. |
| `audio_input.py` | Decodes/resamples uploads with a bounded media subprocess; computes duration for limits/accounting | Transport compatibility, but materially heavier than pass-through. Moving normalization to native is a separate bounded change; hosted size/duration validation remains necessary. |
| Transcription adapters, `transcription_timing.py`, `transcription_confidence.py` | Translates word schemas, omits non-word events, rejects a whole timing projection on invalid entries, calculates confidence summaries, truncates recognizer context | Confidence, context composition and timing interpretation should move to shared native owners. Preserve bounded original response data separately from derived views. |
| `inference/decisions.py` | Knows learner-message fields, grammar/conversation rating categories, input modality/scaffold flags, and exact assessment criteria | Clear product coupling. Keep generic provider schema/resource validation server-side; move app-specific assessment contracts to native. |
| Diagnostics sanitization | Removes secrets/content, bounds metadata, marks redaction/truncation | Keep. Diagnostic logs are intentionally content-free; they are not a substitute for an intact response delivered to its requesting client. |

No conversation-history construction, practice spectrogram layout, reward award,
or local conversation/cache ownership was found in the reviewed server paths.
The problems are concentrated in adaptation and interpretation boundaries, not a
wholesale transfer of the application to the server.

### Original bounded follow-up recommendation

The fix in [the reference-timing investigation](practice-reference-timing-2026-09-30.md)
corrects the existing synthesis adapter without requiring a protocol or app
release. It does not make the server a relay, and should not be presented as the
architectural cleanup.

Recommended first follow-up is finite: move synthesis timestamp accumulation and
projection to the shared native speech owner. Define an explicit bounded response
envelope preserving original timing, source identity and clock basis, plus safe
provider metadata. Forward data for the requesting client; never relay credentials,
arbitrary headers or diagnostic content into logs. Keep HTTP routing, admission,
limits, usage and cancellation on the server. Add cross-boundary tests that prove
valid source information survives, malformed information remains inspectable, and
secrets remain removed. Complete this slice before taking on transcription or
assessment contracts. Do not add a generalized provider framework or move every
server module in this bug fix.
