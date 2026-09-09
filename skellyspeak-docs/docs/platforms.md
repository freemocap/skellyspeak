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
semantic version. It updates the application lockfile entry with Cargo, allowing
registry access when the local index lacks locked dependency versions.
It performs Git writes, so agents must not run it. A `v*`
tag triggers the release workflows, which collect artifacts in a draft GitHub
release. The **Release** workflow publishes it automatically and marks it as
latest after the reusable CI checks, version validation, draft creation, every desktop matrix build,
and the Android build succeed. Failed, cancelled, or skipped dependencies prevent
publication. The separate iOS distribution workflow does not gate publication
and can attach its verified IPA after the release is published.

Workflow actions use immutable commit IDs. Checkouts do not persist GitHub
credentials, and build/test jobs have read-only repository permissions unless
they upload release artifacts. Pages deployment permissions belong only to its
deployment job. The Windows signing CLI download must match its pinned SHA-256
digest before execution; desktop matrix jobs receive only their platform's
signing credentials, plus the updater signing key.

The frontend CI job installs both root and docs dependencies because the root
Vitest suite includes the docs download-selection tests.

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

For native development testing, run one app process against the shared storage.
The desktop single-instance plugin is registered before credential initialization;
a second launch raises the existing main window. An older build without the guard
must be quit before using this behavior.

Build and package the development executable without launching a second bare app:

```sh
npm run dev
# In a second terminal:
cargo build --manifest-path src-tauri/Cargo.toml --bin skellyspeak
npm run macos:dev-bundle
```

Keep Vite running. The debug bundle uses `http://localhost:1420` for frontend hot
reload. Quit the app before replacing its executable after Rust changes. Open
`src-tauri/target/debug/bundle/macos/SkellySpeak Dev.app` for native inspection.

The default development bundle skips signing. Its hash-based code identity changes
when rebuilt, which can invalidate remembered Keychain approvals. Once a persistent
code-signing certificate is available in the login keychain, sign each rebuilt
bundle with the same identity before opening it:

```sh
security find-identity -v -p codesigning
SKELLYSPEAK_SIGNING_IDENTITY="certificate name or identity hash" npm run macos:dev-sign
```

The signing helper requires a certificate, rejects ad-hoc `-`, signs the existing
bundle and verifies its signature. It never creates certificates, changes keychain
ACLs or disables protection. Certificate creation/import and any macOS password
prompts require the developer. Approve the consistently signed app when macOS asks;
subsequent builds must retain the same identifier and signing identity. Signing is
not notarization or release validation. The development overlay disables updater
artifacts only; release builds retain normal signing and updater configuration.
See Apple's [code identity and Keychain guidance](https://developer.apple.com/library/technotes/tn2206/).


## Android


The Android scaffold is in `src-tauri/gen/android`. Android uses the webview
recorder and declares microphone permission in its manifest.

```powershell
npm run android
npm run android:apk
```

`android:apk` produces a sideloadable debug APK for development. The release
workflow instead requires the configured upload keystore, builds APK and AAB
artifacts, and verifies the universal release APK signature. Every reported APK
signer fingerprint must match the upload certificate, including numbered signers, `V2 Signer:` entries, and SDK-range signer
entries for v3.1 signatures. Missing fingerprints and certificate mismatches fail
the release with diagnostic output. The workflow uploads the exact universal
release APK it verified and the universal release AAB.

The generated Gradle integration includes repository-specific Windows process
launch handling. Reconcile generated changes carefully after running
`tauri android init`.

## Hosted server CI

The server deployment workflow installs Java 21 and the Cloud Firestore emulator,
then starts it with `gcloud emulators firestore start` before running concurrent
transaction tests. Startup exits immediately if the emulator process dies, and
cleanup prints the emulator log even when the process has already exited.
These tests require a running emulator; ordinary server unit tests do not verify
Firestore transactions.

## iOS

iOS builds require macOS and Xcode. `.github/workflows/ios-distribute.yml`
creates the Xcode scaffold, checks the iOS Rust target before loading signing
credentials, stages an ephemeral keychain/profile, builds the IPA, verifies its
bundle/team/entitlements/signature, uploads the artifact, and cleans up signing
material.

### Automatic TestFlight uploads

Pushing a `v*` tag also runs the independent **Upload and process TestFlight
build** job against that run's verified IPA. It uses a commit-pinned
`Apple-Actions/upload-testflight-build` action and waits for App Store Connect
processing. Manual workflow runs upload only when **upload_testflight** is
selected. The existing signing credentials are separate from upload credentials.

One-time repository configuration:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `APPSTORE_ISSUER_ID` | App Store Connect team API issuer ID |
| Variable | `APPSTORE_API_KEY_ID` | Team API key ID |
| Secret | `APPSTORE_API_PRIVATE_KEY` | Complete downloaded `AuthKey_*.p8` contents |
| Variable | `APPSTORE_USES_NON_EXEMPT_ENCRYPTION` | Reviewed export-compliance declaration: `true` or `false` |

