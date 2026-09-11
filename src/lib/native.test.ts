import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ call: vi.fn(), diagnostic: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.call }))
vi.mock('./log', () => ({ logDiagnostic: mocks.diagnostic }))
import { invoke } from './native'
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
