# Server subfolder checkpoint

Status: implemented after approval, 2026-09-15.

Applied the [approved grouping](server-subfolders-proposal.md): 34 whole-file
moves recorded in [the inventory](server-subfolder-moves.json). Application files
now use identity, admission, inference, accounting and diagnostics groups. Tests
use subject folders plus integration/development/deployment/operations.
Renamed development files to launcher.py and logs.py, with matching test names.

Updated explicit imports, package markers, path-sensitive tests, Docker source
copies, upload/context allowlists, CI paths, root launcher, content index and
maintained guides. Class/function inventories are unchanged. Private config/token
paths, runtime behavior and logging implementation remain intact. AGENTS.md
documents the implemented boundaries.

## Verification

- Full server suite: 271 passed, 7 Firestore emulator tests skipped, 1 known failure.
  The failure remains the missing model-routing fixture recorded in the previous
  checkpoint; no tests were disabled or fixture behavior changed.
- Actual gcloud upload-manifest sentinel check passed.
- Staged exactly the Docker COPY inputs: runtime imports, health 200 and
  unauthenticated account request 401 passed in an in-process smoke check.
- Renamed development launcher --help passed without starting the API.
- Root launcher TypeScript check and all 4 logging tests passed.
- Current documentation links, move inventory and diff whitespace checks passed.

Docker is unavailable; no image build/startup or Firestore emulator run was
performed. No live provider calls, administrative actions, deployment, commits or
pushes were performed. Logging consolidation and large-file decomposition remain
separate follow-ups.
