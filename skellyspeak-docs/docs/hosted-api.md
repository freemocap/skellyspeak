---
sidebar_position: 7
title: Hosted API
---

# Hosted API

`server/` is a FastAPI service on Cloud Run that lets someone use SkellySpeak
without holding any API keys of their own: they sign in with Google, and their
requests are proxied to OpenRouter and Groq through the project's accounts,
metered against a daily allowance.

It is one of three ways the app can reach an AI provider. The choice lives in
Settings and is resolved in exactly one place, `Settings::chat_provider` in
`src-tauri/src/settings.rs`.

| Mode | Endpoint | Credentials | Who pays |
|---|---|---|---|
| `cloud` | OpenRouter | the user's own key | the user |
| `custom` | any OpenAI-compatible server | optional, theirs | nobody — it is their machine |
| `hosted` | this service | a session token | the project |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness. |
| GET | `/auth/start` | Redirects the **system browser** to Google. |
| GET | `/auth/callback/google` | Google returns here; hands the app a one-time code. |
| POST | `/auth/exchange` | Trades the one-time code for a session token. |
| GET | `/v1/me` | Identity plus remaining allowance, for the quota display. |
| POST | `/v1/chat/completions` | Authenticated passthrough to OpenRouter, streaming. |
| POST | `/v1/audio/transcriptions` | Authenticated passthrough to Groq Whisper. |

## Sign-in

The app never holds an OAuth client secret. It opens the system browser at
`/auth/start`; this service performs the provider exchange and returns a
one-time code to the app's own redirect; the app trades that code for a
session token over HTTPS.

Three properties are load-bearing:

**The system browser, not the webview.** Google refuses OAuth from embedded
webviews (`disallowed_useragent`), and the app's UI *is* an embedded webview.
Desktop listens on a loopback port; Android uses a `skellyspeak://` deep link.

**The session token never travels in a URL.** The redirect carries a one-time
code with a 120-second life, exchanged over POST. URLs reach browser history,
server logs and referrer headers; a code that is already spent does not matter
if it leaks.

**`redirect_uri` is allowlisted** to loopback and `skellyspeak://` only
(RFC 8252). Without that the endpoint is an open redirect, which here means
handing an attacker a way to receive other people's sign-in codes. Hosts that
merely *look* like loopback — `127.0.0.1.evil.example`,
`127.0.0.1@evil.example` — are rejected, and there are tests for each.

Session tokens are HS256 JWTs valid for 30 days. The signing key must be at
least 32 bytes (RFC 7518 §3.2); a shorter one means forgeable sessions, so the
service refuses to start rather than accept it.

## Quota

Two ceilings, both in Firestore, keyed by UTC date:

- **Per user per day** — what one person can spend.
- **Globally per day** — what everyone together can spend. Per-user limits do
  nothing about a launch-day crowd, and that bill lands on the project.

Counters increment with `firestore.Increment`, applied server-side, so
concurrent requests from one account cannot lose an update by reading a stale
total. Allowance is checked *before* the upstream call, so an exhausted
account costs nothing.

Whisper bills by audio duration rather than tokens, so a transcription charges
a flat token equivalent — one currency in front of the user beats two meters
they have to reason about.

## GCP resources

Project `skellyspeak-api` (number `195823556545`), region `us-central1`.

| Resource | Detail |
|---|---|
| Cloud Run | `skellyspeak-api`, public, min 0 / max 4 instances, 600s timeout |
| Firestore | Native mode, `us-central1` |
| Secret Manager | `google-client-id`, `google-client-secret`, `jwt-signing-key`, `openrouter-api-key`, `groq-api-key` |
| Runtime identity | the default compute service account, with `secretmanager.secretAccessor` and `datastore.user` |

Secrets are mounted from Secret Manager at run time. They are never build
substitutions, which would put them in build logs and history.

## Deploying

```powershell
gcloud builds submit --config server/cloudbuild.yaml `
  --substitutions=_PUBLIC_BASE_URL=https://skellyspeak-api-ndkvvlbq4a-uc.a.run.app
```

Three things about that command are not obvious:

- **`.gcloudignore` is required.** The build context is the repository root, and
  `old/` is 17 GB of archived earlier versions. The ignore file narrows the
  upload to `server/` — nine files.
- **`dynamic_substitutions: true`** is set in `cloudbuild.yaml`. Substitutions
  inside other substitutions are expanded automatically only for trigger-based
  builds; a manual `gcloud builds submit` passes `${PROJECT_ID}` through with
  the braces intact and the build fails on an invalid image name.
- **`--allow-unauthenticated` does not work from Cloud Build.** Its service
  account cannot set IAM policy, so the deploy *warns* and reports success
  while leaving the service private. The binding is applied once, directly,
  and persists across deploys:

  ```powershell
  gcloud run services add-iam-policy-binding skellyspeak-api `
    --region=us-central1 --member=allUsers --role=roles/run.invoker
  ```

## Local development

```powershell
cd server
uv sync
uv run pytest          # 19 tests, all on the security-critical paths
```

`config.py` requires every setting and raises at import if one is missing. A
service that boots healthy and then fails auth for every request is far worse
to diagnose than one that refuses to boot.
