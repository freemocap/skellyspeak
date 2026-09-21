# Linux AppImage audio failure and error-retention audit

Superseded for current logging status by the [centralized diagnostics audit](centralized-diagnostics-audit-2026-09-21.md). Historical findings below are retained as incident evidence.

Status: incident diagnosed; local recovery confirmed by the user. Packaging and
diagnostic repairs are implemented in source. No release, deployment or repository
commit has been made. Remaining audit findings below are not implemented features.

## Incident evidence

The downloaded `SkellySpeak_2.2.1_amd64.AppImage` generated 32 browser
`InvalidStateError: Failed to start the audio device` errors and one
`check_access` connection failure on September 21 around 12:46–12:48 EDT.
The application mounted successfully. The repeated audio exceptions originated
in reward-audio initialization/resume, attempted by the global interaction hooks.

The AppImage includes GStreamer 1.20.3 shared libraries but **no matching
GStreamer plugin directory or scanner**. The host has GStreamer 1.24.2 and a
working PulseAudio service provided by PipeWire. Running the host's inspection
tool against the bundled libraries fails with an undefined
`gst_plugin_get_status_infos` symbol. This demonstrates a mixed-version runtime;
it is not a captured stack trace from the original WebKit failure.

The exact executable extracted from that download, copied outside its bundled
library tree and launched with the host libraries, worked in the user's test.
No application source rebuild or workspace reset was involved. Android also
worked, per the user's separate test. This establishes a Linux AppImage packaging
failure, rather than evidence that the same failure affects Android.

