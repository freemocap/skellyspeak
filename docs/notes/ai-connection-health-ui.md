# AI connection status UI

Implemented September 16, 2026.

The shell now shows a keyboard-accessible AI Connected / AI Not Connected button
on desktop and mobile. Clicking it opens Settings, whose initial section is AI
Access. A saved key alone never establishes a connected state.

Shared, revision-scoped check results drive the shell and Custom URL tab. Custom
URL shows unchecked/checking/connected/disconnected state, last check time,
session-token acceptance (or authentication disabled), and failures. Checks verify
the authenticated SkellySpeak protocol endpoint. They do not prove downstream
provider credentials or model access; the settings UI states this distinction.
Direct OpenRouter uses key verification; hosted access uses the account endpoint.
Checks make no inference requests and do not automatically retry failed work.

The shell checks on initial configuration, revision changes, online events and
return to the visible app. Same-revision focus checks reuse results for one minute;
there is no continuous polling or idle heartbeat. The settings check button can
refresh the result manually. Offline events invalidate results. In-flight checks
cannot overwrite results for a newer revision or an offline event. Results are
last-checked observations, not continuous monitoring of server uptime.

Verification: 73 focused UI/store/localization/architecture tests passed, styles
passed, and TypeScript/production UI build passed. Nine app navigation/session tests
also passed. Live native/provider connectivity and visual inspection in the
running app remain separate from these automated checks. Existing unrelated
working-tree changes were preserved.

## Superseding follow-up: internal provider credentials and visual controls

Custom URL checks now request `/v1/protocol?verify_providers=true`. After the
normal session authentication and diagnostic admission, the server independently
probes OpenRouter `/key` and Groq `/models` with its own saved credentials. The
server performs the probes concurrently with ten-second deadlines, bounded bodies
and redirects disabled. It returns only provider name, fixed result category,
HTTP status and duration. Raw errors follow the redacted provider-error log path;
keys and provider account details never reach the app.

These are credential checks, not inference/model/billing smoke tests. Sources:
[OpenRouter current-key endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key)
and [Groq API reference](https://console.groq.com/docs/api-reference).

A Rust-generated AccessCheck contract carries the individual results to shared UI
state. Older servers lacking results fail explicitly with an upgrade instruction.
Any failed provider prevents aggregate AI Connected. The previous paragraph saying
that checks cannot establish provider credential acceptance is superseded.

The settings control now has four compact rows: server, session token, OpenRouter
and Groq. Rows use check/cross icons, colored borders and result badges; HTTP
failures retain their code. A visible Check connection button rechecks the set.
The Custom URL tab and shell status are pill controls. Edited settings invalidate
previous results, and loss of connectivity hides prior green check results.

Verification for this follow-up:
- Server: 306 passed, seven Firestore-emulator tests skipped.
- UI/store/localization/architecture: 61 passed.
- Native connection tests: 11 passed, socket-based tests excluded.
- Production UI build and style checks passed.
- Isolated component renders inspected at 820px and 390px; no horizontal overflow.
- Live, read-only checks with the server's configured keys: OpenRouter accepted
  (200), Groq rejected (403). No inference request or user content was sent.

The running server and native app were not restarted. Restart the server and
rebuild/relaunch the app to load the endpoint and updated IPC response contract.
