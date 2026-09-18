# TTS authorization failure — September 18, 2026

Observed, read-only diagnosis. No settings, credentials, runtime processes or
provider calls changed.

The current schema-v20 workspace selects Custom URL at localhost:8765/v1, with
scribe_v2 transcription and eleven_v3 speech. All three retained persona_speech
attempts at 13:45:03, 13:45:31 and 13:45:47 UTC failed with ElevenLabs HTTP 401.
The latest service request ID is 2c433eb4d9404f7ab4116941fa6d26e5. The server's
upstream rejection was delivered through the native client; this establishes
that the shared Custom URL route reached the server and the failure occurred
at ElevenLabs authorization, before audio playback.

The retained transcription at 13:45:44–45 UTC succeeded. All retained chat and
assistance attempts succeeded. Both audio paths use the same configured server
ElevenLabs key in current source. TTS additionally selects a voice and model.
The captured generic HTTP 401 does not establish whether the refusal concerns
TTS key permissions, voice access or model/account access. No raw provider body
is retained by this adapter, so a more specific cause cannot be recovered from
these records.

Coverage: parsed every record in both available native streams (134 native and
150 frontend records) and the run manifest for native-1789738976221-16737; read
all retained operation attempt outcomes and transcription receipts, plus selected
nonsecret AI configuration, from the live workspace using SQLite read-only mode.
Only this native run remains under .local/logs. No server/launcher stdout or
stderr streams are available there, so server-side diagnostic coverage is missing.

## Implemented error-detail follow-up

The ElevenLabs adapter now reads a bounded refusal body before closing it, records
the sanitized diagnostic, and carries the provider's structured status and message
through the service error response. Known request strings, the actual API key and
other credential patterns are redacted before persistence or display. The native
client shows this separate bounded provider reason instead of replacing it with
a guess based only on HTTP status. Raw bodies and generic service detail fields
remain excluded. Request correlation and no-automatic-retry behavior remain.

For example, a provider response with `missing_permissions` and a message naming
`text_to_speech` now displays that code and explanation alongside ElevenLabs HTTP
401. This is a regression fixture, not a recovered reason for the earlier failures.
Those discarded bodies cannot be reconstructed. Malformed, oversized or unreadable
bodies retain the original HTTP refusal without invented detail.

Verification: 77 server audio/diagnostic tests passed, including an authenticated
TTS route test confirming the specific reason reaches the client while the actual
API key and source sentence do not. All 12 native hosted/error tests and Clippy passed. The full server suite
passed with 373 tests and 7 skipped integration tests.

Both the local server and native app need restart/rebuild for this source change.
No running processes were restarted, no new synthesis was requested, and no
deployment was performed.
