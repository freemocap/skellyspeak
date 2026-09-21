# Phone speech, gloss placement and error explanations

Status: separate development identity retired; current source installed as normal-package SkellySpeak. No hosted deployment.

## Observations

The connected Pixel 9 Pro XL was running the release package, version 2.1.1.
Tapping a saved Arabic word reproduced the reported tiny gloss card near the
language selector, far above its source word. Screenshots remain in `/tmp`, not
in public repository documentation. The release package is not debuggable;
`run-as` cannot read its private operation database or diagnostic files. Its
available process logcat did not identify the original speech failure. No claim
is made that a microphone permission or provider outage caused it.

Source inspection found that `read_speech_audio` returned only a terminal reason
such as `failed`. The UI converted this into “Speech unavailable: failed”.
Pre-dispatch speech failure storage discarded the AppError code and metadata.
Other common losses were stringifying objects, retaining only `.message`, hiding
the explanation inside collapsed error cards, and replacing log-sharing and
word-meaning retry failures with generic text. Grouped server rejections omitted
the authored HTTP rejection detail from their diagnostic envelope.

## Implemented

- Speech unavailability carries its explanation, attempt identity and retained
  provider metadata. Pre-attempt failures preserve the structured AppError and
  are not attributed to a previous attempt. Cancelled/expired/unknown outcomes
  have distinct explanations. Reading audio never automatically retries.
- Speech publication validation retains its own diagnostic stage alongside the
  provider receipt. Native transport diagnostics retain bounded, scrubbed cause
  chains, and Android log-sharing errors expose the failing stage.
- The shared frontend error formatter preserves codes, refusal information,
  request/model identifiers and nested provider explanations. Sensitive fields
  remain redacted. Shared error cards show the reason before expansion;
  structured details remain expandable. Settings, model selection, languages,
  skills, progress, reset, word-help retry and log sharing use that formatter.
  This is a repair of identified shared paths, not a claim that every possible
  exception has a known cause. An error without an explanation is identified as
  such rather than converted to `[object Object]`.
- Grouped HTTP rejections retain their explanation with request echoes removed.
  Existing unknown server exception handling retains exception types and source
  locations without exposing arbitrary exception prose or locals.
- Touch word help uses a portal outside the scrolling text container, remaining
  within an enclosing modal when applicable. Desktop help retains native popovers.
  Placement is bounded to the visual viewport and reacts to resize/scroll;
  script/reading scale follows the source. Touch gloss typography uses larger
  existing text roles. Source-to-card `aria-controls` preserves exact occurrence
  ownership for accessibility and device-test assertions.

## Verification

- Full UI suite: 1,017 tests passed.
- UI production build and localization checks passed (existing bundle-size warning).
- Style validation, design-system regeneration/check and preview TypeScript checks passed.
- Android runner TypeScript/unit checks passed.
- Native Android ARM64 `cargo check --lib --target aarch64-linux-android` passed with Cargo-cache write access.
- Native speech filter: 36 tests passed with loopback HTTP fixture access.
- Native diagnostics filter: 17 tests passed.
- After final speech changes, all 15 speech execution tests passed again.
- Native Clippy for library/tests passed; generated contracts checked against Rust.
- Server grouped execution and provider-diagnostic suites: 22 tests passed.

Native verification used `/tmp/skellyspeak-phone-fix` with the current native
source/content and the **committed bibliography**. The working tree already
contained unrelated benchmark/research edits; `typesafeNoul2026` has an invalid
`review` value which currently prevents normal registry loading and contract
export. Those edits were preserved. Contracts were exported by Rust from the
temporary copy; only the expected speech-state contract changed.

## Pending device evidence

The phone locked during verification. An offline production-component preview
was served on port 1431 and USB reverse forwarding configured, but no successful
post-fix device screenshot was obtained. Unlocking is required to finish that
check and inspect the installed release's in-app speech diagnostics. The release
app and hosted service have not been updated. No commit, tag, push or deployment
was performed.

## Morning device and service inspection

