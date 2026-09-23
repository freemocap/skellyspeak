# Decoder startup outage: local fix and verification

## Observed incident

Read-only Cloud Run logs show four failed instance starts between 14:00 and
14:03 UTC on September 23. The FFmpeg version check exceeded its 10-second
subprocess timeout, aborted FastAPI lifespan startup, and left requests returning
503 after readiness failed. The same deployed revision successfully started at
14:10 UTC. The cause of FFmpeg's temporary slowness is unconfirmed.

This is separate from the Windows Drill audio persistence failures in GitHub CI.

## Local implementation

- Increase the decoder startup subprocess budget from 10 to 60 seconds.
- Retain one attempt and fail startup on timeout, execution error or nonzero exit.
- Use the existing runtime phase logger for elapsed time and an ERROR-level
  `decoder_check_failed` event. Preserve structured timeout, reason, exit code,
  OS error and exception identity; omit raw process output and arbitrary messages.
- Add tests for readiness gating, completion, the longer budget, all three failure
  types, no retry, useful metadata retention and sensitive output omission.

## Verification

- Server suite: 540 passed, 7 Firestore emulator tests skipped. One existing
  Starlette/httpx deprecation warning.
- Real local launcher and FFmpeg verification succeeded; HTTP `/health` returned
  200 with `{"status":"ok"}` on temporary loopback port 18765. The existing
  process on 8765 was left running. The temporary instance was stopped afterward.
- Tests model a check exceeding the old budget; actual Cloud Run cold-start
  performance has not been reproduced locally or verified with this change.
- No provider calls, commits, pushes or deployments were performed for this fix.
  GCP and GitHub remain read-only. A running local app test is the next user check;
  the existing local server needs a restart to load these source changes.
