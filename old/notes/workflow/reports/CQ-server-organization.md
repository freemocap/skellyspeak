# Server package and module organization proposal

Status: proposal only, based on the shared rebuild after checkpoint b68c64a. No source moves, new dependencies, deployment, restart or behavior changes performed. The user explicitly requested that server organization remain on the roadmap. Treat Python with the same ownership, testing and maintainability standards as the frontend and native code.

## Evidence from the current server

The server has 22 non-test Python modules at its top level, alongside tests and operational scripts. Existing responsibility boundaries are useful; preserve them rather than inventing a replacement framework.

| Current code | Actual coupling and implication |
| --- | --- |
| `main.py` (738 lines) | Imports 12 local modules at top level; creates config, Firestore client, JWT key client and admission state at import. Owns auth/account/diagnostic/chat/audio/grouped routes, provider HTTP handling and reservation settlement. This is the main concentration of unrelated responsibilities. |
| `auth.py`, `auth_store.py` | Auth primitives have no local-module dependency; the store imports auth and transactions. Preserve pure token/PKCE logic separately from persistence. |
| `quota.py`, `budget.py`, `admission.py`, `work_admission.py` | All persistence paths converge on transactions; budget and both admission modules import quota. Group as account/usage policy, but do not combine their distinct reservation, ingress and operation-claim lifecycles into one class. |
| `grouped.py` | Imports admission, contracts, quota and work admission. Its `results` accepts an execute callback; keep that seam. Main supplies `execute_grouped_item`, which owns provider execution and settlement. Do not create a back-import from grouped transport to application composition. |
| `contracts.py`, `audio_input.py`, `streaming.py` | Request validation, bounded audio decoding and SSE parsing are already separate. Keep their limits and error contracts intact. |
| `observability.py`, `local_logging.py`, `diagnostics.py` | HTTP error/observation helpers, local private file sinks, and account diagnostic reports serve different callers. Diagnostics imports quota/budget/admission/transactions; avoid burying account reports in a generic logging utility. |
| Tests | `test_proxy.py` patches `main.db`, overrides app auth dependencies and replaces `main.httpx.AsyncClient`; grouped tests patch `main.provider_json`. `conftest.py` seeds fake environment before import because main loads configuration immediately. Route extraction must update patch targets or provide explicit injectable runtime dependencies. |
| Entrypoints | Docker explicitly copies runtime Python files and launches `main:app`; `scripts/dev-run.ts` launches `server/local_server.py`; local launcher installs logging/configures environment before importing app. Cloud Build invokes `server/deploy_candidate.py`. Updating imports alone will break these paths. |

The modules form a mostly one-way dependency graph; the initial cleanup should formalize it. No evidence here requires generic repository interfaces, an event bus, dependency-injection framework, or a class per file.

## Smallest useful target

Use a regular `server/skellyspeak_api/` package with explicit package imports and small `__init__.py` files. Keep the existing server project root and lockfile; a `src/` packaging conversion and build-backend change are unnecessary for this slice.

```text
server/
  pyproject.toml, uv.lock, Dockerfile, cloudbuild.yaml
  skellyspeak_api/
    __init__.py
    app.py                 # composition, lifespan, middleware, router registration
    config.py
    runtime.py             # introduced only during main extraction
    auth/
      __init__.py, tokens.py, store.py
    usage/
      __init__.py, quota.py, budget.py, admission.py, work_admission.py
    transport/
      __init__.py, contracts.py, audio_input.py, streaming.py, grouped.py
    storage/
      __init__.py, transactions.py
    telemetry/
      __init__.py, http.py, local_logging.py
    routes/                # introduced only during main extraction
      __init__.py, auth.py, account.py, inference.py
    execution.py           # provider calls + reserve/settle during extraction
    diagnostics.py         # account usage report; retains usage dependencies
    cli/
      __init__.py, local.py, reconcile.py, stats.py
  ops/
    __init__.py, deploy_candidate.py, retention.py, verify_revision.py
  tests/
    conftest.py, test_*.py  # preserve current names first; no empty category tree
```

