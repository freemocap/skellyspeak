---
sidebar_position: 20
title: Privacy Policy
---

# Privacy Policy

**Effective 8 September 2026.** SkellySpeak is made by the FreeMoCap
Foundation. This policy describes what the app and its optional hosted service
collect, and what they do not.

## The short version

SkellySpeak can reach an AI provider three different ways, and **only one of
them sends anything to us at all**:

| How you use it | What reaches FreeMoCap |
|---|---|
| **Your own API key** (OpenRouter) | Nothing. The app talks to OpenRouter directly. |
| **Your own AI server** (Ollama, LM Studio) | Chat goes to the server you choose; speech can still use external providers. |
| **The free hosted service** | Your Google identity, request content in transit, and the operational records described below. |

The hosted-service sections below apply **only** to the free hosted
service. The local-data sections apply to all provider modes. Starting sign-in also creates short-lived authorization records, even if you do not finish signing in.

We do not sell your data, we do not share it for advertising, and there are no
analytics or tracking SDKs in the app.

## Download website

The download page reads browser-provided operating-system and processor
information locally to recommend an installer. It does not save these selections
or send them to the SkellySpeak service. It requests public release metadata
from GitHub, and download links open GitHub-hosted release assets. These requests
send ordinary network metadata to GitHub, including your IP address.

## What the hosted service stores

The application stores the following records; hosting infrastructure also produces operational logs.

**Your account**, from signing in with Google:

- Your Google account identifier
- Your email address
- Your display name
- When you first signed in, and when you were last seen

**Your usage**, so we can operate a free service without an unbounded bill:

- Number of AI tokens used, per day
- Number of requests made, per day
- Daily auth-step and per-account admission counters for abuse prevention
- Cost and reserved allowance in micro-dollars
- Per-request reservation IDs, provider generation IDs, settlement status and timestamps

**Your installations**, so we know which platforms to keep supporting:

- A random identifier the app generates the first time it runs
- Your operating system (for example "windows", "android")
- The app version
- When that installation was first and last used

That random installation identifier is not a hardware identifier, not an
advertising identifier, and not tied to your device in any way we can reverse.
Reinstalling the app produces a new one.

## What the hosted service does *not* store

Stated explicitly, because these are the things people reasonably worry about:

- **No IP addresses in account or usage records.** Google Cloud operational request logs can contain network metadata, including IP addresses and request URLs.
- **No location or country.**
- **No device or machine names.**
- **No hardware or advertising identifiers.**
- **No conversation content.** What you say to the tutor and what it says back
  are passed through to the AI provider and are never written to our storage.
- **No Google credentials.** Sign-in requests online-only access, so Google
  never issues us a long-lived token for your account. We read your identifier
  and email once and discard the rest.

