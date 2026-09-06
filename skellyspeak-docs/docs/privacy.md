---
sidebar_position: 20
title: Privacy Policy
---

# Privacy Policy

**Effective 5 September 2026.** SkellySpeak is made by the FreeMoCap
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

Everything in the rest of this policy applies **only** to the free hosted
service. Starting sign-in also creates short-lived authorization records, even if you do not finish signing in.

We do not sell your data, we do not share it for advertising, and there are no
analytics or tracking SDKs in the app.

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
