---
sidebar_position: 6
title: Platforms & Build
---

# Platforms and builds

SkellySpeak is a Tauri v2 application with a React webview and Rust core.
Desktop, Android, and iOS are represented in the repository. A plain browser
build is intentionally non-functional because product behavior depends on
Tauri IPC.

## Provider modes

Provider routing is centralized in `src-tauri/src/settings.rs`:

- **Hosted:** Google sign-in; chat, transcription, and speech proxy through the
  SkellySpeak service.
- **Cloud:** the learner's OpenRouter key for model calls and speech, plus a
  Groq key for transcription.
- **Custom:** an OpenAI-compatible chat server. Speech still uses the explicitly
  configured cloud keys because a generic chat endpoint does not imply speech
  support.

No mode silently falls back to another provider.

## Version and release trigger

`src-tauri/Cargo.toml` is the application-version source. Tauri, Android, and
the release workflows derive their versions from it.

```powershell
node scripts/release.mjs minor --dry-run
node scripts/release.mjs minor
```

The release script accepts `patch`, `minor`, `major`, or an explicit
semantic version. It performs Git writes, so agents must not run it. A `v*`
tag triggers the release workflows, which collect artifacts in a draft GitHub
release for review before publication.

## CI release matrix

| Target | Workflow output | Signing/update behavior |
|---|---|---|
| Windows x64 | NSIS and MSI | Azure Artifact Signing; Tauri updater artifacts signed separately |
| macOS Apple Silicon | DMG | Developer ID signing and notarization; Tauri updater |
| macOS Intel | DMG | Developer ID signing and notarization; Tauri updater |
| Linux x64 | deb, AppImage, rpm | AppImage participates in the Tauri updater |
| Linux arm64 | deb | Package-manager/manual update |
| Android | universal APK and AAB | Release upload-key signature; Play or matching-signature sideload update |
| iOS | IPA | Apple Distribution signature; delivery through TestFlight/App Store or an ad hoc profile |

This table describes the checked-in workflows. A particular artifact is
verified only after its workflow has completed and its signature checks pass.

## Desktop

```powershell
npm install
npm run tauri dev
npm run tauri build
```

The main window is 1200×800 with a 360×480 minimum. Narrow desktop windows use
the same compact layout as mobile. The Rust core records microphone audio on
Windows, macOS, and Linux because packaged WKWebView contexts cannot reliably
provide browser media capture.

Desktop builds use the Tauri updater. The app reads
`latest.json` from the newest published GitHub release; a draft does not reach
installed clients. The update public key lives in `tauri.conf.json`, while CI
provides the private signing key. Windows and macOS also require their OS-level
signing credentials.

### macOS development bundle

`tauri dev` launches a bare executable. For tools that discover macOS `.app`
bundles, including Computer Use, package that executable after the dev build
finishes. Keep `npm run tauri dev` running, then use a second terminal:

```sh
npm run macos:dev-bundle
open src-tauri/target/debug/bundle/macos/SkellySpeak.app
```

Computer Use can open the same `.app` by its absolute path. This command
packages the existing default-target debug executable; it does not compile it.
Run it after `tauri dev`, not after `tauri build --debug`, to retain the Vite
connection at `http://localhost:1420` and frontend hot reload.

The bundle runs a separate process with the same app identifier, credentials,
and conversation storage. Use only the bundled window for interactions while
testing, leaving the original dev window idle. Rust changes rebuild the original
dev executable, but do not update the bundle's copy: quit the bundled app,
wait for the dev rebuild to finish, rerun `npm run macos:dev-bundle`, and reopen
the `.app`. Keep the dev session running to serve the frontend.

The explicit `tauri.dev-bundle.conf.json` overlay disables updater artifacts for
this local bundle, and the command skips code signing. Distribution builds use
the normal signing and updater configuration.

Keep the bundled process running for frontend-only changes and batch Rust
rebuilds. An unsigned/ad-hoc development executable does not provide a stable
certificate-backed code identity across rebuilds, so macOS may ask again for
Keychain access even after Always Allow. This is separate from Computer Use app
approval. Stable development signing is the appropriate way to preserve code
identity across builds; do not broaden credential access to all applications.
See Apple's [code identity and Keychain guidance](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/AboutCS/AboutCS.html).

## Android


The Android scaffold is in `src-tauri/gen/android`. Android uses the webview
recorder and declares microphone permission in its manifest.

```powershell
npm run android
npm run android:apk
```

`android:apk` produces a sideloadable debug APK for development. The release
workflow instead requires the configured upload keystore, builds APK and AAB
artifacts, and verifies the APK signature.

The generated Gradle integration includes repository-specific Windows process
launch handling. Reconcile generated changes carefully after running
`tauri android init`.

## iOS

iOS builds require macOS and Xcode. `.github/workflows/ios-distribute.yml`
creates the Xcode scaffold, checks the iOS Rust target before loading signing
credentials, stages an ephemeral keychain/profile, builds the IPA, verifies its
bundle/team/entitlements/signature, uploads the artifact, and cleans up signing
material.

iOS microphone capture runs in the Rust core through cpal. Before capture,
`src-tauri/src/audio.rs` configures `AVAudioSession`; the app's microphone
usage description is in `src-tauri/Info.plist`.

Provider keys and hosted sessions use the platform credential vault. Their
actual persistence and permission behavior must be smoke-tested on a physical
device.

## Mobile updates

Tauri's desktop updater is not compiled on Android or iOS. Mobile builds still
check the latest published GitHub release and can open its page, but installation
is owned by the platform package/store mechanism.

## Documentation site

`skellyspeak-docs/` builds a Docusaurus site for
`https://docs.freemocap.org/skellyspeak/`. The deployment workflow publishes
GitHub Pages when docs change or after a release.

```powershell
cd skellyspeak-docs
npm install
npm start
npm run build
```

## Verification boundary

CI configuration is evidence of intended behavior, not proof that current
repository secrets, Apple/Google accounts, stores, devices, or live cloud
resources are correctly configured. Record those results only after exercising
the corresponding environment.
