---
sidebar_position: 20
title: Privacy Policy
---

# Privacy Policy

**Effective 8 September 2026.** SkellySpeak is made by the FreeMoCap
Foundation. This policy describes what the app and its optional hosted service
collect, and what they do not.

## Where requests go

Your conversations, practice cards, learner evidence and preferences are kept on
this device. Generating replies, feedback, reading aids, transcription and cloud
speech sends the relevant content through the AI connection you select.

| Connection | Where requests go |
| --- | --- |
| Hosted service | The SkellySpeak service and its configured AI providers. Hosted sign-in and operational records are described below. |
| Custom server | The self-hosted SkellySpeak server you configure, and the providers chosen by that server's operator. Its operator is responsible for its storage and retention policies. |

The current app's custom connection is a SkellySpeak server address, not a direct
connection to an arbitrary model endpoint. Using a custom server does not by
itself mean all processing stays on your device.

The hosted-service sections below apply to the FreeMoCap hosted service.
Starting sign-in creates short-lived authorization records even if you do not
finish signing in. We do not sell your data or share it for advertising, and
there are no analytics or tracking SDKs in the app.

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

You can choose a custom SkellySpeak server in Settings. Check with its operator about the services it uses and the data it retains.

## How long it is kept

- **Usage, completed reservations and installation records:** eligible for automatic deletion after 90 days. Deletion is asynchronous.
- **Unresolved billing reservations:** kept until investigated and reconciled, then eligible for deletion after 90 days.
- **Sign-in records:** invalid within minutes and eligible for automatic deletion after one day. Eligibility is not an exact deletion deadline.
- **Hosting logs:** retained under the Google Cloud project's logging retention settings.
- **Your account record** is kept until you ask us to delete it.

## Your choices

**Stop sending us anything** — open Settings, change AI access away from the hosted service, or sign out. Signing out removes the session from your
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


## Local learning records

The app keeps a local workspace database for conversations, partners, coach
exchanges, practice cards and attempts, learner evidence, earned credit and
preferences. Recording audio and reusable speech or reading results also use
local storage. There is no automatic cross-device workspace synchronization.

AI operations send the content needed for that operation through the configured
connection. This can include conversation context, the message being assessed,
language and variety, selected practice preferences, or text needing translation
or word annotations. Speech recognition sends the recorded audio. Reading aids
may prepare missing annotations when a reading surface appears; revealing an
already saved word meaning does not require another request.

Skill evidence retains source text, assessment explanations, assistance
information and provenance so you can inspect where progress came from. Changing
or deleting source history is not the same as deleting all earned activity
records. The app labels retained credit whose source is no longer available.

## Diagnostics and exported files

Operational diagnostics retain request identifiers, operation status, timing,
models, usage and redacted error details. Current diagnostic handling removes
credentials and content such as prompts, transcripts, message text and raw audio
from diagnostic records. These diagnostic records are separate from the learning
records that intentionally retain your conversations and assessment evidence.

Use **More → AI activity** to inspect AI work and the log-sharing control in
**More** to prepare diagnostics. Inspect material before sharing it. A workspace
copy is private learning data, not a redacted bug report.

**Settings → Your data → Save a copy of my data** copies the database, its
supporting files and editable configuration to Downloads and displays the path.
Files copied outside application storage remain under your control.

## Recording retention

Practice's **Recording storage** setting limits retained recording audio. The
oldest recordings are removed first; a zero limit keeps no recording audio.
Transcripts and comparisons remain. Reusable synthesized audio uses the shared
cache controls in Settings.

## Erasing local data

**Settings → Your data → Delete my data and close** requires typing `DELETE`.
The app closes; reopen it to complete the reset. This removes local conversations,
coach memory, evidence and progress, preferences, credentials and other app-owned
data, including local migration recovery copies.

A local reset does not delete the hosted account, server billing or usage records,
or files exported outside app storage. Use the contact instructions above for
hosted-account data requests.
