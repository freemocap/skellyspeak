# Explicit speech requests — lifetime limit removed

## Diagnosis

The reported “Speech has reached its three-attempt limit” came from two native
checks: request admission and dispatch preparation. Both counted every historical
attempt for the message's speech operation, including successful generations.
Because audio is held in a bounded memory cache, eviction or restart could require
another generation and eventually make an otherwise valid message unplayable.
Explicit requests also faced the turn's 16-attempt budget.

## Implemented

Removed the three-attempt checks and the turn lifetime budget check from speech
requests. Each explicit request may queue a new generation when audio is absent
or the previous attempt failed. History, usage and diagnostics are retained.
Ready/running requests still coalesce; resident successful audio still replays
without inference. Queue capacity, pause/hold checks, source ownership and
connection validation remain. No automatic retry was added. Limits on other
operation types are outside this change.

## Verification

The regression runs 18 generations each for successful and failed speech,
checking retained attempt counts, duplicate-click coalescing, no automatic retry,
and unchanged sibling attempt counts. Existing tests also cover resident playback,
cancellation, restart, holds and source ownership.

Native suite: **446 passed, 0 failed, 2 ignored**, with loopback access for
local HTTP fixtures. Changed-file rustfmt and `git diff --check` passed.
Source changes require a native
rebuild/restart; no live app verification, deployment or commit was performed.

## Follow-up

The historical connection-revision lockout and related explicit retry limits are
addressed in [connection and retry audit](connection-retry-audit-2026-09-20.md).
The connection-validation description above records the earlier checkpoint.
