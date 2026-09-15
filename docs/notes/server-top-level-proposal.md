# Server first-level folder proposal

Status: approved and implemented, 2026-09-15. The completed moves are recorded in
[the move inventory](server-top-level-moves.json). Verification and remaining
limitations are recorded in [the checkpoint report](server-top-level-organization.md).

The Python/FastAPI service currently has 44 root Python files, including 19 test
files. Separate application runtime, tests, local development, service administration
and deployment before discussing deeper domain subfolders.

```text
server/
  app/                 Hosted API runtime
  tests/               Existing test files and conftest.py
  development/         Local launcher, local logging, example environment file
  operations/          Administrative usage and reconciliation tools
  deployment/          Build configuration and deployment/verification helpers
  README.md
  pyproject.toml
  uv.lock
  Dockerfile
  .dockerignore
```

## Whole-file placement

- `app/`: main.py, config.py, auth.py, auth_store.py, admission.py,
  work_admission.py, grouped.py, model_routing.py, quota.py, budget.py,
  transactions.py, contracts.py, audio_input.py, streaming.py, observability.py,
  diagnostics.py.
- `tests/`: all 19 test_*.py files and conftest.py. Keep their internals intact;
  test-suite subfolders and shared fixture extraction are a later discussion.
- `development/`: local_server.py, local_logging.py, local.env.sample.
- `operations/`: stats.py and reconcile.py. These operate on service data and
  accounts; they are not API runtime modules or local development launchers.
- `deployment/`: cloudbuild.yaml, deploy_candidate.py, verify_revision.py,
  retention.py and check_upload_manifest.py. Retention provisions Firestore TTL
  configuration through the deployment helper, so it belongs here.

Keep Dockerfile and .dockerignore beside the server build-context root. Package
metadata and the maintained layer guide remain at the root. Existing private
local.env, .local-server state and .venv are not source files to relocate in this
pass; update launcher path resolution so moving its source preserves their locations.

## Mechanical wiring included when approved

Add explicit Python package/import paths and update launch targets, test imports
and patch targets, root developer tooling, Docker source inclusion, Cloud Build and
GitHub workflow paths, upload allowlists, and maintained guide commands. Preserve
runtime-only image contents and exclusions for local secrets, tests and admin tools.
Do not introduce compatibility shims or rely on ad hoc sys.path mutations.

No function extraction, new API routes, schema changes, dependency upgrades,
application behavior changes, live administrative commands or deployment. Record
large-file problems for the later repository-wide decomposition pass. Update
AGENTS.md and server/README.md to the approved structure during implementation.

## Verification on implementation

Run the server tests and affected root launcher checks; verify container source
inclusion and deployment/upload path tests. Run emulator/container checks when
available and report any unexecuted checks distinctly. Read-only validation does
not authorize a build submission, traffic promotion or live provider request.

Alternative: `tools/` with development, operations and deployment subfolders would
reduce the number of root folders. Recommend the explicit peer folders above:
their different purposes are visible immediately without another generic container.