Create the team API key in App Store Connect → Users and Access → Integrations,
with the App Manager role as specified by the upload action. Add its private key
directly to GitHub Actions secrets; do not commit it or paste it into logs.
The workflow fails clearly if required configuration is missing. It does not
guess the encryption declaration.

In App Store Connect → SkellySpeak → TestFlight, check whether the device's group
is under **Internal Testing** or **External Testing**. For internal testers,
enable **automatic distribution** on the group. External testers require the
appropriate beta-review and group-distribution setup; this workflow does not
submit external beta reviews or add builds to external groups. Apple processing,
agreements, export-compliance requirements, and beta review can delay availability.
Uploading does not publish a public App Store release. Device installation is
controlled by TestFlight; enable automatic updates there if desired.

The marketing version still comes from Cargo.toml. Each full workflow attempt
uses a fresh `run_number.run_attempt` build number. If an upload job fails after
Apple accepted the binary, check App Store Connect before retrying: rerunning only
that job reuses the same IPA. Rerun the complete workflow to produce a fresh build
number; do not repeatedly upload a consumed build.

Local workflow validation does not prove signing, upload, Apple processing, or
device delivery. Verify the first configured tag run and its TestFlight build.

References: [upload action](https://github.com/Apple-Actions/upload-testflight-build),
[Apple internal tester setup](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/),
[Apple build uploads](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

iOS microphone capture runs in the Rust core through cpal. Before capture,
`src-tauri/src/audio.rs` configures `AVAudioSession`; the app's microphone
usage description is in `src-tauri/Info.plist`.

Provider keys and hosted sessions use the platform credential vault. Their
actual persistence and permission behavior must be smoke-tested on a physical
device.

## Mobile updates

Tauri's desktop updater is not compiled on Android or iOS. Android checks the latest published GitHub release and opens `https://docs.freemocap.org/skellyspeak/download` for installation. The webview opener scope permits that exact page. iOS uses its store distribution channel rather than the desktop updater.

## Documentation site

`skellyspeak-docs/` builds a Docusaurus site for
`https://docs.freemocap.org/skellyspeak/`. The deployment workflow publishes
GitHub Pages when docs change or after a release.

The `/download` page fetches GitHub's latest published, non-prerelease release
at visit time. Installer links and sizes come from its actual assets; missing
platform builds are reported rather than replaced with guessed URLs. API
failures show an error, retry control, and release-history link.

Device detection checks Android and iOS before desktop signatures, including
iPads using a desktop user agent. Desktop processor detection uses browser
client hints when available; macOS and Windows user-agent strings alone do not
establish the processor. Visitors can manually choose any system and processor.
The page highlights exactly one suggested installer in magenta when the selected system has an available download, preferring EXE over MSI on Windows. Titles distinguish formats. When processor detection is unavailable, the suggestion prefers Apple Silicon on macOS and x64 on Windows/Linux, explicitly asks the visitor to confirm the processor, and keeps other available architectures selectable. A known processor is never replaced by another architecture. IPAs, AABs and updater files
remain on GitHub rather than being offered as direct installation choices.

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

Android applies system-bar and display-cutout insets to the native WebView container and zeroes those handled insets before forwarding them to web content, avoiding duplicate padding. Keyboard insets remain available to the window/WebView with `adjustResize`. Verify status-bar clearance, landscape cutouts, and keyboard opening/closing on a device when changing this layout.

### Security controls in development and release builds

Desktop debug builds use a separate `.dev` application and credential identity,
and do not offer release updater installation. The macOS development bundle is
named `SkellySpeak Dev.app`. Enter credentials once in that development profile;
use `npm run macos:dev-bundle` followed by `npm run macos:dev-sign` with
`SKELLYSPEAK_SIGNING_IDENTITY` set to a stable certificate. Ad-hoc or unsigned
rebuilds may still trigger Keychain approval; clicking Always Allow cannot make
an unstable code identity stable. No existing Keychain entries are deleted.

Android excludes private app data from cloud backup and device transfer. Native
restore behavior and stable signing across rebuilds still require device checks.

Release runs share one concurrency group and refuse to overwrite a published
release. APK verification compares the signer certificate with the configured
upload keystore. Updater signatures are cryptographically verified against the app public key;
publication refuses an equal or newer stable release already on GitHub. Independent
desktop native signer/notarization verification remains a follow-up. Dependabot monitors Actions, Rust, Python,
frontend and docs dependency manifests.

Both iOS workflows run `tauri icon public/skellyspeak-logo.png --ios-color '#f3f1ea'` immediately after `tauri ios init`, applying the source logo to the generated Xcode asset catalog on every scaffold. The paper-color background is used for iOS icons; `scripts/ios-icons.swift` then rewrites the PNGs as opaque RGB so no alpha channel remains. This follows [Tauri’s app-icon setup](https://tauri.app/distribute/app-store/). Generated Xcode projects remain untracked; an installed-device icon still requires an iOS build and installation to verify.
