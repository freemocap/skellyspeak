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
