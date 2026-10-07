---
title: Troubleshooting
sidebar_position: 9
---

# Troubleshoot a problem

Start with the status beside the failed operation. Replies, transcription, reading help and assessments can fail independently. Expand the error details before retrying so you can identify which part failed.

## The app cannot start a conversation

1. Open **Settings → AI access**.
2. Check the selected route. Finish hosted sign-in, or verify the custom server address and session token.
3. Use the connection check. A reachable server and a usable model are separate requirements.
4. Inspect account allowance or usage when the error names a limit.
5. Return to the failed operation and use its retry action when offered.

For a custom server, include `/v1` in the address. HTTP is allowed only for loopback; a remote server needs HTTPS. Do not paste credentials into a bug report.

## The microphone is silent

Open the microphone selector and confirm that the intended device is connected. Run the microphone check, allow the operating system's microphone permission, and watch the level while speaking.

If the wrong device was selected, choose the correct one and check again. A working microphone level does not guarantee successful transcription; transcription also depends on the configured service.

In Practice Auto mode, check **Detect attempts** and the activity threshold. Listening with detection off does not create takes. Increase the end-of-attempt silence interval if natural pauses split your phrase.

## The transcript is wrong

In Chat, turn **Auto-send** off so you can correct the draft before sending. In Practice, compare the recognized transcript with the original target and replay your recording. A recognizer's mistake should not be treated as proof of a pronunciation mistake.

If the take contains silence or noise, resolve microphone capture first. If capture sounds correct but recognition fails, inspect the attempt's diagnostic details and retry only the failed operation where offered.

## A reply arrived but help or points are missing

Look for a pending or failed status beside reading help or assessment. These operations can finish after the partner's text appears. Open **More → AI activity** to inspect requests and their results.

Use a specific retry action if available. Repeatedly sending the same message creates additional conversation work and is not a substitute for retrying an assessment. Missing evidence is not a zero score.

## I cannot hear playback

Check system volume and **Settings → Audio & Voice**: Overall volume and Voice volume both affect speech. A reference may also require working speech access.

Bring SkellySpeak to the foreground and press Play again. The app stops playback when it becomes inactive and does not automatically resume it. Playback may also be held during recording or transcription.

## The workspace will not open

Read the startup error. If offered, use **Save a copy of my data** before making changes. A newer workspace format can require a newer app. Do not use a factory reset as a routine repair: it permanently deletes local history and progress.

## Report a reproducible problem

Use **More** to access logs, and **AI activity** for a failed model request. Include the app version from **Settings → Updates**, your operating system, the action you took and what happened. Inspect any exported material before sharing it; a workspace copy contains your private learning data.

Report issues through the [SkellySpeak issue tracker](https://github.com/freemocap/skellyspeak/issues). Never include API keys or server session tokens. A concise error summary plus the relevant diagnostic identifiers is more useful than a screenshot with no steps to reproduce.