Google Cloud describes its [automatic request logging](https://docs.cloud.google.com/run/docs/logging). Firestore describes its [asynchronous TTL deletion](https://firebase.google.com/docs/firestore/ttl).

## Who else is involved

Using the hosted service means your conversation text and voice recordings are
sent onward to the companies that actually run the AI models. They receive that
content and handle it under their own policies:

- **Google** — sign-in, Google Cloud hosting, and Gemini model inference when selected through OpenRouter.
  [Privacy policy](https://policies.google.com/privacy)
- **OpenRouter and its model providers** — replies, language analysis and cloud speech generation.
  [Privacy policy](https://openrouter.ai/privacy)
- **Groq** — speech-to-text, if you use the microphone.
  [Privacy policy](https://groq.com/privacy-policy/)

If you would rather not involve us at all, use your own API key or your own AI
server. Both are in Settings and neither routes through FreeMoCap.

## How long it is kept

- **Usage, completed reservations and installation records:** eligible for automatic deletion after 90 days. Deletion is asynchronous.
- **Unresolved billing reservations:** kept until investigated and reconciled, then eligible for deletion after 90 days.
- **Sign-in records:** invalid within minutes and eligible for automatic deletion after one day. Eligibility is not an exact deletion deadline.
- **Hosting logs:** retained under the Google Cloud project's logging retention settings.
- **Your account record** is kept until you ask us to delete it.

## Your choices

**Stop sending us anything** — open Settings, change the AI provider away from
the hosted service, or sign out. Signing out removes the session from your
device immediately.

**Delete your data** — email [info@freemocap.org](mailto:info@freemocap.org) from the address you signed in
with, and we will delete your account record and everything associated with it.
Usage and installation records become eligible for automatic deletion after 90 days.

**See what we hold** — ask at the same address and we will send it to you.

## Children

SkellySpeak is not directed at children under 13, and we do not knowingly
collect information from them. If you believe a child has signed in, contact us
and we will delete the account.

## Changes

If this policy changes in a way that affects what we collect, we will update
the effective date above and note the change in the app's release notes.

## Contact

FreeMoCap Foundation — [info@freemocap.org](mailto:info@freemocap.org)

Source code: [github.com/freemocap/skellyspeak](https://github.com/freemocap/skellyspeak)

## Local lesson choices

Learning goals, explicit preferences and memory corrections are stored locally
per language pair, separately from inferred tutor memory. The app retains the
most recent 20 explicit changes with their timestamps and before/after values.
The current choices are included in relevant model requests through your chosen
provider route; they are not confined to the private coach thread. Conversation
partners do not receive the coach thread itself. Clearing current choices does
not remove their entries from the local change history.

## Local conversation partners

Each chat stores a copy of its persona template and its first partner reply in
`partner.json`, alongside its transcript. That reply remains an identity reference
in future reply prompts, including after it falls outside recent conversation
history. These prompts follow the same selected provider route as other chat
requests. Existing chats without a snapshot recover their earliest assistant
reply locally; this does not add a model call.

## Local AI diagnostic traces

The app automatically retains model-call traces locally in `ai-traces.json`, up
to 300 runs and 8 MiB. They can contain conversation messages, responses, persona
snapshots, lesson choices and inferred learner notes, as well as model parameters
and timing. Text capture is bounded and truncation is marked. Request headers,
credentials and raw audio are not recorded by this trace archive. These traces
are not anonymized and are not automatically uploaded.

Older records are evicted at the retention limits. **AI → Debug → Clear retained
traces** clears this archive. Deleting a chat does not delete its diagnostic
traces. **Export selected** creates a separate JSON file in the app configuration
directory's `trace-exports` folder and displays its path. Exports remain until
you delete those files yourself, including after clearing retained traces.

Visible lesson topics can request a short generated explanation and example.
These calls send the topic, language and selected practice difficulty through
the configured provider. They do not send conversation history or update learner
memory; their requests and outputs follow local AI trace retention.

## Skill assessment evidence

After each new learner message receives a reply, a separate worker-model request
assesses the message against the shared skill rubrics. It sends the message,
recent preceding conversation context, partner reply, target/native language and
recorded input provenance (text or speech transcript; suggestion, scaffold and
revision flags) through the configured provider route. It does not send raw audio
for this assessment. Assistance outside the app is unknown.

`skill-evidence.json` inside each chat stores source text, quoted spans, outcomes,
rationales, assistance flags, model/prompt/catalog versions, timestamps and
trace/message/attempt identifiers. These records use one local learner identity
and are aggregated by target language across native-language contexts. Rust derives practice XP and marks from live current-catalog evidence; these are
not certificates or inferred mastery.

The active tree excludes superseded records and messages absent or changed in
the saved conversation. Soft-deleted chats are excluded; their raw evidence files
remain alongside the retained conversation. Records are retained with that chat;
clearing diagnostic traces does not clear this separate evidence ledger. The
assessment requests also follow ordinary diagnostic-trace retention. Historical
conversations are not automatically sent for assessment.

The target-language profile stores pinned focus and excluded attempt identifiers
at `learners/local/<target>.json`. It is local and distinct from provider login
and partner persona. Saved/recommended focus and its criterion are included in
subsequent practice prompts. Excluding an attempt affects progress but retains
its source and model judgment; removing its exclusion restores eligible credit.
Previous catalog records are retained for inspection without awarding current
skills. Stories generation is retired; old browser story cache entries are left
untouched and are no longer read or sent by that feature.

### Erasing local data

Settings → **Clear all data…** requires typing `DELETE`. The app closes and
finishes erasing its local data on the next launch, including credentials,
conversations, lesson memory, learner progress, traces, app-managed exports,
logs, caches and webview storage. This is irreversible. It signs out this device;
it does not delete the hosted account, server-side billing/usage records, or
exports copied outside application storage.

## Operational logging and device backups

Ordinary application logs record events, timings, counts and HTTP status codes;
they do not intentionally copy transcripts, prompts, model output, teaching-plan
text, account email or raw provider HTTP error bodies. The local AI trace archive
above remains a separate, content-bearing feature. Older log files are not
retroactively erased by an upgrade.

The hosted container disables Uvicorn access logs and HTTP-client informational
logging. Google Cloud request logs remain controlled by the project logging
configuration and may contain URLs and IP addresses; disable or exclude sensitive
auth request logs at the platform layer as well.

Android declares app backup disabled and excludes app data from cloud backup and
device transfer. This policy requires verification on supported physical devices.
Desktop debug builds use a separate application identity, storage and Keychain
entry; they do not import the installed release's private data.
