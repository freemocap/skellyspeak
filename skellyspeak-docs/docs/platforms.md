---
sidebar_position: 6
title: Platforms & Build
---

# Platforms & Build

Current reality: **Windows desktop dev works locally, and CI builds and
publishes every desktop target plus Android on a version tag.** iOS is the one
gap. The foundation is mobile-shaped — `Cargo.toml` builds `staticlib` +
`cdylib` + `rlib` (`src-tauri/Cargo.toml:9`), all heavy work lives in the Rust
core, and the frontend is plain React that runs in any webview.

## Versioning

`src-tauri/Cargo.toml` is the **single source of truth** for the app version.
`tauri.conf.json` omits `version` so Tauri inherits it from there, `package.json`
is private and carries none, and Android's `versionName`/`versionCode` are
derived from it at build time.

```powershell
npm run set-version 0.2.0 -- --tag   # rewrites Cargo.toml + Cargo.lock, tags v0.2.0
git commit -am "v0.2.0"
git push && git push origin v0.2.0   # the tag is what triggers the release
```

The release workflow refuses to run if the tag and `Cargo.toml` disagree.

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
| Android | `ubuntu-latest` | universal debug-signed `.apk` |

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
| Android | **Built in CI** | universal `.apk` | Debug-signed; release keystore still to do |
| iOS | Compiles, not shippable | — | Simulator smoke build only; needs Apple Developer account |
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

### iOS

`.github/workflows/ios-smoke.yml` (manual trigger) scaffolds the Xcode project
on a CI Mac and builds for the simulator unsigned, which is as far as this can
go for free — an unsigned `.ipa` installs nowhere. It is deliberately kept out
of the release workflow so a broken iOS toolchain never blocks a release.

To actually ship:

1. **Prereqs:** a Mac with Xcode, Apple Developer account (for device +
   TestFlight; simulator is free). Rust target `aarch64-apple-ios`.
2. **Scaffold:** `npm run tauri ios init` → `src-tauri/gen/apple` (Xcode
   project). This cannot be done from the Windows dev machine.
3. **Permissions:** `NSMicrophoneUsageDescription` in the generated
   `Info.plist`.
4. **STT format risk (the big one):** WKWebView `MediaRecorder` support lags;
   iOS typically yields `audio/mp4` (AAC). `transcribe_audio` hardcodes
   filename `audio.webm` + mime `audio/webm` (`commands.rs:670-673`). Fix:
   pass the blob's MIME type up from `GuidedPage.toggleMic` and set
   filename/mime accordingly (Groq accepts m4a/mp3/mp4/webm/wav/ogg).
5. **Layout:** same narrow-viewport work; also safe-area insets.
6. **Keys on mobile:** settings.json lands in the app sandbox config dir —
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
  set `url: https://freemocap.github.io`, keep `baseUrl: /skellyspeak/`, and add
  a Pages workflow (or point it at a custom domain).
- Sidebar is autogenerated (`sidebars.ts`); docs are ordered by
  `sidebar_position`: intro → overview → architecture → ontology → status →
  platforms.
