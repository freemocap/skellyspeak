# Android recording white-screen investigation

Status: observed device failure; underlying trigger unresolved. No application
behavior changes or device configuration changes made.

## Observations

Read Android system logs over USB from the attached Pixel 9 Pro XL. Installed
SkellySpeak is 2.0.4 (versionCode 2000004); Android reports version 17. The active
WebView is `app.vanadium.webview` 153.0.8010.47.0.

On September 19 at 17:39:04.032 (device log time), SkellySpeak process 8717
reported a failed Vulkan QueueSubmit with error -4. Khronos defines -4 as
`VK_ERROR_DEVICE_LOST`:
https://docs.vulkan.org/spec/latest/chapters/fundamentals.html

The same process then reported abandoned graphics context, inability to initialize
a drawing surface, and repeated Skia context loss. Between 17:39:04 and 17:39:13,
the captured Chromium records contain 102 failed Vulkan submissions, 101 context
loss reports, and 712 attempts to use missing image mailboxes. These counts exclude
duplicate RustStdoutStderr copies.

Android explicitly associates PID 8717 with `com.freemocap.skellyspeak`. At
17:39:13.033, ActivityManager killed it because its task was removed. Historical
exit info confirms USER REQUESTED / REMOVE TASK, not an out-of-memory kill or an
application crash for this incident.

## Interpretation and limits

The graphics context loss and repeated drawing failures are consistent with the
reported white flashing during recording. They establish a rendering failure,
but do not establish what initially caused the GPU device loss. The recording
waveform uses a continuously repainted Canvas2D surface; it is a candidate for
controlled reproduction, not a confirmed cause. No speculative rendering fix
was applied.

The installed release is not debuggable, so `adb run-as` cannot read its private
durable diagnostic files. System logs were accessible and sufficient to identify
this rendering failure. Full system log output remains outside the repository
because it also contains unrelated application information.

## Follow-up verification

Reproduce recording on the same phone with live app-scoped graphics logs and
compare waveform enabled/disabled before selecting a mitigation. Verify sustained
recording, stop/transcription and playback, not just successful app startup.
An in-app share-sheet export remains useful future work; it was not implemented
in this investigation. An app diagnostic bundle should distinguish its durable
content-free logs from Android graphics/system diagnostics it cannot capture.