[Tauri's AppImage documentation](https://v2.tauri.app/distribute/appimage/#multimedia-support-via-gstreamer)
requires `bundle.linux.appimage.bundleMediaFramework` for audio/video playback.
That setting was absent. The recovery executable was copied into the ignored
`.local/release-recovery/SkellySpeak-2.2.1/` folder. It depends on this host's
installed libraries; it is not a portable replacement release.

The original connection failure's network cause cannot be recovered: its
`map_err(|_| ...)` discarded the reqwest error before logging. It must not be
attributed to the audio packaging defect without evidence. The user reported
that the recovery window works; a new connection failure was not established.

## Implemented repairs

- Enable AppImage media bundling and install GStreamer base/good/bad/libav
  plugins and tools on the Linux release runner.
- Add `tools/check-appimage.ts` to inspect actual AppImage contents. Linux x64
  release verification now rejects artifacts missing the plugin scanner or core,
  application, playback, auto-output, PulseAudio, conversion, resampling and WAV
  plugins. The check rejects the actual downloaded defective bundle. File
  presence is a packaging gate, not proof of playback on every distribution.
- Preserve transport reasons and bounded cause chains for connection checks,
  key verification, HTTP-client initialization, hosted account/sign-in/diagnostic
  requests, response-body reads and release discovery. Existing caller error
  codes are preserved so observability changes do not change retry policy.
- Preserve parser category and line/column for connection, key, hosted and
  release JSON failures without echoing rejected response strings.
- Preserve interrupted chat response HTTP metadata and retain read failures
  alongside HTTP error status/headers on native and server error-body paths.
- Preserve browser media messages, error identity and nested causes through
  the shared redactor. Scrub blob/file URLs as well as HTTP URLs. Reward-audio
  failures distinguish context creation from context resume and use the fault
  surface even when construction throws synchronously.
- Surface failed conversation-stream subscriptions and reads instead of empty
  catches. IPC read failures already had durable logging; subscription failures
  did not have the same protection.
- Server credential probes retain transport explanations, OS error numbers,
  cause locations and JSON failure positions. Both response and runtime-log
  sanitizers retain these diagnostics. ElevenLabs transport errors retain
  sanitized cause chains with the known key/request values removed.
- Native log initialization/write errors and workspace file-permission failures
  retain IO kind and OS error number, without paths/custom IO payloads. Native
  manifests now identify app version, platform, architecture, debug build and
  whether launched as an AppImage.

## Audit scope and remaining findings

This extends the September 18 cross-layer audit and September 20 message-retention
repair. Searched active Rust, TypeScript/TSX and Python in `native/src`, `ui/src`,
`server/app` and `tools` for discarded catches, `map_err(|_| ...)`, conversion to
optional values and exception handlers. Reviewed central producers, redaction,
IPC delivery, disk sinks, receipt publication and the concrete paths below.
Excluded `old/`, generated contracts, fixtures and translation/data files from
the source scan. A static search is not a proof that every possible information
loss has been eliminated.

| Owner | Finding after this repair | Remaining work |
| --- | --- | --- |
| Packaged Linux process output | WebKit/GStreamer stderr does not pass through Rust's `log` facade; a normal desktop launch has no durable outer process capture. | Add a reviewed packaged-process capture path for OS/library diagnostics. The existing `tools/dev-run.ts process` launcher captures this during reproduction; the Rust message-retention fix alone cannot recover earlier stderr. |
| `ai/hosted/mod.rs` | The special HTTP 429 reader still replaces interrupted/oversized reads with a generic refusal; local sign-in socket/browser-open failures also lose source errors. | Preserve the refusal plus HTTP facts and separate transport/OS diagnostics. Never lose the refusal merely because its body cannot be read. |
| `ai/connections/credentials.rs` | Keyring creation, write and deletion collapse backend errors into “storage unavailable or access denied.” | Retain reviewed keyring error variants and safe backend cause information; do not dump credential objects, identifiers or secret-bearing debug representations. |
| `ai/transport/grouped.rs`, `streaming.rs` | Several malformed-event paths retain only generic protocol outcomes or an authored stage. | Keep event index, byte count, parser category/location and safe envelope identifiers; retain already validated partial receipts. Never retain streamed content as diagnostic prose. |
| `ai/transport/service_audio.rs`, `transcription_provider.rs` | Some WAV/base64/sample failures share the same broad invalid-response error. | Distinguish decode/header/spec/sample stages and retain numerical format expectations/actuals. Existing partial speech receipts must survive every branch. |
| Coaching, translation, linguistics adapters | Several structured-response conversions discard parser location and field shape, although some domain errors already carry row/index or contract reasons. | Add typed parser paths/expected shapes at the owning adapters; raw serde error text can echo learner/provider content. |
| `application/commands`, synchronization, task joins | Window creation/focus and some task-join/lock failures collapse to generic internal errors. | Preserve operation and safe underlying identity. Poisoned mutexes and expected busy admission are different states. |
| Server internal/admin errors | Default exception capture now marks omitted prose explicitly, while retaining type, frames and causes. Admin log-access errors and some input parsers still narrow causes. | Review each producer's private context before enabling message retention; keep JWT/credential details private and distinguish validation from transport failures. |
| `ui/features/admin/entry.ts` | Live parse/render failures replace errors with fixed status text. | Retain scrubbed technical details in the admin diagnostic surface, without exposing loaded account/log content. Update the authored TS owner, not generated admin JS. |
| `tools/run-log.ts`, test/artifact helpers | Some sink/finalization/artifact-collection errors emit only a fixed string. | Retain safe error code, stage and cause through a nonrecursive failure channel; a failed sink cannot reliably log to itself. |

### Reviewed distinctions

- `.ok()` is not automatically information loss: optional lookup/parsing and
  selecting success metadata can be intentional. Failed speech publication, for
  example, records its error before the cache reader returns no audio.
- `settingsWrites = result.catch(() => {})` releases a serialization chain; the
  original rejecting promise is returned to its caller. Removing that catch
  would break subsequent saves without improving diagnostics.
- Persona form catches leave owner-rendered validation errors with the draft.
  Locale parsing deliberately skips unsupported locale tags. Literal brackets
  in text inspection are not necessarily malformed diagnostic JSON.
- Existing provider-error tests often established only that private values were
  absent. Regression tests added here require the explanation, code/cause or
  location to survive too. One old read-error test explicitly expected the entire
  transport message to disappear; it now uses a meaningful connection-reset
  explanation with an embedded credential and checks both retention and redaction.

## Verification

- User confirmed the extracted release executable works with system libraries.
- Full UI suite: 156 files / 1,045 tests passed; production UI build passed.
- Full native suite: 511 passed / six ignored; Clippy with warnings denied passed.
- Server diagnostics/inference suite: 295 passed after updating the obsolete
  message-discard expectation. Its FastAPI test client emits an existing
  dependency-deprecation warning.
- New packaging gate tests and strict TypeScript checking passed. The gate rejects
  the extracted official 2.2.1 artifact. No corrected AppImage has been built or
  device-tested in this task; release infrastructure must build the new bundle.
- All 16 Node release-tool tests passed outside the sandbox after its subprocess
  restriction caused `spawnSync git EPERM`. Their Git fixtures are disposable
  temporary repositories; this checkout's history was not changed.
- The recovery run recorded no frontend errors at final inspection. Whitespace
  checking passed. No repository Git mutations or deployment were performed.

## Size/ownership

Diagnostic helpers stay in the existing shared native response owner. The
already-large response, sink and hosted modules remain above the 500-line review
threshold because splitting them is a separate agreed pass; this repair does
not reorganize their runtime ownership or contracts.
