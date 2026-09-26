# Provider-independent transcription — September 21, 2026

Status: implemented in source, uncommitted and undeployed. No live-provider calls,
application restart, workspace reset or recording deletion was performed.

> Update: the server capability-selection policy is superseded by
> [language routing](transcription-language-routing-2026-09-23.md); the historical
> verification results below describe the September 21 implementation.

## Agreed boundary and implementation

Transcription model and AI access route are independent settings. Recording captures
an internal request with WAV audio, language/variety identity, canonical language tag
and optional preceding-message context. Model, route, credential and configuration
revision remain captured execution configuration. Provider JSON does not enter
recording, conversation or fluency analysis.

Native `ai/audio.rs` defines `TranscriptionRequest`, `TranscriptionLanguage`,
`TranscriptionResult` and `TranscriptionOutcome`. The outcome separates transcript
and optional timing from bounded diagnostic metadata. Existing failure receipts
retain metadata on refusal and invalid responses as well as success.

The transport boundary converts requests and responses for the SkellySpeak service,
Groq Whisper and ElevenLabs Scribe. Whisper JSON decoding and its context budget
moved from speech analysis/recording into transport. The inspector renders neutral
word timings and expandable redacted metadata, without a Whisper segment type.
Provider-specific token IDs and segment text are content and are not diagnostics.

Hosted/custom requests forward the chosen model and canonical language tag. Server
composition binds the requested model to a concrete provider adapter before the
common admission executor invokes it. Internal Python requests contain audio,
language and context, not a provider model ID. The service returns the same
`{version, text, timing, usage}` shape for both providers. Missing timing is null.
Language recognition metadata stays diagnostic because the providers report different
representations; it is not exposed as a misleading shared language field.

Direct access uses Groq for Whisper and ElevenLabs for Scribe. Credential storage,
masked previews, replacement, removal, revision checks and cleanup use the existing
access machinery. The transcription model picker never changes or disables an
access route. Missing keys produce an error; there is no provider/model fallback.
The existing custom-model entry/forwarding behavior remains available: unrecognized
model IDs use the existing Groq-compatible adapter and are validated by that provider.

Every request requires explicit language. Adapters convert regional/script tags to
provider language codes; Scribe also accepts three-letter language codes. Missing or
malformed codes fail before network submission. Unsupported provider languages are
errors rather than permission to detect a different language automatically.
Scribe now requests verbatim recognition (`no_verbatim=false`). Groq owns its
preceding-context prompt; Scribe does not receive that prompt. [@groq_transcription_api]
[@groq_transcription_context] [@elevenlabs_non_verbatim]

Whisper Large v3 is the new-workspace default and service recommendation. Existing
saved selections are not rewritten by model/access settings operations. The old
`STT_PROVIDER`, `STT_MODEL` and transcription-rate override no longer control model
selection. Private environment files were not read or rewritten for this change.
Read-aloud request behavior is unchanged.

Admission remains before server audio decoding; unknown submissions retain their
reservation. Cancellation cleanup and native-owned rate-limit retries are covered
by regression tests. Per-model allowance estimates remain explicitly estimates,
not provider invoices. No server retry loop or fallback was added.

## Compatibility and verification

The ElevenLabs credential column requires development schema 28. Per repository
policy, older workspaces are refused without modification and require an explicit
reset; no migration or automatic reset is included. The workbench recording corpus
is separate and untouched. Native and server must be rebuilt/restarted to use the
new source; no deployment was performed.

Automated verification:

- Native library suite: 524 passed, 6 ignored.
- Server suite, including packaging allowlists: 511 passed, 7 emulator tests skipped.
- Settings, recording/inspection and IPC UI suites: 87 passed.
- IPC registration, dependency boundaries and language architecture checks: 13 passed.
- UI production build and localization checks passed; Vite retains its bundle-size warning.
- Generated contracts, Rust formatting, Clippy with warnings denied and Git whitespace checks passed.

Fixtures verify English, Spanish, Arabic and Chinese conversion, correct bearer vs
ElevenLabs authentication, independent route/model selection, missing language/key,
missing or malformed timing, redaction with retained request IDs, refusals and
cancellation accounting. These verify integration contracts, not comparative speech
recognition accuracy. No new live-model accuracy result is claimed.

Two pre-existing verification blockers were repaired narrowly: workbench bibliography
review values now use the allowed enum with their original notes preserved separately;
a macOS diagnostics test canonicalizes its second temporary path consistently with
its first. Neither change changes production diagnostics behavior.

The existing large access coordinator remains with its owner; this change extends
its established credential handling rather than undertaking an unrelated split.
