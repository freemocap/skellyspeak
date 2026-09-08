const DOWNLOAD_URL = 'https://docs.freemocap.org/skellyspeak/download'
/// Desktop installs signed updates; Android links to the download page.
/// iOS updates are delivered by TestFlight or the App Store.

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

/// Mobile: open the docs download page so the user can install it.
export interface DownloadableUpdate extends Common {
  kind: 'download'
  url: string
  open: () => Promise<void>
}

export type UpdateOffer = InstallableUpdate | DownloadableUpdate

export type UpdateChannel = 'install' | 'download' | 'app-store' | 'development'

export async function getUpdateChannel(): Promise<UpdateChannel> {
  if (!isTauri) throw new Error('Update checks need the desktop or mobile app.')
  const channel = await invoke<string>('get_update_channel')
  if (channel !== 'install' && channel !== 'download' && channel !== 'app-store' && channel !== 'development') {
    throw new Error(`Unknown update channel: ${channel}`)
  }
  return channel
}

interface LatestRelease {
  version: string
  url: string
  notes: string
}

/// Returns an update offer, or null when current or managed by the App Store.
/// Throws on any failure — an unreachable server is a real problem, and an app
/// that looks current because it never managed to ask is the worst outcome.
export async function checkForUpdate(): Promise<UpdateOffer | null> {
  const channel = await getUpdateChannel()
  if (channel === 'app-store' || channel === 'development') return null
  return channel === 'install' ? checkDesktop() : checkMobile()
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
    url: DOWNLOAD_URL,
    open: async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(DOWNLOAD_URL)
    },
  }
}

/// Restart into the freshly installed version. Desktop only — nothing else
/// stages an update in place.
export async function restartIntoUpdate(): Promise<void> {
  if (await getUpdateChannel() !== 'install') {
    throw new Error('Only desktop builds can restart into an installed update.')
  }
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
