---
sidebar_position: 6
title: Platforms & Build
---

# Platforms & Build

Current reality: **Windows desktop dev works locally, and CI builds and
publishes every desktop target plus Android and a signed iOS .ipa on a version
tag.** The foundation is mobile-shaped — `Cargo.toml` builds `staticlib` +
`cdylib` + `rlib` (`src-tauri/Cargo.toml:9`), all heavy work lives in the Rust
core, and the frontend is plain React that runs in any webview.

## AI providers

The app reaches an AI provider one of three ways, chosen in Settings and
resolved in exactly one place — `Settings::chat_provider` in
`src-tauri/src/settings.rs`, with `stt_endpoint` and `tts_endpoint` beside it
for the two paths that are not chat completions:

- **`hosted`** — the project's own service, signed in with Google. The
  **default on a fresh install**: chat, speech-to-text and spoken replies all
  proxy through it, so the user needs no API key of any kind. See
  [Hosted API](./hosted-api.md).
- **`cloud`** — OpenRouter with the user's own API key.
- **`custom`** — any OpenAI-compatible server they run (Ollama, LM Studio,
  vLLM). Their address, their model name, key optional. Chat and analysis go
  there; speech-to-text still uses Groq and cloud speech still uses
  OpenRouter, because local servers do not provide either. Small local models
  frequently cannot honour the strict `json_schema` output this app requires,
  so the analysis, coach and tokenization passes may fail where chat succeeds.

The resolvers never fall back between them. An unusable configuration returns
the reason, which the UI shows: a request the user asked to send to their own
machine must not silently go to a paid cloud instead.

## Versioning

`src-tauri/Cargo.toml` is the **single source of truth** for the app version.
`tauri.conf.json` omits `version` so Tauri inherits it from there, `package.json`
is private and carries none, and Android's `versionName`/`versionCode` are
derived from it at build time.

```powershell
node scripts/release.mjs minor --dry-run   # see the plan, change nothing
node scripts/release.mjs minor             # bump, commit, tag, push
```

One command, taking `patch`, `minor`, `major`, or an explicit version
(`1.0.0-rc.1`). It writes the version, updates `Cargo.lock`, commits, tags and
pushes — in that order, because **the release workflow reads the version out of
`Cargo.toml` as of the tagged commit** and refuses to build if it disagrees
with the tag. A tag made before the bump is committed names a commit still
carrying the old version, and the build stops at the `version` job.

Most of the script is refusals, checked before anything is written:

| It stops if | Because |
|---|---|
| the tree is dirty | a commit named `v1.2.3` should carry the bump and nothing else |
| you are not on `main` | releases are cut from the default branch |
| the remote is ahead | the push would fail, or race someone else's work |
| the version would not increase | the updater compares versions to decide what to offer |
| the tag already exists | a pushed tag cannot be moved — it prints the delete commands |

After tagging it re-reads `Cargo.toml` *out of the tag* and aborts before
pushing unless it matches. That is the same check the `version` job makes, done
locally in milliseconds instead of costing a push that has to be undone on the
remote.

The version arithmetic lives in `scripts/version.mjs` and is unit-tested
(`scripts/version.test.mjs`) — prerelease ordering and "1.10 is newer than 1.9"
are exactly the kind of thing that looks obvious and is wrong.

## In-app updates

Desktop builds update themselves. On launch the app asks the update feed
whether a newer version exists and, if so, offers it in a dismissible bar at
the top of the window; Settings → Updates has a manual "Check for updates"
that reports "you are running the newest version" as well as offering an
install.

- **Feed:** `latest.json`, attached to the newest **published** GitHub release
  by `tauri-action`'s `includeUpdaterJson`. Draft releases do not serve assets
  publicly, so publishing a release is what ships it to existing installs.
