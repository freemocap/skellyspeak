# Android recording white-screen investigation

Initial investigation: observed device failure; underlying trigger unresolved.
The implementation follow-up below records the subsequently authorized mitigation,
log sharing and device verification.

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

## Implementation follow-up

Implemented after the user's explicit request to fix rendering and add sharing:

- Android MainActivity now opts out of hardware acceleration. This bypasses the
  observed WebView Vulkan drawing failure through Android's supported software
  rendering mode. It is a compatibility mitigation, not proof of the original
  driver/WebView trigger. It can increase CPU drawing cost; desktop/iOS rendering
  is unchanged. Android reference:
  https://developer.android.com/topic/performance/hardware-accel
- Waveform rendering reduces dense sample history to ordered minima/maxima per
  horizontal pixel, preserving brief peaks while bounding drawn geometry. Native
  recording, audio encoding, transcription and stored samples are unchanged.
- Android More, fault bar and render-crash view expose **Share logs**. A native
  worker streams all retained native/frontend JSONL logs and native manifests into
  a unique cached ZIP. Android ACTION_SEND / FileProvider opens the system chooser
  with temporary read permission; opening the chooser does not mean anything was
  sent. No automatic message sending occurs.
- The ZIP manifest includes app/OS/device/WebView versions and an explicitly
  bounded, app-UID-only logcat scan. Only fixed graphics error codes and numeric
  process IDs/timestamps survive the scan. Raw system logs are never exported.
  Unavailable system logs are explicitly marked. Structured logs retain their
  existing redacted metadata. The database, credentials and audio are excluded.
  Archives include previous runs; active files are size snapshots and the manifest
  notes that the last record may be incomplete if a write races with export.
- Export checks the exact native Android log root, rejects symlink entries, and
  refuses missing/unreadable diagnostic logs. Failures retain a fixed stage code.
- Fixed the existing desktop-only import of Tauri Emitter, which prevented the
  current application from compiling for Android.

Sharing currently targets Android; this change does not implement iOS sharing.
The cached ZIP remains available for the receiving app and is subject to Android
cache eviction. Source diagnostic logs are not deleted by sharing.

### Verification

- 819 frontend tests passed; style checks passed; frontend production build passed.
- 14 native diagnostic tests passed; desktop Clippy passed with warnings denied;
  generated contract check passed.
- Android ARM64 debug APK/AAB build passed. Android archive unit tests verify
  previous-run inclusion, metadata preservation, private-file exclusion, symlink
  refusal and graphics-code filtering.
- Installed an isolated debug package `com.freemocap.skellyspeak.diagnostics`,
  labeled **SkellySpeak Diagnostics**, on the attached Pixel. A temporary Gradle
  init script changes only this test package/label; the existing release and its
  data remain intact. The test build's Android package version is 1.0; the native
  source version is 2.0.5.
- Pressed the actual More → Share logs button and observed Android's native file
  chooser. Inspected the resulting ZIP: six log files from two app runs plus the
  manifest; no database/audio. System graphics scan reported captured, zero errors.
- The first device share test caught an incorrect files-directory assumption;
  fixed the check to match Tauri's actual app-data/logs directory and repeated
  the device test successfully.

- Sustained device recording test: approximately 67.7 seconds, 2,941 animation
  frames observed, active nonblank waveform canvas, zero visible error alerts,
  and zero Vulkan/context-loss/surface-initialization/fatal errors in app logcat.
  Used a synthetic WebAudio oscillator through the actual MediaRecorder,
  analyser, native recording admission and waveform path. Discard removed the
  waveform and released capture. No microphone audio or provider requests were
  used. This verifies the rendering/capture path, not physical microphone quality,
  transcription, or proof against every possible future graphics failure.
- No release or production deployment occurred during implementation or verification.
