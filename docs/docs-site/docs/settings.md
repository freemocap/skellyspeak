---
title: Settings and your data
sidebar_position: 8
---

# Adjust the app

Open **Settings** in the top bar, or **More → Settings** on a narrow screen. Use search to find a control, including controls inside folded sections. Ordinary preference changes save automatically; check the save status before assuming an edit succeeded.

## Languages

**Languages** separates the language you are learning, its variety, the language used for explanations and the interface language. Use the top-bar language picker for routine switching. **More → Browse languages** opens the language browser.

In **More → Browse languages**, select a language to inspect it. Use **Script size** to adjust that language independently of your general reading size; the examples preview the result. **Default** removes your override. Browsing a language does not itself switch your conversation.

Changing the explanation language does not transfer your progress to a different learning language. Each learning language keeps its own evidence and totals.

## Reading and appearance

Use **Reading & display** for text size, spacing and reading aids. Translation shows meaning, romanization represents text in another writing system, and pronunciation provides an approximate sound guide. These settings serve different purposes and can be adjusted independently where offered.

Use **Appearance** for colors, surfaces, spacing and depth. Theme and palette controls also appear in the top bar when there is room. Reading size controls the learning text; it is separate from general interface spacing.

## Audio & Voice

Choose the microphone and run its check before recording. Adjust **Overall volume**, **Voice volume** and **Sound effects volume** to balance speech and feedback sounds.

**Read aloud** controls automatic speech playback. **Auto-send** controls whether a completed chat transcript sends immediately or remains an editable draft. Reward sounds can follow speech playback preferences or be turned on or off separately.

The app stops audio when it becomes inactive. Returning to it enables new playback but does not automatically resume the cancelled audio.

## AI access and models

**AI access** offers the hosted service and a custom self-hosted SkellySpeak server. Hosted sign-in shows account usage when available. For a custom server, use its server address including `/v1`, and its session token if required. Remote addresses require HTTPS; loopback servers can use HTTP.

**Models** contains model choices supported by your connection. Changing a setting does not guarantee that a server or model is available; use the connection check and inspect errors when requests fail. See [Troubleshooting](./troubleshooting).

## Keyboard shortcuts

Open **Shortcuts**, select a shortcut field and press the combination you want. Pressing **Escape** while recording a shortcut restores its default. Message drafts also support Enter to send and Shift+Enter for a new line.

## Save a copy of your data

Open **Your data → Save a copy of my data**. The app copies the database, its supporting files and editable configuration to a folder in Downloads, then displays the saved location.

Keep that location if you need a copy before troubleshooting or resetting. This action creates a workspace copy; it is not cloud sync or a promise that all separately stored recordings and credentials are included.

Practice recording audio has its own [Recording storage](./practice#keep-recordings-within-a-storage-limit) limit. Synthesized audio and other reusable inference results use the cache controls in Settings.

## Delete local data

Use **Delete my data and close** only when you intend to reset this device. The confirmation describes the data being removed and requires typing **DELETE**. The app closes; reopen it to complete the reset.

This removes local conversations, coach memory, skill evidence and progress, settings, credentials and other app-owned data. It does not delete your hosted account, server billing or usage records, or exports outside app storage. Save a copy first if you need to retain your conversations and progress. See [Privacy](./privacy) for hosted-account requests.