- **Signing:** updates carry their own signature, separate from OS code
  signing. `bundle.createUpdaterArtifacts` is on and `plugins.updater.pubkey`
  holds the public half; CI signs with `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Without them the installers still build
  but the updater artifacts are skipped, and **`tauri build` prints that as an
  error yet exits 0** — so the release job asserts `.sig` files exist rather
  than trusting the exit code.
- **Coverage:** Windows (NSIS/MSI), macOS, and Linux **AppImage** update in
  place. `.deb` and `.rpm` do not — those update through the package manager,
  so the arm64 Linux build (deb only) has no in-app update path.
- **Mobile checks but cannot install.** Neither Android nor iOS lets an app
  rewrite itself, so there is no in-place updater. The app still asks GitHub
  for the newest published release on launch (through the Rust core, because
  `connect-src` does not let the webview reach api.github.com) and offers to
  open it — the user installs the package themselves. Being told you are out
  of date is the part that matters; only the remedy differs.
- **Android upgrade paths:** Play Store handles it automatically once the app
  is listed. Sideloaded APKs install over the top provided the signing key
  matches and `versionCode` rose — Tauri derives that from the semver version
  (`0.1.0` → `1000`), so it always does. Users who want automation can point
  [Obtainium](https://github.com/ImranR98/Obtainium) at the repo's releases.
  CI signs with the upload keystore (`ANDROID_KEYSTORE_BASE64` and friends),
  so every build upgrades cleanly over the last. The `.aab` is for Play, which
  splits it per device; the universal `.apk` is for sideloading.
- **iOS upgrade paths:** App Store or TestFlight only. Apple forbids apps
  downloading and executing new code, so a self-updater is not merely
  unsupported but grounds for rejection.

## Releases (CI)

`.github/workflows/release.yml` fires on any `v*` tag and attaches every
artifact to a single **draft** GitHub Release — nothing ships until you review
the assets and press Publish.

| Job | Runner | Artifact |
|---|---|---|
| Windows x64 | `windows-latest` | NSIS installer + MSI |
| macOS Apple Silicon | `macos-latest` | `.dmg` (aarch64) |
| macOS Intel | `macos-latest` | `.dmg` (x86_64 cross-compiled) |
| Linux x64 | `ubuntu-22.04` | `.deb`, AppImage, `.rpm` |
| Linux arm64 | `ubuntu-22.04-arm` | `.deb` |
| Android | `ubuntu-latest` | universal release-signed `.apk` + `.aab` |
| iOS | `macos-latest` | signed `.ipa` (TestFlight or ad hoc) |

Known gaps, deliberately deferred:

- **Nothing is signed.** Windows SmartScreen and macOS Gatekeeper both warn on
  first launch (macOS: right-click → Open). Fixing this needs a Windows
  Authenticode certificate and an Apple Developer ID + notarization.
- **The APK is debug-signed.** It sideloads fine, but Play Store upload needs a
  release keystore held in repo secrets.
- **arm64 Linux is `.deb` only** — AppImage tooling on aarch64 needs its own pass.

The Android job cannot use the committed `gen/android` as-is: Tauri's
`tauri.settings.gradle` hardcodes an absolute path into the local cargo
registry, so it is gitignored and must be regenerated. CI therefore runs
`tauri android init` and then `git checkout -- src-tauri/gen/android` to put
back everything git tracks, since `init` rewrites the manifest, themes,
`MainActivity.kt`, `BuildTask.kt` and the launcher icons from its templates.

## Target matrix

| Platform | Status | Artifact | Notes |
|---|---|---|---|
| Windows 10/11 x64 | **Built in CI** | NSIS installer + MSI | Primary dev machine; unsigned |
| macOS aarch64 | **Built in CI** | `.dmg` | Unsigned — Gatekeeper warns |
| macOS x86_64 | **Built in CI** | `.dmg` | Cross-compiled on `macos-latest`; unsigned |
| Linux x86_64 | **Built in CI** | deb / AppImage / rpm | webkit2gtk-4.1 dep |
| Linux aarch64 | **Built in CI** | deb | AppImage on arm64 still to do |
| Android | **Built in CI** | universal `.apk` + `.aab` | Release-signed with the upload key |
| iOS | **Built & signed in CI** | `.ipa` | Voice via the core recorder; TestFlight or ad hoc |
| Browser (no Rust) | Intentionally non-functional | — | `App.tsx` shows a "run via tauri dev" notice |

## Desktop (today)

```powershell
# dev
npm install
npm run tauri dev      # vite :1420 strict port + cargo debug build

# installer
npm run tauri build    # → src-tauri/target/release/bundle/...
```

- `tauri.conf.json`: window 1200×800 (min 900×620), `beforeBuildCommand` runs
  `tsc && vite build`, `frontendDist: ../dist`.
- Release: `strip = true`, `lto = true`.
- Icons: png 32/128/256/512 + `.ico` + `.icns`, plus Android launcher icons at
  every density and an adaptive icon (`mipmap-anydpi-v26`).
- Capabilities: desktop `core:default` + `log:default`
  (`capabilities/default.json` — schema path is `gen/schemas/desktop-schema.json`).

## Mobile — the concrete path (Tauri v2)

### Android — **working** (Aug 2026)

Scaffolded (`tauri android init` → `src-tauri/gen/android`), manifest has
`RECORD_AUDIO` + `adjustResize`, and a debug APK builds. Verified recipe
(Windows; env vars are per-shell):

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME     = "$env:LOCALAPPDATA\Android\Sdk\ndk\27.0.11902837"
$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"   # NOT the Oracle shim
npx tauri android build --apk --debug --target aarch64
# → src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Machine-specific fixes that live in the repo (do not lose them):

1. **`reqwest` uses `rustls-tls`** (`default-features = false`) — native-tls/
   OpenSSL cannot cross-compile to Android.
2. **`lib.rs::run()` carries `#[cfg_attr(mobile, tauri::mobile_entry_point)]`**
   — without it the `.so` fails symbol validation at packaging time.
