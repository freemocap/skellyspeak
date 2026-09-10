# Hosted service

The active API source and deployment configuration live here. Authentication,
request/body limits, model pricing ceilings, transactional budget reservation,
settlement and session revocation apply to hosted AI calls.

## Diagnostics

`GET /v1/diagnostics` requires the same signed, unrevoked session as chat. Its
separate Firestore admission lane allows 120 calls per account per UTC day and
600 calls globally. Signed-session ingress allows 60 requests per subject per
minute and 240 per process, with at most 128 active subject windows. Anonymous
traffic has a separate 240/minute process gate; GET /health has a separate
60/minute gate. These application limits do not provide edge DDoS protection. Failed/revoked
signed-session attempts consume admission; invalid signatures perform no database
work. The endpoint does not accept a target account ID.

It returns the caller's daily request usage/limit and allowance usage/limit,
shared exhausted flags, spending-pause state, UTC reset time, and revision.
Shared balances, other identities, secrets and transcripts are excluded. Usage
includes reserved amounts: a request can exceed remaining allowance even before
an exhausted flag becomes true. This is a transactionally read admission snapshot,
not a provider probe or a guarantee that the next request will be admitted.

The app exposes this under Settings → AI access & models → Hosted → Service
diagnostics → Check service status. It never polls automatically. A missing route
before deployment reports an HTTP failure, not a healthy result.

Errors carry `code`, `detail`, a generated `request_id` and applicable `resets_at`.
Short-window rejections include Retry-After. Codes distinguish personal/shared
account/diagnostics daily admission, ingress, auth throttling, allowance exhaustion,
spending pause and transcription capacity. Spending pause has no automatic reset.
Unexpected failures return a generic INTERNAL_ERROR with a request ID.

JSON application logs contain generated request ID, matched route template,
status, rejection code, exception class when applicable, revision and elapsed time
to response headers. They exclude raw paths, query strings, IPs, identities,
headers, tokens, bodies and exception messages. They do not claim that a streamed
response finished successfully. Cloud Run's separately managed request logs have
Google's own fields and retention; these application changes do not configure them.

`/health` remains lightweight liveness, not account/Firestore/provider readiness.
No reset endpoint, administrative credentials, public diagnostics or relaxed
spending controls are introduced.

## Verification and deployment

From the repository root:

```sh
uv run --project server --frozen --group dev pytest server -q
```

Requires Python >=3.12 and ffmpeg. Six Firestore emulator tests skip unless
`SKELLYSPEAK_FIRESTORE_TEST=1`; the GitHub workflow runs these with the emulator.
It also builds the container, checks liveness and unauthenticated rejection before
deploying. The runtime image includes an explicit list of application modules;
local secrets, tests and administrative scripts are not included.

The user pushes changes. `.github/workflows/deploy-server.yml` runs on main for
server changes or manual dispatch, using configured Workload Identity Federation.
`gcloud beta builds submit` surfaces build output from Cloud Logging. Build helpers
are digest-pinned. `deploy_candidate.py` resolves the pushed image to an immutable
digest and deploys a build-specific revision with no traffic. Only that exact ready
revision with matching image/digest can be promoted explicitly to 100%; resulting
traffic is verified. A failed deployment never promotes, even if its revision
subsequently appears ready. Reports contain only image/revision/traffic metadata
and failure codes; raw gcloud errors, runtime logs and service specs are withheld.
The workflow also checks that unauthenticated diagnostics return 401.

No production deployment or counter reset is performed by local tests. A green
workflow must be followed by an authenticated diagnostic check and one hosted chat.

## Local review result

Security regression coverage includes unauthenticated/invalid-token denial before
Firestore access, revoked-session denial, independent bounded diagnostic admission,
account-scoped reports, read-only snapshots, secret-free error/log output, distinct
budget codes and deployment metadata redaction. No separate GitHub probe workflow,
GCS report bucket or diagnostic service account is added.

Local verification for deployment/admission hardening: 162 server tests pass.
The six Firestore emulator tests and Docker container startup remain CI gates and
were not run locally. Live IAM, logging policy, candidate startup and hosted inference
still need verification. See [the focused review](../SERVER-REVIEW.md) for findings,
remaining operational checks and supporting Google/OWASP guidance.
