---
sidebar_position: 8
title: Hosted API
---

# Hosted API

The hosted service runs FastAPI on Cloud Run in `skellyspeak-api`, region
`us-central1`. It authenticates accounts and meters chat, speech generation,
and microphone transcription. Bring-your-own-key and custom-server requests
are routed by the Rust core without passing through this service.

## Request ownership

| Module | Responsibility |
|---|---|
| `server/main.py` | HTTP authentication, upstream calls, cancellation handling, responses |
| `server/contracts.py` | Allowed text/audio request shapes and price reservations |
| `server/audio_input.py` | Bounded audio decoding and duration-based transcription pricing |
| `server/budget.py` | Atomic admission and idempotent dated settlement |
| `server/transactions.py` | Local transaction serialization and bounded retries for contention |
| `server/auth.py`, `server/auth_store.py` | JWT/PKCE validation and atomic one-time code consumption |
| `server/quota.py` | Account admission, session revocation, device records and usage reporting |
| `server/reconcile.py` | Inspect unresolved charges and verify provider receipts |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness; startup checks configuration and the audio decoder |
| GET | `/auth/start` | Begin Google sign-in in the system browser |
| GET | `/auth/callback/google` | Validate identity and issue a one-time app code |
| POST | `/auth/exchange` | Exchange that code with its PKCE verifier |
| GET | `/v1/me` | Identity and daily allowance |
| POST | `/v1/chat/completions` | Validated, metered OpenRouter chat and speech |
| POST | `/v1/audio/transcriptions` | Validated, metered Groq transcription |

## Authentication

Desktop sign-in uses a bound loopback listener; mobile uses a
`skellyspeak://auth` deep link. Redirect targets are validated, and PKCE binds
the one-time code to the initiating app. Firestore validates and consumes
state/code documents transactionally, so concurrent exchanges have one winner.
States expire after five minutes and exchange codes after two minutes.

Session JWTs last 30 days. Each authenticated request checks the account's
`token_version`, so deleting an account or increasing that version revokes
access. The runtime needs a signing key of at least 32 bytes. The native app
stores its session and provider keys in the platform credential vault.

Sign-in-start throttling is process-local: 20 attempts/minute per instance.
Instance replacement and distributed traffic can exceed one instance's rate;
this is not a global denial-of-service or infrastructure-spend limit.

Every instance also rejects traffic above 240 attempts per rolling minute before
application database access. Shared Firestore transactions count accepted auth
steps (500/day), authenticated account requests (2,000/account/day and
10,000/service/day). These counters include later failures and never refund.
Signed, purpose-bound OAuth state and exchange codes reject fabricated values
before database lookup; one-time consumption and PKCE still apply. Sign-ins
already in progress during this deployment must be restarted. Installation IDs
must be canonical UUIDs, with at most ten device records per account. Daily
admission records use a two-day TTL; expiry is enforced by UTC bucket selection,
not by waiting for Firestore deletion.

These controls bound admitted work, not the cost of all rejected traffic. A
public endpoint still needs edge abuse controls; Cloud Run instance counts and
billing alerts are not hard monetary caps.

## Spending admission and settlement

Money is stored in integer micro-dollars: 1,000,000 equals one US dollar.
Every paid request atomically reserves its conservative maximum against both
`users/{id}/usage/{UTC-date}` and `global_usage/{UTC-date}` before contacting a
provider. It also creates `users/{id}/reservations/{request-id}`.

Settlement corrects both totals in the original UTC bucket. Repeating an
identical completed settlement has no effect; conflicting settlements fail.
Missing or incomplete usage retains the full reservation for investigation.
A reported charge above its reservation is recorded and blocks further
admissions through the persistent `service_controls/spending` document, including after midnight. An operator must investigate before clearing that control; it has no TTL. Cancellation and provider HTTP errors cannot release an unverified charge.

The service accepts only the configured, priced model contracts:

- `google/gemini-2.5-flash`: text-only input, disabled/minimal reasoning,
  strict structured output, and bounded output tokens.
- `openai/gpt-audio-mini`: streamed PCM16 speech, a supported voice, at most
  2,000 output tokens. Input audio is not accepted on this endpoint.
- `whisper-large-v3`: JSON transcription of a decoded recording up to 120
  seconds; price includes the provider's ten-second billing minimum.

