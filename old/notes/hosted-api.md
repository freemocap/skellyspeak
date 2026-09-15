# Desktop hosted client contract

The client targets `https://skellyspeak-api-ndkvvlbq4a-uc.a.run.app`.
This document specifies implemented client behavior against the deployed service;
active server implementation and deployment checks are documented in `server/README.md`.

- `GET /auth/start`: Google provider, loopback redirect, S256 PKCE challenge and
  matching application state. The system browser handles account authentication.
- `POST /auth/exchange`: one-time code and verifier; returns a session token.
- `GET /v1/me`: bearer session; returns email, name, daily USD usage/limit/remaining,
  tokens, requests, remaining request/token estimates and midnight UTC reset.
- `POST /v1/chat/completions`: bearer session and approved model
  `google/gemini-2.5-flash`. Messages contain role/content; buffered replies request
  at most 2,048 output tokens and disabled reasoning. The client sends no upstream
  provider override. Fast model assignments are unavailable on this route.

Account and inference requests include installation UUID, OS and application version
headers. Rust owns all requests and credentials. Session tokens are not returned to
the webview. Redirects and automatic retries are disabled. HTTP errors are sanitized;
provider/session response bodies are not echoed into diagnostics.

USD figures are authoritative. The wire field `estimated_turns_remaining` is displayed
as estimated requests, not complete guided conversations. Local profile totals cover
retained records and are independent of hosted daily metering.

There is no client/server idempotency-key contract. An interrupted or cancelled
request may still incur cost. Retry is explicit. Sign-out blocks local publication
and clears the local session; it does not erase service accounting or Google browser
sessions. Desktop uses a bounded loopback callback; mobile deep links are pending.

Verification: service health responded; automated tests cover PKCE/state, response
mapping, model/payload restrictions and local publication revocation. Browser login,
secure session persistence and live inference must be checked in the native app.

Desktop speech input posts multipart WAV to `/v1/audio/transcriptions` with
`model=whisper-large-v3`, `response_format=json` and the two-letter target language.
The service returns `{text}`. Requests use the same hosted session and identity
headers. The client caps capture at 120 seconds and does not retry automatically.
Known hosted quota refusal messages are allowlisted for display; arbitrary response
bodies are never echoed into the UI. Voice metering remains service-owned.

HTTP 429 diagnostics distinguish documented request-rate, daily-request, personal
allowance, shared allowance and spending-pause refusals. Numeric Retry-After seconds
are reported when supplied. Unknown or malformed refusals remain explicitly
unclassified; response content is not exposed. A visible token balance confirms
account lookup, not permission for a new chat request. No retry or quota change is
performed automatically. Loopback adapter tests cover the actual 429 response path.

## Observed service status — 2026-09-09

The public `/health` endpoint returns HTTP 200. Local attempt records show a
successful OpenRouter partner reply at 23:21 UTC. Hosted attempts retain generic
HTTP 429 errors; no hosted attempt with the expanded diagnostic has yet been
recorded, so the specific admission cause is still unknown.

The latest [server deployment workflow](https://github.com/freemocap/skellyspeak/actions/runs/34306711776)
passed server tests, concurrent Firestore tests and container startup. Cloud Build
`ccc1d963-1d2f-4947-b972-a041a36bb81c` failed at step 3, **Verify revision**, after
the Deploy step. The workflow therefore does not establish that the expected image
is serving all traffic. The GitHub log does not identify which revision assertion
failed. Read the detailed Cloud Build log before changing or rerunning deployment.
This deployment failure has not been established as the cause of HTTP 429.

The client recognizes structured admission codes and retains safe request IDs.
Settings provides an on-demand authenticated `/v1/diagnostics` check. No automatic
polling or counter-reset operation is exposed.
