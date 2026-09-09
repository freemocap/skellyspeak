// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { STEER_LEVELS, useSteering, type ConversationPractice } from './useSteering'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/tauri', () => ({ invoke: backend.invoke }))
beforeEach(() => { vi.resetAllMocks(); localStorage.clear() })

it.each(STEER_LEVELS)('saves $value for the selected conversation', async ({ value }) => {
  backend.invoke.mockResolvedValueOnce({ revision: 0, difficulty: 'beginner' }).mockResolvedValueOnce({ revision: 1, difficulty: value })
  const view = renderHook(() => useSteering('es-ES', 'en', 'juan-chat'))
  await waitFor(() => expect(view.result.current.ready).toBe(true))
  await act(async () => view.result.current.setLevel(value))
  expect(backend.invoke).toHaveBeenLastCalledWith('save_conversation_practice', { target: 'es-ES', native: 'en', chatId: 'juan-chat', expectedRevision: 0, difficulty: value })
  expect(view.result.current.level).toBe(value)
})

it('isolates conversations in the same language and ignores a delayed save from another chat', async () => {
  let finish: (value: ConversationPractice) => void = () => { throw new Error('No save') }
  backend.invoke.mockImplementation(async (command: string, args: { chatId: string }) => {
    if (command === 'save_conversation_practice') return new Promise<ConversationPractice>(resolve => { finish = resolve })
    return { revision: 0, difficulty: args.chatId === 'juan' ? 'zero' : 'advanced' }
  })
  const view = renderHook(({ chat }) => useSteering('es-ES', 'en', chat), { initialProps: { chat: 'juan' } })
  await waitFor(() => expect(view.result.current.level).toBe('zero'))
  let saved = Promise.resolve()
  act(() => { saved = view.result.current.setLevel('fluent') })
  view.rerender({ chat: 'marta' })
  expect(view.result.current.level).toBe('')
  await waitFor(() => expect(view.result.current.level).toBe('advanced'))
  await act(async () => { finish({ revision: 1, difficulty: 'fluent' }); await saved })
  expect(view.result.current.level).toBe('advanced')
})

it('surfaces load errors and supports an explicit retry', async () => {
  backend.invoke.mockRejectedValueOnce(new Error('Cannot read settings')).mockResolvedValueOnce({ revision: 0, difficulty: 'zero' })
  const view = renderHook(() => useSteering('es-ES', 'en', 'juan'))
  await waitFor(() => expect(view.result.current.error).toContain('Cannot read settings'))
  expect(view.result.current.ready).toBe(false)
  act(() => view.result.current.reload())
  await waitFor(() => expect(view.result.current.ready).toBe(true))
})
