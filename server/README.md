# Hosted service

The active API source and deployment configuration live here. Authentication,
request/body limits, model pricing ceilings, transactional budget reservation,
settlement and session revocation apply to hosted AI calls.

## Diagnostics

`GET /v1/diagnostics` and `GET /v1/me` require the same signed, unrevoked
session as chat. Together they use a separate Firestore admission lane allowing
120 calls per account per UTC day and 600 calls globally. They do not debit the
inference/account daily request counter.

Signed-session short-window admission has two lanes per process:

| Lane | Per subject/minute | Per process/minute |
| --- | ---: | ---: |
| Chat and transcription | 60 | 240 |
| Account status and diagnostics | 30 | 60 |

A combined 300/minute ceiling remains, with at most 128 active subject windows.
An inference flood cannot consume the control lane's reserved capacity. Identity
storage exhaustion or infrastructure saturation can still prevent diagnostics;
these process-local gates are not distributed in-flight admission. Anonymous
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

Requires Python >=3.12 and ffmpeg. Firestore emulator tests skip unless
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
The Firestore emulator tests and Docker container startup remain CI gates and
were not run locally. Live IAM, logging policy, candidate startup and hosted inference
still need verification. See [the focused review](../SERVER-REVIEW.md) for findings,
remaining operational checks and supporting Google/OWASP guidance.

## Grouped-work admission module

`POST /v1/operations` uses account-scoped transactional claims after authenticated
per-item infrastructure admission and before spending reservation/provider dispatch.
The native hosted scheduler groups ready operations for this endpoint, saving
individual results as they arrive. Custom URL integration remains unfinished. Chat-completion and audio
routes do not use these claims; complete client/protocol integration before treating
duplicate protection as a property of every app request.

Each attempt identity is `<10-digit Unix submission seconds>-<32 lowercase hex>`.
It has a ten-minute submission window with 30 seconds of future clock tolerance.
The identity and server-computed canonical request fingerprint must remain unchanged
on duplicate delivery. An intentional retry has a new identity; clients must never
silently rewrite a rejected timestamp. Identical concurrent claims get one owner;
duplicates return state without an owner token or permission to dispatch. Reusing
an identity with a different fingerprint is a conflict. No result text is retained
in these admission receipts; duplicate success does not imply result recovery.

One account may hold eight leases across server instances. Leases expire after five
minutes. Grouped execution enforces a 180-second work deadline and checks that a full
work deadline fits inside the lease after spending reservation, before dispatch.
No transaction remains open during inference. A known terminal outcome releases its
own slot; uncertain outcomes retain the slot until expiry. Lease expiry bounds our
coordination state; it cannot prove a remote provider stopped processing.

Receipts contain fingerprint, internal ownership token, state, expiry and a TTL
24 hours after the timestamp embedded in the identity. Deployment provisions and verifies Firestore TTL for
`work_attempts.ttl` before promoting the service. TTL is cleanup, not deduplication
correctness: the immutable submission window rejects the same expired identity even
if its receipt has been deleted. Account slot records contain at most eight active
identities when claimed. No prompts, results, API keys or endpoint URLs are stored
or logged by this module. Existing daily admission must bound receipt creation per
item; batching must not debit it once per envelope.

Fake-ledger tests cover ownership, capacity, account scope, fingerprint conflicts,
uncertain outcomes, expiry and late/duplicate completion. The cross-process test in
`test_firestore.py` requires the explicitly enabled local emulator; it is not a
verified Cloud Run result. Grouped execution shields spending settlement and claim completion during cancellation.
Native client and self-hosted authentication integration remain required work.

### Grouped HTTP contract

The authenticated POST body has exactly `version: 1` and `items` (1–8), capped at
1 MiB for the whole envelope. Each item has `operation_id` (32 lowercase hex),
`attempt_id` (the timestamped identity above) and `request` (the validated text-chat
payload). Operation and attempt identities must be unique within the envelope.
This endpoint currently supports Gemini text chat only, with provider token
streaming disabled. Audio is not encoded in these JSON groups.

Responses are newline-delimited JSON (`application/x-ndjson`). Each item independently
produces an event containing its operation/attempt identities and one of:

- `type: result`, with `response` containing the bounded provider JSON.
- `type: duplicate`, with recorded `state`; no provider execution or result replay.
- `type: error`, with a fixed `code`, HTTP `status`, and bounded `retry_after` when
  supplied by admission. Raw exception and provider-error text are not exposed.

The last event is `type: complete` with `count`. Absence of an item result or this
marker cannot establish failure/no charge; the client must retain uncertain outcomes
without automatic replay. Results arrive in completion order through a bounded
one-event delivery channel. Provider requests execute concurrently, outside database
transactions. Each envelope consumes an authenticated infrastructure admission, plus
one per item (including duplicate checks); spending reservations occur only for
newly owned items. Unknown usage retains its reserved charge and lease until expiry.

