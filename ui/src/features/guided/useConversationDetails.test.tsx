// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../../contracts'
import { useConversationDetails } from './useConversationDetails'
import { executeAction, readWorkspace } from '../../platform/ipc/workspace'
vi.mock('../../platform/ipc/workspace', () => ({ readWorkspace: vi.fn(), executeAction: vi.fn(), nativeError: String }))
const settings = { difficulty: 'beginner', translation: false, speechVoice: 'voice', explanationLanguage: 'en' }
const directory = { sessionId: 'session', conversations: [{ id: 'chat', settingsRevision: 4, settings }], personas: [], contacts: [] } as unknown as Snapshot
beforeEach(() => { vi.clearAllMocks(); vi.mocked(readWorkspace).mockResolvedValue(directory) })

it('only observes on mount; saves scoped settings and waits before admitting the next send', async () => {
  let resolve!: () => void
  vi.mocked(executeAction).mockImplementation(() => new Promise(done => { resolve = () => done({ actionId: 'a', entityId: 'chat', revision: 5 }) }))
  const hook = renderHook(() => useConversationDetails('chat', 1))
  await waitFor(() => expect(hook.result.current.conversation).toBeDefined())
  expect(executeAction).not.toHaveBeenCalled()
  let saving!: Promise<void>
  act(() => { saving = hook.result.current.saveDifficulty('fluent') })
  await waitFor(() => expect(executeAction).toHaveBeenCalledExactlyOnceWith(directory, { kind: 'updateSettings', conversationId: 'chat', expectedRevision: 4, settings: { ...settings, difficulty: 'fluent' } }))
  let passed = false
  const sendBarrier = hook.result.current.beforeSend().then(() => { passed = true })
  expect(passed).toBe(false)
  await act(async () => { resolve(); await saving; await sendBarrier })
  expect(passed).toBe(true)
})
it('rejects changed settings without overwriting them or retrying', async () => {
  const hook = renderHook(() => useConversationDetails('chat', 1))
  await waitFor(() => expect(hook.result.current.conversation).toBeDefined())
  vi.mocked(readWorkspace).mockResolvedValue({ ...directory, conversations: [{ ...directory.conversations[0], settingsRevision: 9 }] })
  await act(async () => { await expect(hook.result.current.saveDifficulty('advanced')).rejects.toThrow('settings changed') })
  expect(executeAction).not.toHaveBeenCalled()
  expect(hook.result.current.error).toContain('settings changed')
})
