import { openUrl } from '@tauri-apps/plugin-opener'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, restartIntoUpdate } from './updater'
import { invoke } from './ipc/tauri'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

vi.mock('./ipc/tauri', () => ({ isTauri: true, invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
vi.mock('./diagnostics/log', () => ({ logInfo: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.4.6' }))

describe('native update channels', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not call the updater or GitHub for iOS', async () => {
    vi.mocked(invoke).mockResolvedValue('app-store')
    expect(await checkForUpdate()).toMatchObject({ kind: 'unmanaged', currentVersion: '0.4.6', reason: expect.stringContaining('App Store') })
    expect(invoke).toHaveBeenCalledExactlyOnceWith('get_update_channel')
    expect(check).not.toHaveBeenCalled()
  })

  it('uses the desktop updater on desktop', async () => {
    vi.mocked(invoke).mockResolvedValue('install')
    vi.mocked(check).mockResolvedValue(null)
    expect(await checkForUpdate()).toEqual({ kind: 'current', currentVersion: '0.4.6' })
    expect(check).toHaveBeenCalledOnce()
  })

  it('reports an Android install that already has the newest release as current', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('download').mockResolvedValueOnce({
      version: '0.4.6', url: 'https://github.com/freemocap/skellyspeak/releases/tag/v0.4.6', notes: '',
    })
    expect(await checkForUpdate()).toEqual({ kind: 'current', currentVersion: '0.4.6' })
  })

  it('opens the docs download page on Android without the updater plugin', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('download').mockResolvedValueOnce({
      version: '0.5.0', url: 'https://github.com/freemocap/skellyspeak/releases/tag/v0.5.0', notes: '',
    })
    const offer = await checkForUpdate()
    expect(offer).toMatchObject({ kind: 'download', version: '0.5.0', url: 'https://docs.freemocap.org/skellyspeak/download' })
    if (offer?.kind !== 'download') throw new Error('Expected a download offer')
    await offer.open()
    expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://docs.freemocap.org/skellyspeak/download')
    expect(check).not.toHaveBeenCalled()
  })

  it('rejects unknown channels instead of assuming desktop', async () => {
    vi.mocked(invoke).mockResolvedValue('unknown')
    await expect(checkForUpdate()).rejects.toThrow('Unknown update channel')
    expect(check).not.toHaveBeenCalled()
  })

  it('does not restart through the desktop plugin on iOS', async () => {
    vi.mocked(invoke).mockResolvedValue('app-store')
    await expect(restartIntoUpdate()).rejects.toThrow('Only desktop')
    expect(relaunch).not.toHaveBeenCalled()
  })

  it('keeps development builds out of the release updater and says why', async () => {
    vi.mocked(invoke).mockResolvedValue('development')
    expect(await checkForUpdate()).toMatchObject({ kind: 'unmanaged', reason: expect.stringContaining('development build') })
    expect(invoke).toHaveBeenCalledExactlyOnceWith('get_update_channel')
    expect(check).not.toHaveBeenCalled()
  })
})
