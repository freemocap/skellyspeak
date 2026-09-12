# Launch SkellySpeak on the Android emulator with hot reload.
#
# Usage: .\scripts\android-dev.ps1
#        $env:SKELLYSPEAK_AVD = "my_avd"; .\scripts\android-dev.ps1
$ErrorActionPreference = "Stop"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$ndk = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$env:NDK_HOME = $ndk.FullName
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
$emu = "$env:ANDROID_HOME\emulator\emulator.exe"

$avd = if ($env:SKELLYSPEAK_AVD) { $env:SKELLYSPEAK_AVD } else { "skellyspeak_test" }

# How long a cold boot is allowed to take before this gives up and says so.
$bootTimeoutSeconds = 240

$running = & $adb devices | Out-String
if ($running -notmatch "emulator-") {
    # Check the AVD exists BEFORE launching. The emulator exits immediately on
    # an unknown name, and because it runs in its own window that window shuts
    # before anyone can read the error — which used to leave this script
    # waiting for a device that was never going to appear.
    $available = @(& $emu -list-avds | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($available -notcontains $avd) {
        Write-Host ""
        Write-Host "No Android virtual device named '$avd'." -ForegroundColor Red
        Write-Host ""
        if ($available.Count -eq 0) {
            Write-Host "  There are no AVDs at all. Create one in Android Studio:"
            Write-Host "    Tools -> Device Manager -> Create Device"
        } else {
            Write-Host "  Available:"
            $available | ForEach-Object { Write-Host "    $_" }
            Write-Host ""
            Write-Host "  Use one of them for this run:"
            Write-Host "    `$env:SKELLYSPEAK_AVD = '$($available[0])'; npm run android" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "  Or rename it to '$avd' in Android Studio's Device Manager to make it the default."
        }
        Write-Host ""
        exit 1
    }

    Write-Host "Starting emulator ($avd)..."
    # -PassThru so a crash is noticed rather than waited on forever.
    $proc = Start-Process -FilePath $emu -PassThru `
        -ArgumentList "-avd", $avd, "-no-boot-anim", "-no-snapshot"

    $deadline = (Get-Date).AddSeconds($bootTimeoutSeconds)

    # Wait for the device to come online. adb prints "device offline" noise to
    # stderr during early boot — route through cmd so PowerShell 5.1 does not
    # mistake it for a terminating error.
    do {
        Start-Sleep -Seconds 3
        if ($proc.HasExited) {
            Write-Host ""
            Write-Host "The emulator quit immediately (exit code $($proc.ExitCode))." -ForegroundColor Red
            Write-Host "  Run it in this window to see why:"
            Write-Host "    & '$emu' -avd $avd" -ForegroundColor Cyan
            Write-Host ""
            exit 1
        }
        if ((Get-Date) -gt $deadline) {
            Write-Host ""
            Write-Host "The emulator did not come online within $bootTimeoutSeconds seconds." -ForegroundColor Red
            Write-Host "  It may still be booting; check its window, or run 'adb devices'."
            Write-Host ""
            exit 1
        }
        $state = cmd /c "$adb devices 2>nul" | Out-String
    } while ($state -notmatch "emulator-\d+\s+device")

    do {
        Start-Sleep -Seconds 3
        if ((Get-Date) -gt $deadline) {
            Write-Host ""
            Write-Host "The device came online but Android never finished booting" -ForegroundColor Red
            Write-Host "within $bootTimeoutSeconds seconds. Check the emulator window."
            Write-Host ""
            exit 1
        }
        $boot = cmd /c "$adb shell getprop sys.boot_completed 2>nul" | Out-String
        $boot = $boot.Trim()
    } while ($boot -ne "1")

    Write-Host "Emulator ready."
}

Write-Host "Starting SkellySpeak dev loop (Ctrl+C to stop)..."
npx tauri android dev
