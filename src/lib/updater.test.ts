import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkForUpdate, restartIntoUpdate } from './updater'
import { invoke } from './tauri'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

vi.mock('./tauri', () => ({ isTauri: true, invoke: vi.fn() }))
vi.mock('./log', () => ({ logInfo: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.4.6' }))

describe('native update channels', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not call the updater or GitHub for iOS', async () => {
    vi.mocked(invoke).mockResolvedValue('app-store')
    expect(await checkForUpdate()).toBeNull()
    expect(invoke).toHaveBeenCalledExactlyOnceWith('get_update_channel')
    expect(check).not.toHaveBeenCalled()
  })

  it('uses the desktop updater on desktop', async () => {
    vi.mocked(invoke).mockResolvedValue('install')
    vi.mocked(check).mockResolvedValue(null)
    expect(await checkForUpdate()).toBeNull()
    expect(check).toHaveBeenCalledOnce()
  })

  it('offers GitHub downloads on Android without the updater plugin', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('download').mockResolvedValueOnce({
      version: '0.5.0', url: 'https://github.com/freemocap/skellyspeak/releases/tag/v0.5.0', notes: '',
    })
    expect(await checkForUpdate()).toMatchObject({ kind: 'download', version: '0.5.0' })
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
})
