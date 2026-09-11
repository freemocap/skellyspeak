# U1 — frontend durable diagnostic capture

Scoped source complete/frozen; Reliability owns native append/flush and server sink, Integration owns launcher stdout/stderr capture and shared run manifest. No UI controls/layout, restart, native/server source or Git writes by U1.

## Coverage

- main installs idempotent console and window error/rejection capture before application startup. Captures standard console log/info/debug/warn/error, trace/table/dir/dirxml, group/groupCollapsed/groupEnd, count/countReset, time/timeLog/timeEnd, clear and failed assert occurrences. A successful assert emits no error event. Disposal restores original methods/listeners.
- Application log helpers and captured console each send exactly one event per occurrence. Helpers bypass console recapture; console output is a safe summary. Unknown/cyclic objects are never serialized. Redacted argument counts explicitly identify omitted bodies.
- Known authored settings/microphone/application/registry/IPC events have reviewed enum IDs. Registered command allowlist excludes diagnostic commands; arbitrary command strings become null. Typed native codes and precise approved causes preserve useful diagnosis (including custom transcription unconfigured and JS/playback failure classes).
- Application native wrapper awaits diagnostic acknowledgement before rethrowing original IPC failures. reportFault awaits delivery outcome before publishing the original private error in the UI. Startup failure rendering also waits for delivery outcome. Raw messages remain available to the affected UI; they are not copied into operational logs.
- Delivery rejection returns false, records every failure count locally, emits a sanitized original-console message and one existing fault notice per outage. That notice uses a no-forward fault helper, preventing recursion. A successful receipt resets the outage notice guard. Exported diagnosticDeliveryState reports pending and failed counts. No automatic retry or claim of persistence for failed/unacknowledged events.

## Native contract

record_frontend_diagnostic retains context/code/level/nativeCode/faultId and adds optional command/cause/eventName/redactedArgs. All identifiers are fixed allowlists; raw message, stack, URL, transcript, secret and arbitrary object fields are excluded. Reliability confirmed append plus flush before success receipt, no rate cutoff, and SKELLYSPEAK_LOG_RUN_DIR as the shared run location. This handoff does not independently claim native file inspection or server completeness.

## Fidelity and limits

This is occurrence-complete capture for the listed frontend entry points after installation, not full raw-text logging. Arbitrary argument bodies and stack frames are intentionally redacted, with counts; known-safe authored/cause IDs are retained. Console timer/group calls become structured occurrence summaries, not full console renderer output. Browser-only preview has no native file sink. JavaScript module failures before capture installation, process termination before native acknowledgement, unavailable IPC/sink, and uninstrumented native/server output require the other owners' capture paths; they are not silently marked persisted. Pending acknowledgements cannot be synchronously awaited by the browser console API.

## Verification

10 focused diagnostic/native/fault tests pass: command/cause allowlists and secret exclusion; cyclic console input; exactly-once helper/console forwarding and install idempotence; window errors/rejections; explicit nonrecursive sink failure; native failure and fault publication waiting for acknowledgement. Build passes. Combined npm test ran 80 passing frontend files / 379 passing tests, but overall gate failed on Integration's new node:test-based scripts/run-log.test.ts being discovered by Vitest (no Vitest suite; child exit mismatch under wrong runner). Reported to Integration; not modified by U1. Do not describe combined tests as green until that gate is resolved.

Owned files: lib/log.ts, native.ts, faults.ts, main.tsx, log/native/fault tests. No UI or style changes.
