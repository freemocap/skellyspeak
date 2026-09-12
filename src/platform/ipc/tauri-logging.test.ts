// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ native: vi.fn(async () => undefined), debug: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.native }))
vi.mock('../diagnostics/log', () => ({ logDebug: mocks.debug, logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }))
import { invoke } from './tauri'

it('records IPC command names without credential or conversation values', async () => {
  await invoke('save_settings', { settings: { openrouter_key: 'private-key', hosted_token: 'private-token' } })
  await invoke('guided_turn', { message: 'private-conversation' })
  const logged = JSON.stringify(mocks.debug.mock.calls)
  expect(logged).toContain('save_settings')
  expect(logged).not.toContain('private-key')
  expect(logged).not.toContain('private-token')
  expect(logged).not.toContain('private-conversation')
})
