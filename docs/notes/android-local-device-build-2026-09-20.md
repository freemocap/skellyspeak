# Local Android developer build — September 20, 2026

## Built and verified

Built the current working tree, including existing uncommitted changes, as an
ARM64 standalone debug APK for the connected Pixel 9 Pro XL. No commits,
release publication or server deployment were performed.

- APK: `native/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
- Package: `com.freemocap.skellyspeak.dev`; label: **Dev-SkellySpeak**; version: 2.0.6 (2000006).
- SHA-256: `588d9dd1fc631d4000863c18ac42e3f38979d9c093e82bce741e756114c7184b`.
- Frontend TypeScript/Vite build, Rust Android compilation, Gradle packaging and
  APK signature verification passed. ARM64 native library is present.
- Used `android build --debug`, not the live `android dev` server. The UI is
  bundled; AI operations still require an independently reachable provider/service.
- ADB installation and activity launch succeeded. Both official 2.0.4 and developer
  2.0.6 remain installed. The developer process is running and no ADB reverse
  forwarding is configured. Visual startup verification awaits phone unlock.

## Local machine setup

Installed Android command-line tools, SDK platform 36, build tools 35.0.0,
platform tools and NDK 27.2.12479018 under `~/Android/Sdk`; installed a local
Temurin JDK 17 under `~/Android/jdk-17` and Rust Android targets through rustup.
The existing system Java installation lacked a compiler.

The ignored `.local/android/env.sh` selects these tools and existing Node 24.16.0.
Run `bash .local/android/build.sh` from the repository root to rebuild.
The script derives Android version metadata from `native/Cargo.toml` into an
ignored build config, following the release workflow's stamping approach.

Tauri Android initialization generated machine-local files. All tracked Android
customizations were restored from a pre-initialization file snapshot before the
subsequent developer-variant changes. Other existing working-tree changes were preserved.

## Separate installation implemented

The initial standard-identity debug APK could not update the release-signed app.
The user requested a secondary install instead; no uninstall was performed.

`native/tauri.android-dev.conf.json` opts into Tauri's supported Android debug
application ID suffix `.dev`. Tauri synchronizes that suffix into the Gradle
build file; setting it only in Gradle does not work because the CLI rewrites it.
`SKELLYSPEAK_ANDROID_DEV_APP=1` selects the developer launcher label in the debug
build type. Release labels and identity remain unchanged. The local build script
passes both the developer overlay and the version-stamping config.

The FileProvider authority follows `${applicationId}` and uses the runtime package
name in Kotlin. Existing Kotlin namespace/JNI names remain unchanged. Android
assigns the developer app its own private data directory and credentials.

Both apps currently register `skellyspeak://auth`. Android may prompt for an app
when completing browser sign-in; choose Dev-SkellySpeak for a developer sign-in.
Authentication and live AI calls were not tested during installation.
