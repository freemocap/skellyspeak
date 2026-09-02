---
sidebar_position: 7
title: Hosted API
---

# Hosted API

`server/` is a FastAPI service on Cloud Run that lets someone use SkellySpeak
without holding any API keys of their own: they sign in with Google, and their
requests are proxied to OpenRouter and Groq through the project's accounts,
metered against a daily allowance.

It is one of three ways the app can reach an AI provider, and the **default on
a fresh install**. The choice lives in Settings and is resolved in exactly one
place, `Settings::chat_provider` in `src-tauri/src/settings.rs`, with
`stt_endpoint` and `tts_endpoint` beside it for voice.

| Mode | Endpoint | Credentials | Who pays |
|---|---|---|---|
| `hosted` | this service | a session token | the project |
| `cloud` | OpenRouter | the user's own key | the user |
| `custom` | any OpenAI-compatible server | optional, theirs | nobody — it is their machine |

Hosted mode covers **all three** AI paths — chat, speech-to-text and spoken
replies. Anything less would ship a mode whose microphone and speaker are
visibly broken, since a hosted user holds no Groq or OpenRouter key.

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
The app opens the real browser through `tauri-plugin-opener` and waits.

Coming back in works differently per platform, because the two share nothing.
Desktop binds a loopback listener on an ephemeral port *before* opening the
browser, so the port named in the redirect is provably its own; Android
receives a `skellyspeak://auth` deep link. Both live in `src-tauri/src/hosted.rs`.

The session token is stored in `settings.json` beside the API keys, but unlike
them it never round-trips through the webview: `Settings::masked` blanks it
outright, and `save_settings` always carries the stored one forward whatever
the UI sends. `hosted_sign_out` is the only thing that clears it.

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

Three ceilings. Two count tokens, in Firestore, keyed by UTC date:

- **Per user per day** — what one person can spend.
- **Globally per day** — what everyone together can spend. Per-user limits do
  nothing about a launch-day crowd, and that bill lands on the project.

The third counts *people*, and during closed testing it is the one that
matters. Nobody yet knows what a conversation really costs — a turn fires the
eight calls in `turn_plan.rs::TURN_STEPS` — so guessing a token allowance
tight enough to be safe would only produce a service too crippled to learn
anything from. Instead the allowance is generous and `MAX_USERS` is small:

- **Total accounts** — `MAX_USERS`, enforced in `quota.upsert_user` inside a
  Firestore transaction, because the check and the increment must be one step.
  A counter document holds the running total; counting the collection would be
  neither atomic nor free. Somebody who already has an account is never
  blocked by the ceiling and never counted twice, so lowering `MAX_USERS`
  locks out newcomers without evicting anyone. A refused sign-in returns 403
  with a message that points at the other two provider modes.

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

## What is stored about a person

The complete list. It is short deliberately, and each line below is enforced by
a test in `server/test_quota.py` that enumerates the stored fields — growing
this set is a privacy decision and a Play Store Data Safety change, not a
detail to adjust in passing. The user-facing version is the
[Privacy Policy](./privacy.md).

| Collection | Fields |
|---|---|
| `users/{id}` | Google subject id, email, display name, first and last seen |
| `users/{id}/usage/{date}` | tokens, request count |
| `users/{id}/devices/{install_id}` | platform, app version, first and last seen |
| `global_usage/{date}` | tokens, request count |

**Not stored, anywhere:** IP addresses, location or country, device or machine
names, hardware or advertising identifiers, and the content of any
conversation. Prompts and replies pass through the proxy and are never written
down.

**No Google credentials are held.** The OAuth request asks for
`access_type=online`, so Google never issues a refresh token; the ID token is
verified, read for the subject and email, and dropped. The only long-lived
credential in existence is the session token this service signs itself, and
rotating `jwt-signing-key` invalidates every one of them at once.

The `install_id` is a random UUID the app generates on first run and keeps in
its own settings file. It is not a hardware or advertising id and a reinstall
produces a new one. It answers how many machines someone uses, which operating
systems to keep supporting, and which app versions are still in the wild —
which is what actually decides where effort goes.

### Retention

Firestore deletes this itself, driven by TTL policies on a `ttl` timestamp
field. They are set once per collection and are not part of a deploy:

```powershell
gcloud firestore fields ttls update ttl --collection-group=usage --enable-ttl
gcloud firestore fields ttls update ttl --collection-group=devices --enable-ttl
gcloud firestore fields ttls update ttl --collection-group=global_usage --enable-ttl
gcloud firestore fields ttls update ttl --collection-group=auth_states --enable-ttl
gcloud firestore fields ttls update ttl --collection-group=login_codes --enable-ttl
```

Usage and device records live 90 days (`quota.USAGE_RETENTION_DAYS`) — long
enough to compare one month against another, short enough that we are not the
custodian of an indefinite record of when somebody practises a language.
`auth_states` and `login_codes` live 24 hours; both are logically dead after
two minutes, but abandoned sign-ins are never read again and would otherwise
accumulate forever.

## Turning the dials

Everything meant to change once testing ends is a value, not a code change.

| Dial | Env var | Closed-testing value |
|---|---|---|
| Per-user daily tokens | `FREE_DAILY_TOKENS` | 500,000 |
| Global daily tokens | `GLOBAL_DAILY_TOKENS` | 3,000,000 |
| Maximum accounts | `MAX_USERS` | 6 |

They live in `server/cloudbuild.yaml`, but changing them needs no rebuild:

```powershell
gcloud run services update skellyspeak-api --region=us-central1 `
  --update-env-vars=MAX_USERS=25,FREE_DAILY_TOKENS=250000
```

**Mirror the new value back into `cloudbuild.yaml` afterwards, or the next
deploy silently reverts it.**

Both meters needed to set the real numbers already exist: `GET /v1/me` reports
`used_today` per account, Firestore holds the daily totals under
`users/{id}/usage/{date}` and `global_usage/{date}`, and the app's own run
tracing records per-call token usage locally. After real use those give tokens
per turn and cost per active user.

The consent screen is the other half of the gate: an OAuth client in
**Testing** admits only listed addresses, while one published to **Production**
admits anyone — at which point `MAX_USERS` is the only limit, which is why the
service must be deployed with it *before* the screen is published. Publishing
needs no Google verification review, because the only scopes requested are
`openid email profile`, all non-sensitive — but uploading an app logo does
trigger review, so the logo field is deliberately left empty.

## Local development

```powershell
cd server
uv sync
uv run pytest          # 39 tests, on the security-critical paths
```

`config.py` requires every setting and raises at import if one is missing. A
service that boots healthy and then fails auth for every request is far worse
to diagnose than one that refuses to boot.
