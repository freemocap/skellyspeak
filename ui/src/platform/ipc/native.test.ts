import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ call: vi.fn(), diagnostic: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.call }))
vi.mock('../diagnostics/log', () => ({ logDiagnostic: mocks.diagnostic }))
import { invoke } from './native'
beforeEach(() => vi.resetAllMocks())
it('records confirmed caller cancellations as info while retaining failures', async () => {
  const controller = new AbortController()
  controller.abort()
  const failure = { code: 'conflict', diagnostics: { error: { diagnostics: { reason: 'cancelled' } } } }
  mocks.call.mockRejectedValue(failure)
  await expect(invoke('run_reading', { id: 'reading' }, controller.signal)).rejects.toBe(failure)
  expect(mocks.diagnostic).toHaveBeenLastCalledWith('application', failure, undefined, 'native_command_failed', 'info', { command: 'run_reading' })
  await expect(invoke('run_reading', { id: 'reading' })).rejects.toBe(failure)
  expect(mocks.diagnostic).toHaveBeenLastCalledWith('application', failure, undefined, 'native_command_failed', 'error', { command: 'run_reading' })
  const changed = { code: 'conflict', diagnostics: { error: { diagnostics: { reason: 'access_changed' } } } }
  mocks.call.mockRejectedValue(changed)
  await expect(invoke('run_reading', { id: 'reading' }, controller.signal)).rejects.toBe(changed)
  expect(mocks.diagnostic).toHaveBeenLastCalledWith('application', changed, undefined, 'native_command_failed', 'error', { command: 'run_reading' })
})
it('persists a command failure before the caller receives the original rejection', async () => {
  const failure = { code: 'validation', message: 'PRIVATE' }
  mocks.call.mockRejectedValue(failure)
  let ack!: (value: boolean) => void
  mocks.diagnostic.mockReturnValue(new Promise(resolve => { ack = resolve }))
  let caught = false
  const request = invoke('mic_start', { conversationId: 'PRIVATE' }).catch(error => { caught = true; return error })
  await Promise.resolve()
  expect(caught).toBe(false)
  expect(mocks.diagnostic).toHaveBeenCalledWith('microphone', failure, undefined, 'native_command_failed', 'error', { command: 'mic_start' })
  ack(true)
  expect(await request).toBe(failure)
})
