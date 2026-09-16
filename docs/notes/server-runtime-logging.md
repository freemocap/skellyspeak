# Server runtime logging — September 16, 2026

## Observed cause

The local logging installer replaced all root handlers with a file-only handler.
Uvicorn propagated to that handler, with raw access logging disabled. Authored
request and grouped error events existed on disk but were invisible in the terminal.

## Implemented

Local Python logging now sends the same sanitized event to terminal and JSONL,
flushing both. Raw stdout/stderr are sanitized for both destinations. Startup
prints the log directory. Runtime instrumentation covers full ASGI response
lifetime, correlation, provider requests, reservation
and settlement, and grouped admission/execution. Provider payloads and identifying
information are excluded through fixed event/field/value allowlists. Library debug
messages retain explicit redaction markers rather than interpolated text.

Runtime instrumentation lives in app/diagnostics/runtime.py. The existing large
main.py retains its endpoint/transaction ownership; this change only inserts
instrumentation at those existing boundaries. Its broader decomposition remains
a separate pass. Container and cloud source allowlists include the new module;
no deployment was performed. Existing unrelated working-tree changes were preserved.

## Verification

- Initial full server suite: 290 passed, 7 Firestore-emulator tests skipped.
- Added subprocess verification of installed terminal/file handlers, Uvicorn log
  propagation, absence of recursive writes and private text exclusion.
- Added concurrent request correlation, streamed body completion/counts,
  exception/cancellation cleanup tests.
- Whitespace checks passed.
- A real loopback smoke test could not bind a socket in the execution sandbox
  (PermissionError, errno 1). Live HTTP startup and actual provider calls were
  not verified. The user's existing server was not restarted.

Restart the local server to load this source. Disposable data clears on restart; local session credentials now persist. Logs have no automatic deletion or rotation.

## Follow-up: remove idle heartbeat

Removed the periodic heartbeat task, its event and counters, and its dedicated
test at the user’s request. Request and operation logging remain event-driven.

## Follow-up: provider error bodies

Added bounded, redacted `provider_error_response` records for non-success provider
HTTP responses and embedded JSON errors. Local file and terminal sinks preserve
the same sanitized response body. Successful payloads remain excluded. Reading
errors does not replace the original HTTP refusal. Free-text scrubbing is
best-effort; see the server README for precise coverage and limits.

## Follow-up: persistent local sessions

The local launcher now stores a signing-key/token pair atomically in the private,
Git-ignored local-server directory. Ordinary restarts reuse it; explicit
`--reset-session-token` replaces it. Local JWT lifetime is ten years, with the
normal signature/issuer/subject checks; hosted 30-day tokens are unchanged.
A first launch after the former ephemeral launcher requires one token replacement.
No running service or existing local credential files were changed during tests.
