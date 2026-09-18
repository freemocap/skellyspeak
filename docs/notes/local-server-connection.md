# Local server connection shortcut

Implemented 2026-09-18. This replaces manual token copying for desktop development
builds; it does not change the server authentication model.

## Behavior and ownership

Start the server, open Settings → AI access → Custom URL, and choose **Connect to
local server**. The native command reads the token from the checkout used to build
the app and saves it through the existing revision-checked custom-access credential
writer. The UI receives masked settings only and runs the existing connection
check. Model selections and hosted sign-in remain unchanged. A failed check leaves
the saved local settings available for an explicit retry.

The UI button follows a native capability query. The reader and saving branch are
compiled only for desktop builds with debug assertions. Other builds have a
rejecting command stub, so hiding the button is not the security boundary.
Relocating a checkout requires rebuilding. Other builds retain manual Custom URL
setup; no file picker or filesystem search was added.

## Security boundaries reviewed

- The IPC accepts only a settings revision, never a credential path or destination.
- The destination is fixed to `http://127.0.0.1:8765/v1`, with bearer authentication.
- Only `session-token.txt` is read; `session.json` and its signing key are not read.
- The bounded reader rejects missing, malformed, oversized, nonregular and symlink
  inputs with a fixed error that contains no file contents.
- Existing credential serialization, revision checks and destination-change rules
  apply. Credentials do not pass through frontend inputs, invoke arguments or logs.
- The existing connection-check HTTP client refuses redirects.
- No server runtime, hosted authentication, bind address, CORS or GCP configuration
  changes are needed. Local credentials continue to require their independent
  signing key; there is no unauthenticated localhost exception.
- The Cloud Build upload audit now explicitly includes both session files and the
  development session module as forbidden synthetic sentinels. Its execution does
  not upload files or deploy anything.

This is not a defense against code running as the same OS user with access to the
checkout and credentials. The local server continues to use real provider keys.

## Verification

Passed:

- UI suite: 116 files, 738 tests, including import success, missing-token errors,
  native capability gating and IPC registration.
- Frontend production build and locale validation (seven locales).
- Native connection tests: 12; new local-reader tests: two.
- Native formatting, Clippy with warnings denied, and release library check.
- Server local-session, identity/authentication and deployment suites: 74 tests.
- Actual `gcloud meta list-files-for-upload` synthetic-fixture audit: private
  session files and development code excluded; no upload performed.
- Diff whitespace validation.

The broader native suite did not pass. The sandbox blocked loopback sockets;
rerunning with socket access cleared those transport failures but exposed an
unrelated starter-persona assertion (`vibe.len()` is two, expected three), also
reproduced in isolation. The broad runs were stopped while the existing
`queue_budget_counts_chat_coach_and_paused_work_transactionally` test remained
running. Persona data, validation and queue-budget implementation were not changed.

No deployed GCP service or real provider inference was used by these checks.
The running native app was not relaunched or manually exercised; rebuild/relaunch
the desktop development app to inspect the button.

## Startup error follow-up

A reported startup/shutdown sequence was traced to Uvicorn's socket-bind error
handler. Initial inspection found Python PID 55254 listening on 127.0.0.1:8765;
the process disappeared before a subsequent health check. The local log sanitizer
had reduced the OSError to `eventName: other`. It now classifies known socket
errnos and emits fixed actionable messages while continuing to redact exception
text and filenames. Unknown socket errors remain explicitly classified without
copying arbitrary text. Hosted runtime logging is unchanged.

Verification: all 14 local logging tests passed, including known/unknown socket
errors and secret-redaction assertions; diff whitespace check passed.

## Visibility and provider results follow-up

The local connection action now uses the shared filled primary button style,
full panel width, a 44px minimum height, body-size text and spacing above the
health card. Provider rows now follow the server's returned results instead of
hard-coding OpenRouter and Groq. ElevenLabs accepted/rejected/unreachable results
are visible, and Groq is omitted when the server uses ElevenLabs transcription.

The server already probes OpenRouter, Groq when selected for transcription, and
ElevenLabs when configured. No server runtime change was required. New server
tests cover those provider combinations, and UI tests cover ElevenLabs states
and three-provider results. These are credential checks, not paid inference or
proof that every synthesis voice/model request will succeed.

Verification: 34 focused UI tests and 11 provider-health tests passed; frontend
build, seven-locale validation, style checks and diff whitespace checks passed.