Alternative model lists, caller-controlled routing, multimodal chat inputs,
unknown fields and unbounded token limits are rejected. OpenRouter receives
`require_parameters` and per-token price ceilings. Reservations depend on the
provider honoring its token limits and pricing; they are not a guarantee
against provider billing errors or every cloud infrastructure charge.
OpenRouter documents the routing controls in its
[provider-selection reference](https://openrouter.ai/docs/guides/routing/provider-selection).

Audio reserves its maximum transcription charge before reading or decoding the upload. Locally rejected audio releases that model reservation, but not its request-admission count. Upload reading has a 30-second deadline. Audio is decoded using a restricted ffmpeg input protocol, bounded duration,
allocation/probe limits and a timeout. Two decodes/transcriptions can occupy an
instance concurrently. Cloud Run admits eight requests per instance, with a
maximum of four instances; these settings bound concurrency, not total bills.

`/v1/me` reports `estimated_turns_remaining`. This wire field counts individual
AI requests; the client presents it as `estimated_requests_remaining`. A conversation
turn can make several model calls, and this estimate uses average request cost.
Pending reservations can temporarily reduce the displayed allowance.

## Reconciliation and retention

Run these from `server/` with application-default credentials for the intended
project. Receipt settlement also requires `OPENROUTER_API_KEY` in the environment.
Do not put the key in a command argument or a committed file.

```powershell
uv run python reconcile.py list
uv run python reconcile.py settle --user 'google:ACCOUNT_ID' --request 'REQUEST_ID'
```

The settle command verifies the stored generation ID against OpenRouter's
receipt and uses its reported total cost and token counts. Requests without a
provider generation ID stay reserved until their billing can be investigated.
Do not clear daily totals to free allowance: outstanding reservations depend on
them. Reconcile promptly; daily usage rows become eligible for TTL after 90 days.

Completed reservations, usage and device rows use the `ttl` timestamp field
with 90-day retention. Pending/unknown reservations have no TTL. Sign-in
records become eligible for deletion after one day; logical expiry applies
independently of Firestore's asynchronous deletion schedule.

`stats.py` reports usage and can set a per-user daily limit. Its zero-dollar
argument removes the override. It cannot reset the ledger. A report mismatch
fails and should be rechecked while requests are idle, since report reads are
not one atomic snapshot.

## Deployment and IAM

`server/cloudbuild.yaml` builds an image and deploys it using
`skellyspeak-build@skellyspeak-api.iam.gserviceaccount.com`. The runtime identity
is `skellyspeak-run@skellyspeak-api.iam.gserviceaccount.com`:

- Runtime: Firestore data access and access to five named application secrets.
- Builder: artifact writes to `gcr.io`, reads from the build staging bucket,
  logs, service usage, deployment of the existing Cloud Run service, and
  permission to run it as the runtime identity.
- GitHub deployer: submit builds, read build logs, use the staging bucket and
  select the build identity. Federation is restricted to this repository's
  numeric owner/repository IDs and the deployment workflow on `main`.

`scripts/setup-gcp-deploy.ps1 -Phase Grants` establishes scoped grants. Verify a
candidate build before running `-Phase Prune` to remove broad project grants.
The default compute builder retains scoped build access during rollout; it
has no Editor, runtime-secret or Firestore-data grant.

The GitHub workflow gates deployment on server tests, independent-process
Firestore emulator tests and container startup checks. Cloud Build checks that
the intended image's ready revision receives all traffic; GitHub checks public
health and unauthenticated rejection. Container base images and Python
packages are pinned by digests/lockfile. Secret values are runtime bindings,
never build substitutions.

```powershell
gcloud builds submit --project=skellyspeak-api --config=server/cloudbuild-check.yaml --gcs-source-staging-dir=gs://skellyspeak-api_cloudbuild/source
```

This builds/tests/pushes a candidate without changing serving traffic.
Changes to the allowance response require coordinated native-client and server
releases. Keep the working revision serving until that release is ready.

## Local checks

```powershell
cd server
uv sync --frozen --group dev
uv run --frozen pytest -q
```

Install ffmpeg to exercise real decoding. Emulator integration additionally
requires Java, the Firestore emulator on `127.0.0.1:8787`, and
`SKELLYSPEAK_FIRESTORE_TEST=1`. Tests use isolated project namespaces and refuse
non-loopback emulator targets.