Tests cover independent completion, duplicate delivery without extra inference or
spending, malformed groups, mixed success/failure and cancellation during inference.
No live deployment, native-client or full HTTP disconnect interoperability is claimed.

## Verified local emulator setup

The local Firestore suite passes all seven tests, including admission from separate
processes, using Google Cloud CLI 584.0.0 / Firestore emulator 1.22.0 and Homebrew
OpenJDK 21.0.12.1. The CLI is isolated under
`/private/tmp/skellyspeak-emulator-tools/google-cloud-sdk`; its config is under that
temporary directory. No cloud login or production credentials are needed.

For this machine, start the emulator with:

```sh
env PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" \
  CLOUDSDK_CONFIG=/private/tmp/skellyspeak-emulator-tools/config \
  CLOUDSDK_CORE_DISABLE_USAGE_REPORTING=true \
  CLOUDSDK_PYTHON="$PWD/server/.venv/bin/python" \
  /private/tmp/skellyspeak-emulator-tools/google-cloud-sdk/bin/gcloud \
  emulators firestore start --host-port=127.0.0.1:8787 --project=skellyspeak-local-test
```

Then, from the repository root:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 SKELLYSPEAK_FIRESTORE_TEST=1 \
  server/.venv/bin/python -m pytest server/test_firestore.py -q
```

The tests reject any other emulator address and use disposable project IDs. The
emulator warns that Java 25 will be required by newer tooling; align Java/tooling
versions before upgrading CI. Temporary tool files may be removed by the OS.
This verifies database transactions, not the full native Custom URL/server/provider
path. That local HTTP integration and app QA remain pending.

## Local server with real providers

Put `OPENROUTER_API_KEY` and `GROQ_API_KEY` in `server/local.env` (one `KEY=value`
per line; optional surrounding quotes, no shell expansion). The file must have
mode 600. Both it and `server/.local-server/` are Git-ignored and excluded from the
Docker allowlist. Never paste the keys into logs or command-line arguments.
`server/local.env.sample` is the credential-free, committable template. For a fresh
setup, create the private file without overwriting an existing one:

```sh
test -e server/local.env || install -m 600 server/local.env.sample server/local.env
```

With the loopback emulator running, start from the repository root:

```sh
server/.venv/bin/python server/local_server.py --check
server/.venv/bin/python server/local_server.py
```

The launcher sets emulator storage explicitly, uses the real OpenRouter/Groq HTTPS
endpoints, and binds the API to `127.0.0.1:8765`. `--check` validates key shape and
emulator reachability without inference, account creation or provider verification.
The local project is `skellyspeak-local-test`; the global spending reservation limit
is $0.50 per UTC day. Unknown provider outcomes retain their reservation.

Use these Custom URL settings in the native app:

- API base URL: `http://127.0.0.1:8765/v1`
- Authentication: Bearer session token
- Token: the contents of `server/.local-server/session-token.txt`
- Standard model: `google/gemini-2.5-flash`
- Fast model: `google/gemini-2.5-flash` (fast task routing is unassigned)
- Transcription model, when enabled: `whisper-large-v3`

A session token is generated through the server's normal signing code for the
local emulator account. It is written owner-only and refreshed on every launcher
start; update the app's saved token after restarting the local server. No Google
sign-in or unauthenticated bypass is used for this test. The launcher and private
files are not packaged into the production image. Real chat/audio calls incur
provider charges; configuration checks do not invoke inference.

## Deployment retention gate

The deployment helper enables and verifies the timestamp field `ttl` on
`auth_states`, `login_codes`, `admission`, `usage`, `global_usage`,
`devices`, `reservations` and `work_attempts` in database `(default)`.
It reads field configuration only, never document contents. Missing policies
are requested asynchronously, then checked for ACTIVE state for up to ten minutes.
A failure or pending activation stops deployment before traffic changes.
If activation takes longer, rerun Deploy server after policies become ACTIVE.
Expired records are deleted asynchronously; application expiry and duplicate
checks do not depend on deletion timing. Unresolved reservations intentionally
have no TTL until reconciliation; no TTL is added to accounts or spending controls.

The Cloud Build identity `skellyspeak-build` needs
`datastore.indexes.list`, `datastore.indexes.get`,
`datastore.indexes.update` and `datastore.operations.get`/
`datastore.operations.list` in the project. Use a narrowly scoped custom role;
do not grant Owner/Editor or give these administration permissions to the
runtime identity. IAM is not modified by the deployment helper. A permissions
failure is reported as GCLOUD_COMMAND_FAILED, with no raw cloud output logged.

Guidance: [Google TTL configuration and permissions](https://firebase.google.com/docs/firestore/ttl).
