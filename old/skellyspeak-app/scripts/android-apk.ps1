# Build the Android debug APK (arm64) and copy it to .build-artifacts\skellyspeak.apk
# Usage: .\scripts\android-apk.ps1
$ErrorActionPreference = "Stop"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$ndk = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$env:NDK_HOME = $ndk.FullName
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

npx tauri android build --apk --debug --target aarch64
New-Item -ItemType Directory -Force .build-artifacts | Out-Null
Copy-Item "src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk" ".build-artifacts\skellyspeak.apk" -Force
Write-Host "APK ready: .build-artifacts\skellyspeak.apk"
