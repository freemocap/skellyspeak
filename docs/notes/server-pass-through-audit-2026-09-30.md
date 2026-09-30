# Bounded audit of server and client inference ownership

Status: source inspection complete. Recommendations below are proposals, not an
implemented architecture change. The separate reference-timing fix is implemented
and tested but not deployed. No commit or publication is authorized by this audit.

## Scope and conclusion

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

## Findings

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

## Immediate fix versus follow-up

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

## Local test readiness

Existing timing-fix verification: 27 server timing tests, 64 practice UI tests,
one native completion/cache/reference-inspection regression, and fast repository
validation passed. No further runtime changes were made during this audit.

The local launcher configuration check failed because `server/.env` is absent.
Configure it privately from `server/development/.env.sample`; speech requires the
speech provider key and voice setting as well as the launcher's required keys.
Then start `npm run server:local`, connect the desktop app through Settings → AI
access → Custom URL → Connect to local server, and generate a new practice phrase.
The local service is a separate credential/access scope, so hosted cached audio
should not satisfy its request. Existing missing-timing results in the same local
scope still need targeted refresh. No hosted deployment has been performed.
