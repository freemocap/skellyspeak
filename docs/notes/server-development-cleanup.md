# Server development launcher and logging cleanup

Status: observations and deferred implementation work, 2026-09-15.

## Current responsibilities

- development/launcher.py (formerly local_server.py) reads private provider
  keys, establishes emulator-only configuration before importing the normal API,
  checks emulator connectivity, provisions a local user/session and starts Uvicorn.
  It is a development launcher, not a second API implementation.
- development/logs.py (formerly local_logging.py) creates private log files,
  installs Python logging handlers, wraps stdout/stderr and records safe event data.
- tools/run-log.ts starts the Python process, captures its stdout/stderr to separate
  files, records process lifecycle and forwards termination signals.

## Review after folder organization

1. Define ownership of process output versus structured application events.
   Both layers currently capture output; their redaction and record formats differ.
   Decide which records are intentional before consolidating or deleting either.
2. Python logging repeats route/error allowlists and matches exact authored print
   strings from the launcher. Prefer explicit event identities and a reviewed
   shared event contract over coupling behavior to sentence text.
3. Review logging installation/teardown: install replaces global handlers and
   stdout/stderr, while file close does not restore those global objects. Define
   lifecycle before changing it, including failure and repeated-start behavior.
4. Keep emulator-only setup before API imports and preserve credential/token file
   permissions, diagnostic correlation and fail-on-log-write-error behavior.
5. Consider separating launcher configuration/session setup only when it improves
   ownership or testability. Current sizes (110 and 207 lines) do not alone justify
   splitting these files. Avoid a second runtime implementation or broad framework.

This note does not establish a redesigned logging system or authorize implementation.
