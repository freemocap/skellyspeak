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
