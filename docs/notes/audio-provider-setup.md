# Audio provider credentials and rollout

Status, September 18, 2026: **ElevenLabs is connected to the local/hosted server
routes in source and tested. GCP has not been deployed.** The native client uses
`/v1/audio/speech` for Hosted and Custom URL read-aloud; transcription uses
`/v1/audio/transcriptions`. Direct API-key access still uses Groq/OpenRouter.

Local configuration now includes the supplied key, `STT_PROVIDER=elevenlabs`, and
the available George voice ID `JBFqnCBsd6RMkjVDRZzb`. The voice is a service-wide
profile for this checkpoint, independent of existing OpenAI persona voice names.
The user reported successful GCP Secret Accessor setup. No cloud changes were made
by the agent. Azure and direct user-owned ElevenLabs credential controls are pending.

A real synthetic Malayalam test through authenticated local server routes passed
TTS and STT, preserving Malayalam script and a word timestamp. This is integration
verification, not a language-quality evaluation. No user recording was uploaded.

## 1. Obtain ElevenLabs keys

1. Sign in to [ElevenLabs](https://elevenlabs.io/). Open the developer/API-key
   area of your workspace. The official [quickstart](https://elevenlabs.io/docs/eleven-api/quickstart)
   links directly to the key dashboard if its navigation has moved.
2. Create a key named `SkellySpeak local`. Grant **Text to Speech** and **Speech
   to Text** access. Add **Voices: Read** and **Models: Read** if you want the
   forthcoming configuration checks/listing to use this key. Voice creation,
   cloning, deletion and workspace administration are not needed.
3. Set a credit limit appropriate for your development budget. Copy the secret
   into your password manager when it is shown. Do not paste it into this task,
   an issue, a committed file or a screenshot.
4. Create a second key named `SkellySpeak hosted`, with the same required
   permissions and a separate credit limit. This lets you rotate or revoke local
   access independently of the shared hosted service.

The permissions and credit limits are ElevenLabs controls, separate from the
app's hosted allowance. See [API authentication](https://elevenlabs.io/docs/api-reference/authentication)
and [workspace API keys](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys).
[@elevenlabs_auth_20260917]

## 2. Choose a voice

In ElevenLabs, open the voice library/My Voices, select a voice available to your
workspace, and copy its **voice ID** from the voice's details/menu. Save the ID
alongside your local setup notes. A display name and an OpenAI voice name such as
`alloy` are not ElevenLabs voice IDs. A voice ID is configuration, not a secret.

The intended initial models are `scribe_v2` for transcription and `eleven_v3` for
synthesis. Model and language support do not certify a voice's accent quality.
The adapter sends source text directly and asks for PCM at 24 kHz, then packages
it as a mono WAV internally. It does not ask a conversational model to read a
prompt. See the [TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
[@elevenlabs_tts_20260917]

## 3. Local placement

The local server's private environment file is:

```text
/Users/jon/code_stuff/github/freemocap/other/skellyspeak/server/.env
```

It is Git-ignored. Edit the existing file rather than copying the sample over it;
retain the current provider keys. You may store this additional line there now:

```dotenv
ELEVENLABS_API_KEY=your_local_key_here
```

The active additional nonsecret settings are:

```dotenv
STT_PROVIDER=elevenlabs
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
```

The model bindings are `scribe_v2` and `eleven_v3`. Missing/invalid configuration
fails explicitly; the service never falls back to another provider. Keep the
existing OpenRouter and Groq entries. `--check` now validates the ElevenLabs key
format and voice setting; it does not make a paid call or validate cloud IAM.

Use a text editor to enter the secret so it does not enter shell history. Keep
file access limited to your account:

```sh
chmod 600 server/.env
```

From the repository root:

```sh
npm run server:local -- --check
npm run server:local
```

The first command validates configuration without inference; it is not a billing
or selected-model availability test. Stop the old server before starting the new
one. Normal restarts preserve `server/.local-server/session-token.txt`.

For the app's **Custom URL** access, the endpoint remains
`http://127.0.0.1:8765/v1`, and the bearer token remains the contents of that session
token file. The ElevenLabs key belongs to the server. Chat, STT and TTS share
the one route selected in **AI access**. Select Custom URL there. In **Models**, set:

| Setting | Local value |
| --- | --- |
| Transcription model | `scribe_v2` |
| Read-aloud model | `eleven_v3` |

Schema v20 removes per-capability routes; older development workspaces require
Factory Reset. Fresh workspaces use these
model IDs with Hosted access. Restart/rebuild the native app to load its new audio
transport, and restart the local server. The app's usual development launcher is
`npm run macos:dev` on macOS from the repository root; restarting only the browser UI cannot
load Rust changes. Until GCP is deployed, select Custom URL in AI access.

Direct user-owned ElevenLabs credentials will use native credential storage when
that profile is implemented. There is no ElevenLabs-specific key field in this
checkpoint, and no key belongs in a frontend `VITE_*` variable.

## 4. GCP: create the hosted secret

Repository deployment configuration currently specifies:

| Item | Value |
| --- | --- |
| Project | `skellyspeak-api` |
| Cloud Run service | `skellyspeak-api` |
| Region | `us-central1` |
| Runtime identity | `skellyspeak-run@skellyspeak-api.iam.gserviceaccount.com` |
| Build identity | `skellyspeak-build@skellyspeak-api.iam.gserviceaccount.com` |
| Proposed secret name | `elevenlabs-api-key` |
| Proposed runtime variable | `ELEVENLABS_API_KEY` |

These names were read from source, not verified against the live project.

In Google Cloud Console:

1. Select project **skellyspeak-api** and open **Security → Secret Manager**.
2. Choose **Create secret**, name it `elevenlabs-api-key`, and paste the
   **SkellySpeak hosted** key as the secret value. Use the project's normal
   replication policy. Create the secret and note the numeric version (normally
   `1` for a new secret).
3. Open that secret's **Permissions** and grant
   `skellyspeak-run@skellyspeak-api.iam.gserviceaccount.com` the
   **Secret Manager Secret Accessor** role on this secret. Grant this to the
   runtime account, not just the build account. The runtime needs to read it when
   an instance starts.

Creating the secret does not attach it to Cloud Run or change traffic. You need
an account authorized to create secrets and manage their IAM policy. See
[creating a secret](https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
and [Cloud Run secret access](https://docs.cloud.google.com/run/docs/configuring/services/secrets).
[@gcp_audio_secrets_20260917]

The equivalent IAM command, after you create the secret, is:

```sh
gcloud secrets add-iam-policy-binding elevenlabs-api-key \
  --project=skellyspeak-api \
  --member=serviceAccount:skellyspeak-run@skellyspeak-api.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

No Google service-account JSON key needs to be downloaded. The existing release
workflow authenticates with Workload Identity Federation.

## 5. GCP: attach and roll out only after integration

**Source configuration is ready; deployment still requires authorization.**
`server/app/config.py` reads the key and voice ID, and
`server/deployment/cloudbuild.yaml` now includes:

```text
ELEVENLABS_API_KEY=elevenlabs-api-key:${_ELEVENLABS_SECRET_VERSION}
STT_PROVIDER=elevenlabs
ELEVENLABS_VOICE_ID=${_ELEVENLABS_VOICE_ID}
```

The substitutions default to secret version `1` and George's voice ID above.
Confirm that enabled secret version `1` contains the intended hosted key before
deployment; override `_ELEVENLABS_SECRET_VERSION` if yours differs. These are
Cloud Build substitutions, not additional secrets. All existing secret mappings
are retained. Console-only environment changes can be overwritten by a later
build because deployment sets the full environment/secret mappings.

For reference, the Cloud Run Console operation is **Cloud Run → skellyspeak-api →
Edit & deploy new revision → Variables & Secrets → Reference a secret**. Set the
environment-variable name, select the secret and its version. Saving deploys a
revision; it is not merely editing an inert settings file. Prefer the repository's
candidate deployment workflow, which creates a revision without traffic, checks
it, and then promotes that exact revision.

This repository's **Deploy server** GitHub workflow runs automatically when server
changes are pushed to `main`; manual dispatch also deploys. Wait for explicit
deployment authorization and completed integration tests. Do not push this
checkpoint to `main` just to save it remotely. Local commits do not deploy.

After an authorized rollout, check authenticated service diagnostics and run one
explicit STT request and one TTS request. Those two calls can incur charges. A
green `/health` response alone does not verify ElevenLabs access.

## 6. Rotating the key later

Create a replacement ElevenLabs key with the required permissions. In Secret
Manager, open `elevenlabs-api-key` and **Add new version** with that key. Record
the new version number, update the deployment mapping, and deploy a new revision
through the same gate. Confirm audio works, then revoke the old ElevenLabs key.
Adding a secret version does not update an existing process's environment. A
pinned version also does not follow `latest`. [@gcp_audio_secrets_20260917]

For local rotation, replace the value in `server/.env` and restart the server.
The app's local session token does not need changing when an upstream key changes.
