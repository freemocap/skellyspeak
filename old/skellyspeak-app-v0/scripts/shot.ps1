# Capture a running SkellySpeak window to PNG.
#
# Why this and not a browser: the UI only works inside the Tauri webview —
# outside it there is no IPC, so a browser would need a mocked backend, and a
# mock is exactly the independently-maintained second layer that makes
# observability untrustworthy. This captures the REAL window instead.
#
#   ./scripts/shot.ps1                     # main window
#   ./scripts/shot.ps1 -Title observability # the popped-out dev window
#   ./scripts/shot.ps1 -Out shots/graph.png

param(
  [string]$Title = "",
  [string]$Out = "$env:TEMP\skellyspeak-shot.png"
)

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinShot {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public struct RECT { public int L, T, R, B; }
}
"@

$procs = Get-Process skellyspeak -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 }
if (-not $procs) { Write-Error "no SkellySpeak window found - is 'npm run tauri dev' running?"; exit 1 }

$p = if ($Title) {
  $procs | Where-Object { $_.MainWindowTitle -like "*$Title*" } | Select-Object -First 1
} else {
  $procs | Select-Object -First 1
}
if (-not $p) { Write-Error "no SkellySpeak window matching '$Title'"; exit 1 }

[void][WinShot]::SetForegroundWindow($p.MainWindowHandle)
Start-Sleep -Milliseconds 700   # let it paint after raise

$r = New-Object WinShot+RECT
[void][WinShot]::GetWindowRect($p.MainWindowHandle, [ref]$r)
$w = $r.R - $r.L
$h = $r.B - $r.T

$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Output "$($p.MainWindowTitle) : ${w}x${h} -> $Out"
