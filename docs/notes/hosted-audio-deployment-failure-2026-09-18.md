# Hosted audio deployment investigation — September 18, 2026

Status: source fixes verified locally; no deployment or live inference performed.

## Observed failures

- [Latest CI](https://github.com/freemocap/skellyspeak/actions/runs/35381499391)
  failed its server upload-manifest check and Windows Rust formatting check.
  The other jobs passed. The separate v2.0.3 release succeeded; that does not
  establish that the server deployed.
- [Server deployment](https://github.com/freemocap/skellyspeak/actions/runs/35356285132)
  stopped at the upload-manifest check before Cloud Build/deployment. Its Python
  tests passed (377 passed, 7 skipped), but the source archive excluded
  `server/app/diagnostics/exceptions.py`, required by the Dockerfile.
- Read-only GCP inspection found 100% production traffic on revision
  `skellyspeak-api-b75834e65e0f24b9b96ead890af830546`, created September 14 at
  22:47:44 UTC. Its build predates the September 18 ElevenLabs integration.
- `/health` returned 200; an unauthenticated POST to `/v1/audio/speech` returned
  404, confirming the live service lacks the new speech endpoint. The current
  source returns 401 there before inference when authentication is absent.
- Cloud Logging recorded transcription HTTP 400 / `INVALID_REQUEST` at
  19:12:37 UTC, request ID `5d80e2e4093c487dae91340e52ab5240`. The retained
  metadata does not identify the individual rejected field. Pre-integration
  source accepts only `whisper-large-v3` and two-letter language hints; the
  current app defaults to `scribe_v2`. This is a concrete contract mismatch
  consistent with the reported failure; no request content was retrieved.
- ElevenLabs secret version 1 is enabled and its secret-level policy grants
  the runtime service account Secret Accessor. The secret value was not read.
  These checks do not establish provider permissions, credits or voice access.

## Implemented fixes

- Added the missing module to the explicit Cloud Build upload allowlist.
- Added a unit regression check for Docker/build sources missing from that
  allowlist. The existing gcloud sentinel check still verifies actual ignore
  semantics and rejects private files.
- Upload-check errors now identify missing/unexpected synthetic paths, instead
  of reporting counts alone. No private source contents are inspected.
- Applied rustfmt to the eight native files flagged by the formatting gate.
- Extended post-deployment authentication checks to both audio endpoints, so
  a missing endpoint cannot pass as a healthy deployment.

## Verification and remaining work

- `server/.venv/bin/python server/deployment/check_upload_manifest.py`: passed
  against the installed gcloud CLI, using isolated synthetic files.
- `server/.venv/bin/python -m pytest server -q`: 378 passed, 7 skipped.
  The skipped tests require the Firestore emulator.
- `cargo fmt --manifest-path native/Cargo.toml -- --check`: passed.
- `git diff --check`: passed.
- Docker is unavailable locally; container startup and Firestore emulator
  verification remain GitHub deployment gates. Native changes are formatting
  only; the Rust behavior suite was not rerun for formatting.
- Deployment requires explicit authorization under AGENTS.md. After rollout,
  verify the serving revision and authenticated audio with `scribe_v2` and
  `eleven_v3`, including WAV playback and transcription word timing. A green
  health/authentication check alone is insufficient evidence of working audio.
- Existing unrelated UI and prompt-proposal edits were preserved.

## Authorized rollout follow-up

The user authorized push, deployment and live audio verification. Commit
`510e450` was pushed to main. Its upload gate and container checks passed, but
[the deployment run](https://github.com/freemocap/skellyspeak/actions/runs/35385191492)
then exposed a Firestore emulator failure: six integration tests passed and
`test_work_claims_coordinate_separate_server_processes` exhausted aborted-commit
retries during the capacity burst. No new revision was deployed by that run.

Initial hypothesis (superseded): the transaction helper used `max_attempts=1`, then restarted fresh transactions
outside the SDK. The installed SDK's transaction decorator preserves the original
transaction retry ID across commit retries, retaining contention priority. The
helper now enables six SDK commit attempts; exhausted commit errors propagate.
Explicitly aborted reads retain bounded rollback/backoff retries because the
SDK does not retry exceptions from the transaction body. Uncertain outcomes and
ordinary validation errors are not replayed. Provider calls remain outside these
transactions and are not retried. See the
[SDK transaction contract](https://docs.cloud.google.com/python/docs/reference/firestore/latest/google.cloud.firestore_v1.transaction.Transaction).

Five new tests exercise the real SDK decorator with mocked transport boundaries:
preserved retry identity, bounded commit exhaustion, read-abort rollback and
non-replay of validation/deadline failures. Local result: 383 passed, 7 emulator
tests skipped. The original emulator capacity test is unchanged and must pass
before deployment.

Commit `cd198e1` tested SDK-managed retry priority, but the emulator still failed
under contention (including the spending-ceiling test). Local reproduction with
the official Firestore emulator 1.22.0 and Java 21 confirmed the problem. This
candidate was not deployed. SDK priority alone was therefore not the solution.

The final correction restores explicit rollback/fresh-transaction retries, still
limited to six attempts, and expands randomized backoff from 20–800 ms to
100 ms–5 seconds with an exponential cap. Known read/commit aborts may retry;
uncertain outcomes still fail without replay. The maximum combined explicit
sleep is 12.5 seconds, excluding database RPC time. The tests now verify rollback
before retry, six-attempt exhaustion and refusal to retry unrelated failures.
All seven **unchanged** emulator integration tests passed locally in 60.85 seconds,
including duplicate ownership and the 128-request work-capacity burst. Google
[documents emulator locking differences](https://docs.cloud.google.com/firestore/native/docs/emulator#transactions);
this test result does not establish production throughput or latency.

Live authenticated smoke verification needs an existing hosted app session.
The local workspace had no saved hosted credential; the user was asked to sign
in. GCP admin access is available and is not a substitute for an app session.
