/// Update checking, on every platform.
///
/// Both platforms check; they differ in what they can DO about it.
///
///  - Desktop swaps its own binary, via Tauri's updater against `latest.json`
///    on the newest published GitHub release. `kind: 'install'`.
///  - Mobile cannot: neither Android nor iOS lets an app rewrite itself, so
///    the check asks GitHub for the newest release and offers to open it.
///    The user installs the APK themselves. `kind: 'download'`.
///
/// Either way an out-of-date install is TOLD it is out of date, which is the
/// part that matters. Only the remedy differs.

import { invoke, isTauri } from './tauri'
import { isNewer } from './semver'
import { logInfo } from './log'

interface Common {
  version: string
  currentVersion: string
  notes: string
}

/// Desktop: download, install, then restart.
export interface InstallableUpdate extends Common {
  kind: 'install'
  install: (onProgress?: (downloaded: number, total: number | null) => void) => Promise<void>
}

/// Mobile: open the release so the user can install it.
export interface DownloadableUpdate extends Common {
  kind: 'download'
  url: string
  open: () => Promise<void>
}

export type UpdateOffer = InstallableUpdate | DownloadableUpdate

/// True where the app can install an update itself. False on mobile, where the
/// OS package manager owns installation.
export function canSelfUpdate(): boolean {
  if (!isTauri) return false
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  const ua = navigator.userAgent
  return !(
    /Android/i.test(ua) ||
    /iPhone|iPad|iPod/i.test(ua) ||
    /Android/i.test(platform ?? '')
  )
}

interface LatestRelease {
  version: string
  url: string
  notes: string
}

/// Ask what is available. Resolves to null when this build is already current.
/// Throws on any failure — an unreachable server is a real problem, and an app
/// that looks current because it never managed to ask is the worst outcome.
export async function checkForUpdate(): Promise<UpdateOffer | null> {
  if (!isTauri) throw new Error('Update checks need the desktop or mobile app.')
  return canSelfUpdate() ? checkDesktop() : checkMobile()
}

async function checkDesktop(): Promise<InstallableUpdate | null> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) {
    logInfo('[updater] desktop: already current')
    return null
  }
  logInfo(`[updater] desktop: ${update.currentVersion} -> ${update.version}`)
  return {
    kind: 'install',
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? '',
    install: async (onProgress) => {
      let downloaded = 0
      let total: number | null = null
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? null
        else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          onProgress?.(downloaded, total)
        } else if (event.event === 'Finished') onProgress?.(total ?? downloaded, total)
      })
      logInfo('[updater] desktop: staged, awaiting restart')
    },
  }
}

async function checkMobile(): Promise<DownloadableUpdate | null> {
  const { getVersion } = await import('@tauri-apps/api/app')
  const currentVersion = await getVersion()
  // The core makes this call: connect-src does not let the webview reach
  // api.github.com, and widening it for one call widens it for all of them.
  const latest = await invoke<LatestRelease>('latest_github_release')
  if (!isNewer(latest.version, currentVersion)) {
    logInfo(`[updater] mobile: ${currentVersion} is current (newest ${latest.version})`)
    return null
  }
  logInfo(`[updater] mobile: ${currentVersion} -> ${latest.version} available`)
  return {
    kind: 'download',
    version: latest.version,
    currentVersion,
    notes: latest.notes,
    url: latest.url,
    open: async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(latest.url)
    },
  }
}

/// Restart into the freshly installed version. Desktop only — nothing else
/// stages an update in place.
export async function restartIntoUpdate(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
