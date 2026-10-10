# Workflow recording and replay

Status: tooling foundation implemented; application integration proposed and not
yet connected. No learner session has been recorded or replayed. This work runs
alongside the stage 11 static audit; it does not establish performance results.

## Implemented and verified

`tools/workflow-replay/` uses installed Node/TypeScript facilities, without adding
dependencies or changing the application. Its synthetic tests establish:

- Explicit content consent is required to create a capture. Byte/event limits
  stop recording with an incomplete status; events are never silently dropped.
- Event sequence and runner timestamps are monotonic. Native/UI clock samples
  retain their clock identity; subtracting different clocks is not supported.
- Text retains exact Unicode source. Assets have SHA-256 identities and lengths;
  identical bytes can have multiple explicit roles with one retained payload.
  Each audio event identifies its input/output role, which validation checks.
  Missing/damaged assets and missing starting workspace prevent validation.
- Export creates a new directory, writes assets, then publishes the manifest.
  It refuses overwrite. An interrupted export has no complete manifest.
- Provider tapes match stable request keys and credential-free request hashes,
  independently of concurrent arrival order. They retain first-response and
  inter-chunk delays, failure and cancellation outcomes. Replay rejects missing
  requests, mismatched fingerprints, repeated consumption, unfinished responses
  and delivery failures. Any unmatched/repeated request permanently fails that
  replay session, even if the caller catches the error. There is no network
  transport implementation in this tool.
- An optional read-only discovery probe reads only CDP version/target counts from
  an explicit numeric loopback origin. It refuses redirects, bounds response
  size/time, and does not expose target titles or URLs in its report.

Checks (2026-10-10): strict TypeScript and ten synthetic Node tests passed.
The repository fast gate and documentation-entrypoint link check passed.
All filesystem tests use temporary synthetic fixtures. The workspace fixture is
deliberately not represented as a real SQLite database or native export.

Run from repository root:

```powershell
node node_modules/typescript/bin/tsc -p tools/workflow-replay/tsconfig.json
node --test tools/workflow-replay/session.test.ts
node tools/workflow-replay/desktop-preflight.ts
```

No-argument preflight is offline. It reports Playwright availability, not a tested
desktop attachment. Playwright packages are currently absent. Supplying an explicit
loopback CDP origin performs discovery only; no such probe was run against the app.

## Desktop attachment investigation

Playwright documents WebView2 CDP attachment using
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>` and
`connectOverCDP`. An isolated development launch needs its own workspace, WebView2
profile and chosen loopback port. The actual SkellySpeak window has not yet been
attached or driven. Official mechanism support is not an application acceptance
test. [Playwright WebView2 documentation](https://playwright.dev/docs/webview2).

Tauri also documents desktop WebDriver integration. That remains an alternative
if the isolated CDP attachment test fails; adding two automation stacks is not
necessary. [Tauri testing documentation](https://v2.tauri.app/develop/tests/).

The repository's Android harness in `tools/e2e/android.ts` already uses Node CDP
and synthetic microphone input. Its DOM click helpers are useful reference, but
do not prove native mouse, composition/IME, focus or desktop audio behavior.

## Next integration steps, in order

1. Add an explicit development launch option selecting an isolated workspace and
   WebView2 profile. `native/src/application/startup.rs` currently derives the
   workspace from the app data directory. Fail if the requested isolation cannot
   be established. Keep the recorder off for ordinary launches.
2. Prove attachment and one click/input/read assertion on that isolated window.
   Select a single automation dependency only after this integration decision.
3. Connect native-consistent workspace export. The existing
   `native/src/storage/factory_reset.rs::export_workspace` holds store ownership
   while copying database sidecars and Drill audio. Reuse that ownership boundary;
   do not independently copy a live database. Review captured settings for secrets
   and include all required referenced media. The foundation accepts opaque bytes;
   it does not yet package, restore or verify this export.
4. Implement start/stop recording controls and a bounded asynchronous sink. The
   in-memory tooling collector is suitable for synthetic tests and small bundles,
   not a continuous audio recorder. Document dropped/unsupported sources explicitly
   and prevent an incomplete session from being offered as exact replay.
5. Observe browser semantic actions, composition, focus, pointer/scroll movement,
   rendered checkpoints and audio lifecycle. Add stable target identities where
   needed. Recording all pointer movement needs measured buffering overhead.
6. Hook native provider request/response boundaries before credentials are added
   and after content/metadata are classified. Candidate owners are
   `native/src/ai/transport/graph_request.rs`, `graph_text.rs`,
   `speech_stream.rs` and `transcription_provider.rs`. Capture decoded provider
   content/stream order and approved metadata, never raw headers or credentials.
   Browser HAR cannot see these Rust HTTP requests.
7. Hook microphone capture at `speech/recording/browser_capture.rs` and the active
   native microphone path; record requested/delivered speech assets and frontend
   playback milestones through `ui/src/platform/audio/`. Retain codec/sample-rate
   descriptors. These hooks have not been implemented.
8. Add a bounded unknown-JSON disk decoder, workspace restore into a disposable
   directory, native request-key mapping and strict offline transport enforcement.
   Do not cast arbitrary JSON to the tooling types. No request may fall back to a
   live provider during recorded replay. A provider replay key must be a stable
   workflow/operation occurrence, not an ephemeral UUID or global arrival index.
9. Add correlated clock calibration and timing output, compare recorder-on/off
   overhead, and exercise a short synthetic full-stack session before asking the
   user to record representative workflows.

## Scope and interpretation

The event types are tooling observations, not graph definitions or generated
application contracts. They do not schedule operations or interpret graph states.
The current typed in-memory validator checks bundle integrity; it is not a parser
or redactor for untrusted recordings. Application adapters must construct allowed
fields and exclude access settings, credentials and arbitrary exception strings.
Opt-in text/audio content remains sensitive and stays separate from redacted logs.
File creation mode does not establish Windows ACL isolation; the final recorder
must choose a user-private local directory and test its permissions.

The default provider tape mode delivers without artificial delay for deterministic
tests. Supplying a wait callback reproduces recorded request-to-response and chunk
intervals without serializing independent requests. It does not reproduce OS thread
scheduling, enforce UI event timing, or simulate physical speakers/microphones.
Cancellation outcomes are retained, but live user cancellation timing still needs
the application adapter. Build/settings mismatches and supported replay modes need
explicit acceptance checks in that adapter.

The foundation is not a recording button, full workflow runner, screen recording,
desktop attachment proof, complete media recorder, or responsiveness measurement.