3. **`gen/android/buildSrc/.../BuildTask.kt`** wraps npm in `cmd /c` — the
   default ProcessBuilder spawn of `npm`/`npm.cmd`/`npm.bat` fails on
   nvm-for-Windows setups. Re-apply if `gen/android` is ever regenerated.
4. `index.html` viewport has `viewport-fit=cover`; safe-area padding on
   topbar/composer; touch-action manipulation (see `styles.css`).

Debug APK sideloads fine (GrapheneOS: Settings → Apps → Install unknown
apps, or just tap the APK). For live dev on a connected phone:
`npx tauri android dev`. Release APK (`--release`, ~smaller) needs a signing
key — debug key is auto-generated, release is not.

### iOS — **built & signed in CI** (voice in via the core recorder)

iOS cannot be built on Windows at all — Tauri's `ios` subcommand does not even
exist in the Windows CLI, and Xcode does the signing. Everything happens on a
`macos-latest` runner.

- **Scaffold + build:** `.github/workflows/ios-distribute.yml` runs
  `npx tauri ios init` (→ `src-tauri/gen/apple`, gitignored), imports the
  signing identity + provisioning profile, and archives/exports a **signed
  `.ipa`** via `xcodebuild archive` + `-exportArchive`. It fires on a `v*`
  tag and on demand (`workflow_dispatch` — choose `app-store-connect` for
  TestFlight or `ad-hoc` for direct device install).
- **Signing:** needs an **Apple Distribution** certificate (NOT the
  "Developer ID Application" cert used for macOS) and a provisioning profile
  for `com.freemocap.skellyspeak`. Both live in repo secrets
  (`IOS_CERTIFICATE_P12`, `IOS_CERTIFICATE_PASSWORD`,
  `IOS_PROVISION_PROFILE`); the workflow extracts the profile name at runtime,
  so there is no extra variable to keep in sync.
- **Voice input:** iOS is a WKWebView, so it has no `navigator.mediaDevices`
  for the same reason macOS does not — and Android is now the *only* platform
  that records in the webview. Desktop and iOS both record in the core with
  cpal (`mic_native` returns true on iOS). On iOS the recorder first configures
  `AVAudioSession` (category playAndRecord, mode measurement, activated) via
  `objc2-av-foundation`, then captures with the same cpal + hound WAV path as
  desktop. `NSMicrophoneUsageDescription` is already in `src-tauri/Info.plist`.
- **Layout:** same narrow-viewport work; also safe-area insets.
- **Keys on mobile:** settings.json lands in the app sandbox config dir —
  works, but review R12 (keychain) with mobile in mind.

### Shared mobile concerns
- **Streaming:** SSE via reqwest works on both, but verify streaming
  `Channel<GuidedEvent>` latency in mobile webviews.
- **App size:** reqwest+tokio+tauri is fine; Whisper stays server-side, so no
  native ML weight.
- **Networking & CSP:** revisit `csp: null` (R13) before shipping any mobile
  build; store keys via secure storage (R12).

## Distribution posture (proposal)

1. **Now:** GitHub Releases with per-OS artifacts from CI; no auto-update.
2. **Next:** Tauri updater plugin (signed updates) once we have stable
   versioning.
3. **Mobile:** TestFlight (iOS) + direct APK then Play Store (Android) when
   the scaffold lands; each needs their privacy/permission declarations
   (mic usage strings, data-safety forms — note: audio leaves the device to
   Groq/OpenRouter).

## Docs site (this folder)

- Docusaurus 3.9 + `@freemocap/skellydocs` theme + mermaid.
- `npm install && npm start` inside `skellyspeak-docs/` to develop;
  `npm run build` to emit static site.
- **Deploy config is placeholder** (`docusaurus.config.ts`: `url:
  https://github.com`, `baseUrl: /skellyspeak/`). For GitHub Pages:
  the site is served at `https://docs.freemocap.org/skellyspeak/` (`url:
  https://docs.freemocap.org`, `baseUrl: /skellyspeak/`) by
  a Pages workflow (or point it at a custom domain).
- Sidebar is autogenerated (`sidebars.ts`); docs are ordered by
  `sidebar_position`: intro → overview → architecture → ontology → status →
  platforms.
