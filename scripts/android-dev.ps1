# Launch SkellySpeak on the Android emulator with hot reload.
# Usage: .\scripts\android-dev.ps1
$ErrorActionPreference = "Stop"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$ndk = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$env:NDK_HOME = $ndk.FullName
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
$emu = "$env:ANDROID_HOME\emulator\emulator.exe"

$running = & $adb devices | Out-String
if ($running -notmatch "emulator-") {
    Write-Host "Starting emulator (skellyspeak_test)..."
    Start-Process -FilePath $emu -ArgumentList "-avd", "skellyspeak_test", "-no-boot-anim", "-no-snapshot"
    # Wait for the device to come online. adb prints "device offline" noise
    # to stderr during early boot — route through cmd so PowerShell 5.1
    # doesn't mistake it for a terminating error.
    do {
        Start-Sleep -Seconds 3
        $state = cmd /c "$adb devices 2>nul" | Out-String
    } while ($state -notmatch "emulator-\d+\s+device")
    do {
        Start-Sleep -Seconds 3
        $boot = cmd /c "$adb shell getprop sys.boot_completed 2>nul" | Out-String
        $boot = $boot.Trim()
    } while ($boot -ne "1")
    Write-Host "Emulator ready."
}

Write-Host "Starting SkellySpeak dev loop (Ctrl+C to stop)..."
npx tauri android dev
