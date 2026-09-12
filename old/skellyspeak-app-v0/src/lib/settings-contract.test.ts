// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => backend)
vi.mock('./log', () => ({ logDebug: vi.fn(), logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }))
import { getSettings, saveSettings } from './tauri'
import type { Settings } from '../types'

beforeEach(() => backend.invoke.mockReset())

it('rejects an older native settings response before undefined volumes reach sliders', async () => {
  backend.invoke.mockResolvedValue({ reward_sounds: 'yes' })
  await expect(getSettings()).rejects.toThrow('Settings response is missing the required field: master_volume.')
})

it('preserves valid zero and independent channel values', async () => {
  const settings = { master_volume: 0, voice_volume: 45, effects_volume: 90 }
  backend.invoke.mockResolvedValue(settings)
  expect(await getSettings()).toEqual(settings)
})

it.each([undefined, null, NaN, -1, 101, 25.5])('rejects invalid volume %s before saving to native storage', async volume => {
  const settings = { master_volume: volume, voice_volume: 100, effects_volume: 100 } as Settings
  await expect(saveSettings(settings)).rejects.toThrow()
  expect(backend.invoke).not.toHaveBeenCalled()
})
