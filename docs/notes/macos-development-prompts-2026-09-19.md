# macOS development prompts — September 19

## Observations

The existing launcher already uses the SkellySpeak Local Development certificate
and stable org.skellyspeak.practice signing identifier. It previously recreated
and re-signed the bundle at every invocation, even when Cargo produced no change.
Direct tauri dev bypasses this launcher. The exact password dialog reported by
the user has not yet been identified; signing-key access and app credential access
are separate possible sources.

Every native read_secret request previously performed another OS Keychain read.
Credential admission bounded concurrency but did not coalesce requests or retain
authorized results. Settings credential previews and provider work use this path.

The app initially had a blank window because its Vite server was absent. Restarting
through npm run macos:dev restored a working first-run language screen. The workspace
was already fresh at that point; no second reset was performed. The user proceeded
to AI access while changes were being prepared.

## Changes

- Launcher seals source executable, Info.plist, launcher and version fingerprints
  in a build stamp inside the signed bundle. An identical stamp is reusable only
  after codesign verifies the bundle and the selected signing certificate.
  Changed inputs rebuild/sign normally; failed verification is fatal.
- macOS-only native process credential cache coalesces reads under a mutex. Only
  successful reads are retained; failures remain explicit and can be retried.
  Eight-entry bound, zeroizing values, no persistence/logging. Save/delete evict
  under the same lock, including failed mutations. A Keychain edit outside the app
  takes effect after restarting the app. Other platforms retain their current path.
- No Keychain ACLs, certificate trust, password settings or macOS protections changed.

## Verification

Three credential-cache tests cover reuse, concurrent reads, failed reads, bounded
retention and invalidation on successful/failed mutation. Launcher TypeScript check,
existing four log-launcher tests and native clippy pass. Full native suite: 432
passed, one ignored. Updated native executable built successfully. Live bundle reuse and reduced
prompt frequency still need verification after restarting the running app. Current
sign-in work was left undisturbed. No commits or deployment performed.

## September 23: native automatic reload implemented; password issue deferred

The user reports repeated password prompts despite Always Allow, but has asked to
defer that investigation and enable automatic reload. Read-only inspection confirmed
that the running process was the signed SkellySpeak Dev bundle, its signature and
certificate-based designated requirement verified outside the tool sandbox, and
the login Keychain had no timeout. The prompt's requesting process has not been
identified. No credential values, Keychain ACLs or trust settings were accessed or
changed; these checks do not establish the cause or resolve repeated prompts.

`npm run macos:dev` now retains Vite for React/CSS HMR and watches native source,
Cargo manifests/lockfile, Tauri configuration, app plist/entitlements, capabilities,
icons, bundled content and an existing root `.cargo` directory. Native build outputs
and generated UI files do not trigger native rebuilds. Saves are debounced, builds
serialized, and changes during compilation schedule another build. The existing
app remains running until Cargo succeeds. The launcher then waits for the app to
exit, uses the existing bundle/sign/verification path, and launches the new app.
Compiler/signing failures are explicit and wait for another source save; a failed
build is never launched. Normal app exit or stopping the launcher ends the watcher,
Vite and current compilation. A native restart interrupts active recording.

Verification: five tests cover input filtering, coalescing, changes during a build,
failed-build recovery, shutdown and real macOS events including atomic saves and
new nested files. TypeScript checks pass. Real macOS event tests ran outside the
sandbox; its restricted filesystem notification handling was insufficient. Run
`npm run macos:dev:test` and `npm run macos:dev:check` for these checks.

The existing running app was not interrupted and no signing operation was performed.
One manual launcher restart is needed to load this change; subsequent native edits
should rebuild/relaunch automatically. Live signed relaunch and password behavior
remain the user's next checkpoint. No commit.

## September 23: provider route removed; credential namespace corrected

Implemented removal of the desktop API-key route and corrected the Keychain
service to `com.freemocap.skellyspeak.credentials`. Existing hosted/custom tokens
relocate from the misleading OpenRouter namespace on use; obsolete provider keys
are queued for secure deletion by the workspace upgrade. This may require an
initial OS authorization. Repeated prompt behavior is still a live-app check, not
an established fix. See [implementation and verification](service-only-access-2026-09-23.md).

## Correction: no legacy credential relocation

The user rejected legacy preservation. The namespace-copying code added earlier
was removed. Only the neutral namespace is read, written or deleted. Re-establish
sign-in or a custom session token if needed.
No historical-key fallback or automatic token migration remains.

## September 23: remove the remaining legacy deletion access

The user still saw an OpenRouter-labelled Keychain prompt in the current signed
development build. Inspection found deletion still opened the retired namespace;
Keychain deletion can itself require authorization. Removed that final access,
including the legacy entry constructor. Old entries remain unused in Keychain;
the application does not read, copy, or delete them.

Verification: 14 credential tests passed, Clippy with warnings denied passed,
native build passed, and the signed development bundle's source hash matches the
rebuilt executable. The development launcher exited, so a subsequent live launch
is still needed to verify prompt behavior. No credential values or Keychain ACLs
were accessed or changed, and no commit was created.

## September 23: standard Tauri dev restored; reload crash corrected

Supersedes the custom native watcher described above. `macos:dev` now invokes
`tools/tauri.ts dev` through the existing terminal-log wrapper. Tauri owns Vite
startup (`beforeDevCommand`), native watching, compilation and restart. Removed
`macos-dev-watch.ts`, its queue, and its tests. `macos:dev-signed` is an explicit
signed-bundle permissions smoke-test option with frontend HMR only; it has no
native watcher. It requires restarting the command after native edits. Standard
Tauri dev does not use the local certificate wrapper; Keychain authorization
behavior can differ.

The reported trace is a Rust startup panic followed by SIGABRT, not evidence of a
kernel panic. Native restarts inherited one `SKELLYSPEAK_LOG_RUN_DIR`, and the
second process tried exclusive creation of files already owned by the first.
Each native launch now creates a unique child directory under that session root.
Frontend HMR/page refresh keeps the process and the same streams. Terminal logs
remain continuous for the launcher session. Exclusive creation, private modes,
and diagnostic export remain intact; no existing logs are deleted or truncated.

Automated verification: 20 diagnostics tests pass, including repeated launches
under one root and export of both launches; eight launcher/log tests pass;
Clippy with warnings denied and both launcher TypeScript checks pass. The signed
launcher also completed two real native reloads after the log fix, before its
custom watcher was removed. No commit.

Live standard-Tauri verification completed: initial launch plus two native source
save/rebuild/restarts initialized successfully, with three distinct process
manifests beneath one launcher session. No `AlreadyExists` or panic appeared in
that session's stderr. The standard dev session is left running for inspection.
