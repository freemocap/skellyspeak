# Server top-level organization checkpoint

Status: implemented after approval, 2026-09-15.

Applied the [approved structure](server-top-level-proposal.md). The
[move inventory](server-top-level-moves.json) records 46 whole-file moves into
app, tests, development, operations and deployment. Added Python package markers
and explicit imports; preserved class/function inventories and existing private
local configuration/state paths. No implementation decomposition was performed.

Updated root launcher arguments, Docker copies/entry point, Cloud Build and both
affected GitHub workflows, explicit upload/context allowlists, path-sensitive
tests, the content index, AGENTS.md and server/README.md. The deployment helper
runs as a package module. Container and upload boundaries still exclude tests,
local development code, operations tools and private data.

## Verification

- Documented uv/pytest command: 271 passed, 7 emulator tests skipped, 1 failed
  because of the existing missing fixture described below. The remaining suite
  also passed with just that known failure deselected; no test was disabled in source.
- Deployment/local-launcher tests also passed from the server working directory.
- Actual gcloud upload-manifest sentinel check passed without upload/authentication.
- Staged exactly the Dockerfile COPY inputs into a temporary directory: packaged
  runtime imported successfully, /health returned 200 and unauthenticated /v1/me
  returned 401. This was an in-process smoke check, not a Docker build.
- Local launcher --help succeeded without loading private keys or starting inference.
- Current documentation links passed; all 46 destination files exist and original
  paths are absent. Class/function inventories are unchanged.
- Root launcher TypeScript checks and all 4 logging tests passed. Diff whitespace
  checks passed.

Docker is not installed here; image build/startup was not run. The Firestore
emulator suite was not run. No deployment, live administrative command, provider
request, commit or push was performed.

## Existing fixture failure: follow-up

`test_native_gloss_schema_is_relaxed_only_at_groq_transport_boundary` expects
`workflow/benchmarks/model-routing/native-gloss-fixtures.json` at the repository
root. The pre-move test in HEAD uses that same root-relative location. That path
is absent; the tracked file is under `old/notes/workflow/benchmarks/model-routing/`.
The move preserves the original target with the corrected parent depth.

Review this fixture separately and establish a maintained server test fixture
derived from the current native contract. Do not silently depend on archived
benchmark material or copy it into active tests without review. The test remains
enabled and its failure remains visible.