Observed on September 21: the USB-connected release app still runs 2.1.1,
installed September 20 at 22:28. Its AI activity view exposes a failed persona
speech operation at 07:31 with HTTP 400 / INVALID_REQUEST. Read-only Cloud Run
log inspection confirms the matching `/v1/audio/speech` rejection at 11:31 UTC,
and three rejections with the same code at 02:28–02:31 UTC (the previous evening
in the user's timezone). This establishes the same error category, not the same
underlying validation failure.

The phone retains `detail: "[redacted: unstructured service detail]"` and null
diagnostics; the service logs also lack the validation reason. The unchanged
`native/src/ai/hosted/mod.rs` sanitizer removes the detail field, and the speech
endpoint still uses generic HTTPException rejections for several validation
failures. The current changes do not establish a fix for this HTTP 400 failure.
Shipping the app changes would deliver the error-display and gloss-layout work,
but speech root-cause diagnosis and the remaining error-information gap are
unresolved. Server changes require service deployment separately from installing
an app release. Post-fix device verification remains pending.

The bibliography review field mentioned above has since been corrected by other
working-tree changes. Earlier test results cover the earlier source snapshot;
the combined current working tree has not been reverified in this inspection.
No app installation, commit, tag, push or deployment was performed.

## Separate development installation in progress

The user requested a source-built app alongside the official release so they
can reproduce failures with improved diagnostics. The repository already supports
`SKELLYSPEAK_ANDROID_DEV_APP=1` and `tauri.android-dev.conf.json`, producing
`com.freemocap.skellyspeak.dev` with launcher label `Dev-SkellySpeak` and separate
data. The attached phone already has an older 2.0.6 development installation.

The hosted error boundary now retains exact, reviewed, content-free speech
validation messages from the service in both the summary and structured details.
Unknown detail strings remain explicitly redacted. All 15 hosted tests pass,
including a loopback HTTP test covering request identity, retained rejection
reason and removal of private content. This improves the next reproduction;
it does not resolve or retrospectively recover the existing HTTP 400 cause.

The combined working-tree Android build failed localization checks in concurrent,
unfinished Jev assessment work. A focused temporary build snapshot at
`/tmp/skellyspeak-phone-build.5Fv4n2` contains the previously tested phone fixes
plus the new hosted validation-message repair, excluding unfinished assessment
changes. The shared working tree is preserved. This distinction matters when
interpreting device results: it is a phone-fix build, not verification of the
combined assessment changes. The snapshot's UI build and localization checks
pass. Android compilation subsequently passed and produced
`native/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
inside the snapshot. APK inspection confirmed the `.dev` package, Dev-SkellySpeak
label, ARM64 code and version 2.1.1 before installation.

Installation succeeded at 07:51 on September 21. Both packages remain installed;
the official package retains its prior September 20 update timestamp. The new
development process starts and its private native/frontend JSONL diagnostic files
are readable with `adb shell run-as com.freemocap.skellyspeak.dev`. Startup logging
initialized and `get_startup_state` completed successfully. The phone locked before
visual verification; unlocking and any required development-profile setup are
still needed before the user's speech reproduction. This is not a verified fix
for the rejected speech request or device verification of gloss placement.

## Android workspace startup repair

The user then reported the development app's workspace-lock refusal and disabled
Factory Reset button. Inspection of the installed Rust 1.96 standard-library
source established that `File::try_lock` returns Unsupported on Android. The
workspace adapter incorrectly mapped every lock error to Conflict, hiding that
cause and causing the UI to disable recovery as though another process owned it.

Implemented: Unix workspace ownership now uses `libc::flock(LOCK_EX | LOCK_NB)`;
non-Unix platforms retain the standard-library API. The last retained file handle
continues to own the lock. Only WouldBlock becomes Conflict; other OS failures
retain their actual explanation, error kind, OS code and workspace-lock stage.
Cargo metadata and lockfile include the direct Unix libc dependency. Fourteen
workspace tests and eleven factory-reset tests passed, including cross-process
ownership and retained-guard coverage.

The rebuilt development APK was installed and visually reached language setup;
its private SQLite workspace was created successfully. No data reset was needed.
This supersedes the earlier startup-command-only verification: successful IPC
alone did not establish that the workspace opened.

Android then displayed a native ELF alignment warning. The local NDK r27 build
produced 4 KB LOAD alignment. `native/build.rs` now applies the max/common page
size linker flags specified by [Android's 16 KB page-size guidance](https://developer.android.com/guide/practices/page-sizes)
to Android cdylibs. Rebuild passed; all native LOAD segments have 0x4000 alignment
and `zipalign -c -P 16 4` passed. The final APK was installed and the phone now
visibly reaches AI-access onboarding without the compatibility warning. At 08:00,
the development profile is not signed in. Current and preceding run logs show
startup/settings reads, with no recorded speech reproduction yet. The official
installation and its data remain unchanged; no reset, commit or deployment occurred.

## Superseding decision: one Android installation

Google sign-in from the separate development installation returned to the official
app because both registered `skellyspeak://auth`. A separate callback and server
allowlist change were prepared but never deployed. The user explicitly cancelled
that approach and requested one source-built SkellySpeak installation under the
normal package identity, while deleting both phone installations themselves.

Removed the separate developer config, Gradle label/variant switch, native
callback selection and associated server allowlist/test changes. The shared
callback is again solely `skellyspeak://auth`. The retained changes are the
speech/gloss/error fixes, working Android file locks and 16 KB native alignment.
Earlier separate-install instructions and temporary focused-build details above
are historical, not the current workflow. README now documents the normal-package
standalone source APK. Current combined source passes UI build/localization;
Android compilation and installation are in progress. No deployment is required
for the normal sign-in callback, and no deployment or commit was performed.

Completed: current combined source built successfully and all 15 hosted tests
passed after restoring the normal callback. APK inspection confirms label
SkellySpeak, package `com.freemocap.skellyspeak`, and only the normal auth scheme.
16 KB APK alignment passed. Installation succeeded, and the phone visibly reaches
language setup with a newly opened private workspace. Package enumeration confirms
only the normal SkellySpeak installation remains. Future local builds update this
same installation; the source build remains debuggable for USB diagnostics.

## Superseding error-retention fix

The normal-package reproduction still returned HTTP 400 with its reason removed:
the finite validation-message allowlist did not match the deployed service's
message. The user explicitly rejected blanket reason redaction. That allowlist
and the hosted boundary's entire-detail replacement have now been removed.

Hosted errors retain the shared scrubber's bounded response detail and display
the supplied explanation before falling back to client-authored status guidance.
HTTP 429 retains its refusal classification while displaying any supplied reason.
The shared HTTP adapter retains scrubbed non-JSON error text instead of deleting
the whole body. Native/UI sanitizers no longer treat quotation marks as evidence
of sensitive content; known submitted values, credential patterns and explicit
content/credential fields are still removed separately. Native attempt/operation
IDs and frontend x_request_id are recognized diagnostic metadata. Large metadata
summaries retain detail, reason and request ID as well as the earlier fields.

Verification: 13 hosted tests, 4 response-diagnostic tests and 16 UI diagnostic
tests passed. The HTTP fixture uses a novel quoted validation explanation together
with a credential and transcript, asserting both useful retention and private-value
removal. The current source APK built and was installed in the normal package.
The phone locked before fresh speech verification. Previously persisted reasons
cannot be recovered retroactively; the next request must capture a new response.
No server deployment or commit was performed.

## Retained speech reason identifies the contract mismatch

The next phone reproduction at 08:20 retained `detail: "Speech requires model
and text."` in both the visible error and native JSONL diagnostics (HTTP 400).
This confirms the new error-retention path on the device.

Git inspection identifies that exact error in `8c5b94a^`'s speech endpoint:
it requires `set(value) == {"model", "text"}`. The current native client sends
`model`, `text` and `language`, and current server source requires all three.
Thus the observed response matches the older endpoint rejecting the new language
field, rather than absent text/model or a device microphone failure. Updating only
the phone does not bring the hosted endpoint's contract into sync. No service
deployment has been authorized or performed in this investigation.

## Deployment packaging and local provider overload follow-up

Implemented in source; not deployed or committed:

- The v2.1.1 app release succeeded independently of the failed server workflow.
  Server run 35548609779 failed its container startup check because Docker's
  explicit runtime copies omitted `server/app/accounting/usage_limits.py`.
  Cloud Run deployment was skipped. The Dockerfile and both upload allowlists
  now include it and the current runtime dependency `inference/decisions.py`.
- Deployment tests now check every runtime module is packaged and start the
  copied runtime in isolation, so imports from the checkout cannot hide missing
  files. Docker is unavailable locally; the existing GitHub container test
  remains the actual image verification step.
- A proposed release-to-deploy coupling was implemented locally then removed at
  the user's explicit request. Release and deployment workflows remain unchanged
  and independent. No GCP trust/IAM rules were changed. A push changing server
  source on main triggers the existing deployment workflow; its success must be
  checked before the separately authorized patch release.

Observed local failure at 2026-09-21 08:50:20 America/New_York:

- `/v1/audio/transcriptions` reached ElevenLabs and received HTTP 429,
  `rate_limit_error` / `system_busy`: “We are sorry, the system is experiencing
  heavy traffic, please try again.” This differs from the old hosted request
  contract rejection. The local server returned HTTP 502 for the upstream error.
- Service request ID: `29b8e4e97ed24f29aa8cf273449f163b`.
  Provider request ID: `2b3559dca360f87ff2aa47df6d1c2ce0`.
- The reason survived structured diagnostics but the primary message displayed
  only `AUDIO_PROVIDER_HTTP`. The server now includes the already scrubbed provider
  code and reason in its primary detail. It does not automatically retry or infer
  zero cost from a rejection. The native client supplies its existing no-retry
  notice without the server duplicating that sentence.

UI implemented: the top fault panel no longer has a 120px/18dvh cap. A bottom
handle supports pointer/touch dragging and Arrow Up/Down, Home and End keys,
up to 85% of the viewport. Diagnostic text wraps within the full available width.
Shared expanded response/error details and modal/detail dialogs support browser
resize handles, bounded to their container/viewport. This is not a claim that
all bespoke application panels have been audited.

Verification: 40 audio-service/deployment tests passed, 5 focused UI tests passed,
TypeScript and stylesheet validation passed. Browser verification confirmed
expanded details remain readable and the top handle both grows by keyboard and
shrinks by dragging. The prior complete server run passed 467 tests with seven
emulator-only skips before this follow-up. No live provider retry was made.
