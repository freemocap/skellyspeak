# Server subfolder proposal

Status: approved and implemented, 2026-09-15. Whole-file moves and mechanical import,
path and documentation updates only. No server implementation splitting yet.

See the [move inventory](server-subfolder-moves.json) and
[checkpoint report](server-subfolder-organization.md).

## Application groups

Paths below are relative to server/app. Existing filenames stay intact.

| Folder | Existing files |
| --- | --- |
| identity/ | auth.py, auth_store.py |
| admission/ | admission.py, work_admission.py |
| inference/ | grouped.py, contracts.py, model_routing.py, streaming.py, audio_input.py |
| accounting/ | budget.py, quota.py |
| diagnostics/ | diagnostics.py, observability.py |

Keep main.py, config.py and transactions.py at the app root. main.py remains the
entry point and existing route composition; config.py is service configuration;
transactions.py is the small shared Firestore transaction helper. Do not create
a single-file storage wrapper in anticipation of future extraction.

These are present responsibility groups, not newly independent layers. quota.py
also contains account/session/device behavior; retain that mixed file for now and
flag domain extraction for later rather than claim accounting is already isolated.

## Tests

Group whole test files by subject. Keep conftest.py at tests/ so it establishes
the fake environment before collection. Existing cross-test fixture imports stay
explicit and are updated to their new paths; fixture extraction is deferred.

| Folder under server/tests | Existing test files (test_ prefix omitted) |
| --- | --- |
| identity/ | auth |
| admission/ | admission, work_admission |
| inference/ | contracts, grouped, limits, model_routing, proxy, streaming |
| accounting/ | budget, quota |
| diagnostics/ | observability |
| integration/ | firestore, reservation_cancellation |
| development/ | local_server, local_logging |
| deployment/ | deployment, retention |
| operations/ | reconcile |

## Development names

Rename development/local_server.py to launcher.py and local_logging.py to logs.py;
rename their test files to test_launcher.py and test_logs.py in tests/development/.
The enclosing folder already says these are development-only. Keep local.env.sample
alongside them. Preserve private config/state locations and root server:local command.

Operations and deployment are small coherent folders already; leave their internals
alone. Update package markers/imports, Docker copies, allowlists, CI/test paths,
content index, guides and AGENTS.md as part of approved implementation.

## Separate implementation follow-ups

- Review development logging ownership; see [the cleanup note](server-development-cleanup.md).
- main.py is 771 lines and test_quota.py is 585 lines: record both in the source-size
  danger zone. Decompose after the repository folder pass, not during these moves.
- Resolve the existing missing model-routing fixture through the current native
  contract; do not hide or disable that failing test during reorganization.

## Verification

Run server tests, root launcher checks, package startup checks, actual upload-manifest
validation and documentation checks. Update nested path-sensitive tests without
weakening runtime inclusion or private-file exclusion checks. Report the known
fixture failure, skipped emulator tests and unavailable Docker distinctly.
