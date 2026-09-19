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
