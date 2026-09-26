# Speech configuration and routing — 2026-09-23

Status: implemented in source, uncommitted and undeployed. Verification is recorded
below. No live inference calls, application restart, reset or phone installation.

## Investigation and superseded approach

The connected Pixel is reachable through ADB but its release package refuses
`run-as` access to private diagnostic files. Available app-process logcat showed
audio-buffer warnings, not the reported provider receipt. The exact original error
is still unconfirmed. The source did accept any two-letter code for Whisper,
including Irish, without checking model support.

The initial automatic server-side Whisper-to-Scribe substitution was rejected in
design discussion and has been removed. The accepted design is shared capabilities
and ordered defaults, with optional language/variety preferences. It supersedes the
no-capability-selection policy in the September 21 transcription note.

## Implemented ownership

- `content/shared/speech-routing.yaml`: authored task-specific model/provider
  capabilities, provider code maps and ordered alternatives. It cites reviewed
  sources. Recognition and synthesis support are distinct.
- Language `defaults.speech_routes` and variety `overrides.speech_routes`: optional
  ordered preferences. Each task inherits independently. No language requires an
  override; Irish resolves through shared capabilities. No new language overrides
  were added.
- `configuration/speech.rs`: one resolver, ordered effective language preferences,
  learner's global default, then shared alternatives; select the first compatible
  available model. Missing support/configuration is explicit. Unknown user-entered
  custom models retain forwarding with unverified capability status.
- `ai/connections/speech_routing.rs`: combines model choice with the existing service
  route. It cannot switch endpoints or credential identities. The selected model,
  provider, language code, global default and decision reason are captured.
- Recording and all read-aloud owners consume this resolution before admission.
  Chat/Drill share the recording owner boundary. Persona speech, explicit message
  playback and reading/reference speech share the speech policy.
- Provider adapters validate and convert captured requests. The server capability
  module is generated from the authored catalog by the Rust contract exporter;
  there is no second hand-maintained language table and no server model substitution.

## Runtime behavior and limits

Single and continuous recording obtain the selected service's configured model
inventory through authenticated `/v1/protocol`, before opening native or browser
capture. This sends no learner content, invokes no inference and reserves no quota.
No workspace lock is held during credential/network work. Capture rechecks access
revision and the owner's language-context hash before using the prepared target.
Inventory describes configuration, not provider health; revoked/invalid provider
keys and remote outages still produce explicit provider errors, with no rerouting.

Read-aloud independently validates canonical language support before it is queued;
its wire request now includes `language_tag` separately from the language/variety
label. The service validates credentials and its voice profile before inference.
Its existing variety accent cue is preserved; capability checking does not prove
pronunciation quality. Only Eleven v3 synthesis is currently implemented, so there
is no alternate synthesis provider to select when it is unavailable.

Model settings remain global defaults, explained in the localized settings UI.
Optional configured language preferences precede them. This pass does not introduce
an explicit hard-pin mode. Model/route receipts and expandable diagnostics disclose
the selection; no transcript or audio content was added to diagnostic metadata.

The published catalogs list Irish for Scribe and Eleven v3, but not Scottish Gaelic.
Prior mocked Scribe tests incorrectly implied Scottish Gaelic and Cherokee support;
they now test rejection before submission. [@whisper_language_tokens]
[@elevenlabs_scribe_languages_20260923] [@elevenlabs_v3_languages_20260923]

## Delivery

Matching native and server builds are required: microphone preflight requires the
new inventory contract, and read-aloud requires the canonical language tag. Docker
and cloud upload allowlists include the generated catalog. No deployment or commit
has been performed. No data reset is needed for these optional captured fields.

## Verification

Automated checks use mocked providers and disposable workspaces. They cover
capability selection, independent task support, language/variety inheritance,
invalid configuration, missing availability, access/context changes during
preflight, captured Irish Drill model receipts, read-aloud language identity,
metadata preservation and refusal without downstream substitution.

Final verification: native library **587 passed, 6 ignored**; server **566 passed,
7 emulator tests skipped**; focused Models/recording UI **32 passed**; UI architecture
**26 passed**. Clippy with warnings denied, generated contracts, generated schemas,
localization checks, UI production build and Git whitespace checks pass. Existing
Vite bundle-size and Starlette/httpx deprecation warnings remain. The installed app
and live providers were not exercised by these automated checks.