Mapping: `main.py` initially becomes `app.py` unchanged internally; `auth.py` becomes `auth/tokens.py`; `observability.py` becomes `telemetry/http.py`; other names remain recognizable. Operational deployment scripts stay outside the runtime package/image. The storage subpackage has one transaction module initially because it is shared by auth and usage; do not force those domains to depend on each other to access transaction machinery.

Dependency direction: app composes routes and runtime; routes call auth/usage/execution; execution uses transport and usage; auth store and usage depend on storage. Telemetry helpers remain independent of domain storage; diagnostics may depend on usage. Lower-level modules must not import app, routes or CLI modules. Existing HTTPException use can remain during this refactor; converting domain error types is separate work.

## Staged implementation

1. **Package existing modules and move tests.** Make import-only moves first, preserving main's current initialization order and all public HTTP contracts. Update every test import/patch target, Docker COPY/uvicorn target, local launcher, Cloud Build script path, README commands and operational sibling imports together. Use `python -m skellyspeak_api.cli.local` from the server project directory and the equivalent module targets for stats/reconcile. Use an explicit supported ops module invocation for Cloud Build. Do not leave old flat aliases, sys.path mutations or compatibility launchers.
2. **Extract main's composition and execution.** Introduce an explicit runtime object for config, clients and admission state plus a small app factory. Keep fail-fast configuration and decoder verification before serving requests. Preserve local launch ordering: private logging installation and loopback environment preparation must precede application initialization. Separate auth/account routes from inference routes, and move provider/reservation execution into `execution.py`. Route modules receive runtime via declared dependencies; they do not fetch globals from app. Preserve grouped callback injection and cancellation shields. Keep chat/audio/grouped inference routes together initially because they share budgets and provider execution.
3. **Document and stop.** Add a short server architecture section describing ownership, dependency direction and commands. Adopt relevant canonical style guidance when approved. No simultaneous provider protocol changes, auth redesign, quota schema changes, dependency upgrades or speculative subpackages.

Each stage must be reviewable and green on its own. Integration assigns a server owner and freezes affected files before implementation; Code Quality independently reviews each handoff. No moves are authorized by this proposal alone.

## Verification and acceptance

- Preserve the current 221 server tests and seven emulator tests as the baseline; record actual future run counts separately. Run pure/unit/ASGI checks first and the emulator transaction suite in its approved loopback environment. Do not access production Firestore.
- Existing tests must continue proving grouped partial outcomes, bounded work/admission, quota reservation/settlement, cancellation, auth/PKCE, retention/deployment inspection, audio/request limits, SSE decoding, private log filtering and local launch configuration.
- Add meaningful import/entrypoint coverage: package modules import with explicit test configuration; route registration keeps endpoint paths and dependencies; package can resolve outside accidental flat-module imports; local bootstrap still configures before app construction. Import should not create an uncontrolled production client. Do not write tests merely asserting the proposed folder tree.
- During app-factory extraction, prove two app instances with separate test runtimes do not share quota/admission state; missing required configuration still fails before request serving; provider and database injection work without monkeypatching app globals. Preserve denial status and response contracts.
- Verify Docker's runtime file set and uvicorn package target, Cloud Build operational paths and TypeScript dev launcher arguments. A container build can be scheduled with the owner when permitted; no deployment or app/server restart is part of proposal review. Do not install dependencies merely to draft this plan.
- Final review checks diff for behavioral changes hidden among moves, broken dynamic imports, missing package files, source/test coupling, stale flat commands and changed cleanup/cancellation ordering. Generated artifacts, keys and runtime logs remain excluded.

Completion means coherent imports, explicit composition boundaries, correct entrypoints and preserved behavior—not just more directories. This is deferred implementation after the checkpoint, not a blocker retroactively applied to it.
