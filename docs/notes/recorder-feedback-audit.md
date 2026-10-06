# Recorder and asynchronous action feedback audit

Status: source audit and focused implementation, 2026-10-05. This is not a
claim that every UI action or physical microphone has been exercised.

## Findings and implemented changes

The shared recorder already sets `starting` before native preflight and uses a
synchronous `working` ref to reject concurrent toggles. Chat did not pass that
state to its composer. Practice used it to disable tapping but kept the ready
presentation. This left the accepted press visually indistinguishable from an
ignored press until capture started.

Chat and Practice now render the shared spinner and announce Starting during
microphone setup. Tap is disabled, mode changes are disabled, and Chat also
blocks Send and device selection during setup. Hold remains enabled to receive
pointer/key release and capture-loss events. Red and the elapsed timer still
mean capture is actually ready. Transcription uses the shared busy spinner.

Both Hold handlers previously waited for startup before requesting Stop. A
release during a slow preflight or browser permission request could therefore
stop a just-opened recorder. Stop now cancels pending startup synchronously;
when native or browser startup returns, its capture is discarded without
transcription. The existing generation checks clean up late results. Repeated
requests remain excluded until startup and cleanup settle. No arbitrary delay
or debounce timer was added.

Refresh microphones had neither pending feedback nor a concurrent-request guard.
It now shows a spinner immediately, disables refresh, and uses a synchronous
ref guard. Failure remains visible and unlocks retry.

## Broader source audit

| Surface | Observed behavior | Disposition |
| --- | --- | --- |
| Chat Send/revise (`ConversationPage.submitText`) | Synchronous admission ref, pending message and sending state before awaits | Existing positive pattern |
| Conversation topic/partner start (`ConversationStart.start`) | Pending ref and selected-action indicator before saving or starting | Existing positive pattern |
| New partner generation/save (`NewPersonaDialog`) | Request/save refs, immediate generating/saving states, late-result ownership checks | Existing positive pattern |
| AI access and model saves (`SettingsAccess`, `SettingsModels`) | Writing refs and busy state before asynchronous work | Existing positive pattern |
| Microphone refresh | No pending state or duplicate guard | Fixed in this change |
| History open/new/delete (`ChatHistory`, `useConversation`) | History callbacks return void; open/delete lack shared admission protection; new-chat ref guard is not exposed as visual state | Follow-up: expose operation identity/state through the owner, show progress on the chosen row, serialize conflicting navigation/deletion and retain failures |
| Explicit update check (`UpdateBanner`) | Ref prevents duplicate checks, but idle banner stays invisible until a result | Follow-up: visible checking state for explicit requests, including requests arriving during an automatic check |
| Continuous recording Stop (`useMicRecorder`) | Ref rejects repeats, but recording presentation remains until native status catches up | Follow-up: explicit stopping phase distinct from queued transcription |

This was a targeted review of primary asynchronous controls and their owners,
not an exhaustive automated enumeration of every event handler.

## Native boundary and remaining recording questions

`native/src/speech/recording/voice.rs` performs async preflight before opening
hardware. A locked shared capture slot rejects a second active recording.
Cancellation is recording-ID scoped. Desktop `audio.rs` rejects empty PCM;
`browser-recording.ts` rejects zero-length encoding. Those checks remain intact,
as do failure reporting and transcription metadata. Native source was not changed.

A tap immediately after successful startup can still intentionally stop a very
short take. This change removes the invisible setup window and the premature
Hold-stop path; it does not establish a new minimum-duration policy for Chat.
Practice already has a minimum-take policy. A future policy should distinguish
no captured samples, intentional short speech, and permission/device failure,
without treating all short clips as microphone problems.

Cancellation of an already active recorder still clears its visible recording
state before native cancellation acknowledges. A new request during that interval
can meet the native occupied-slot error. A fuller lifecycle pass should expose
stopping/cancelling and exclude new admission until acknowledgement, including
failed cancellation recovery. Preserve recording ownership and useful errors.

## Verification

- `npm run check:fast`: passed on final source/test state.
- `npm run build`: passed (existing bundle-size advisory).
- 101 tests passed across `useMicRecorder`, `ComposerInput`, `RecordDock`,
  `DrillPage`, and `MicrophoneSelector`.
- Deferred-promise tests cover repeated startup taps, native and browser setup,
  early Hold release, cleanup without transcription, and refresh failure/retry.
  The real Practice-page early-release test now expects cancellation.
- `ConversationPage.conversation.test.tsx`: 47 passed, two failed. The same two
  failures reproduce against an isolated HEAD snapshot: tests expect Analysis
  while the message toolbar exposes Coach. They are unrelated to these edits;
  the broader conversation suite is not claimed green.
- Initial Vite execution was blocked by sandbox filesystem traversal; tests and
  builds ran successfully with approved filesystem access.
- No live desktop/mobile microphone, OS permission prompt, or visual app review
  was performed. Device verification should cover repeated tapping, releasing
  Hold during permissions, permission denial, owner changes, and retry afterward.
- No commits, deployment, version changes or native runtime changes.

The existing large page files remain large: this focused behavior fix does not
attempt their separately scoped decomposition.

## Subsequent microphone setup work

The optional local test and capture-health implementation is recorded in
[microphone setup and health](microphone-setup-and-health.md). Its native changes
and verification supersede this first batch's native-unchanged statement.
