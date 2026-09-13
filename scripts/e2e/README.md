# Real Android app smoke tests

This runner opens the installed SkellySpeak development app and drives its actual
WebView controls over ADB/CDP. It does not call IPC directly, seed a database,
substitute provider responses or render a test page. Native persistence and live
AI routing remain in use. It creates real test conversations in the device's
current workspace; use development data.

## Run

Install the debug APK using the Android instructions in the root README. Keep
Vite running at port 1420 and `adb reverse tcp:1420 tcp:1420` active. Configure AI
access on the device once. The runner does not copy credentials from another
workspace. USB debugging must be authorized. Set `ANDROID_SERIAL` if multiple
devices are attached.

- `npm run e2e:check`: type-check the runner and test device-selection failures.
- `npm run e2e:android:preflight`: open the native app and check device, debug
  WebView, production page, native bridge and AI sign-in gate. No inference.
- `npm run e2e:android`: run three live-provider text conversations.
- `npm run e2e:android:voice`: add one prerecorded speech interaction per language.

The `--live` commands intentionally spend provider usage. They are separate from
ordinary unit tests and must be run explicitly. There are three language cases,
one starter and one text message each; the voice command adds three recordings.
The app's normal ancillary requests (glosses, feedback, suggestions, speech) also
run. No automatic retry hides a failure.

## Assertions

For Spanish, Arabic and Chinese, select the language, create a new chat, press
“You start,” require a partner reply without a fabricated learner message, enter
text and send. Require a reply, completed feedback and published learner/partner
glosses. Fail on visible application errors, provider errors, JavaScript exceptions
or bounded timeouts. Open a gloss and check it reveals. Arabic additionally requires
`الكتاب` to render as a single source text node. Save a screenshot after each case.

Voice uses `test-fixtures/speech/*.wav`. The test substitutes only the microphone's
MediaStream, using WebAudio to play the fixture into MediaRecorder. It presses the
real Record and Stop controls, exercises encoding, the native transcription
lifecycle and the configured provider, checks expected transcript content, sends
through the composer (or observes Auto-send), and requires a reply and feedback.
It restores the microphone method after every recording. These are synthetic
speech software-path tests, not physical microphone, permission-prompt, speaker,
noise robustness or human-pronunciation validation. Those remain separate device
checks. `npm run e2e:fixtures` regenerates fixtures with installed macOS voices and
fails if synthesis yields empty audio. The transcript/voice manifest accompanies
the files.

Reports, screenshots and failure UI text go to `.local/e2e/<timestamp>/` (ignored
by Git). They may contain test conversation content. No keys, storage dumps or
network bodies are captured. A missing device, sign-in requirement or failure to
connect fails the command; it never produces a skipped-as-passed result.

## Current verification limit

The runner type-check and device-selection test have passed. Its real-device
preflight has been executed and fails correctly with no device attached. The Mac
was locked and the Pixel disconnected during implementation. Live multilingual
runs, recording injection and screenshots from those runs remain **unverified**
until the device is accessible. This harness must not be counted as end-to-end
coverage merely because its own checks pass.
