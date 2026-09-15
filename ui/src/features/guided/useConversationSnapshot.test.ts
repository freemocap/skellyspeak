// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ChatMessage, ConversationSnapshot } from '../../contracts'
import { watchConversation } from '../../platform/ipc/workspace'
import { mergeConversationPages, useConversationSnapshot } from './useConversationSnapshot'
vi.mock('../../platform/ipc/workspace', () => ({ watchConversation: vi.fn(), nativeError: String }))
const watch = vi.mocked(watchConversation)
function messages(first: number, last: number): ChatMessage[] {
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const sequence = first + index
    return { id: `m${sequence}`, sequence, turnId: `t${Math.ceil(sequence / 2)}`, role: sequence % 2 ? 'user' : 'assistant', text: `Message ${sequence}`, replacesTurnId: null, replacedBy: null } as ChatMessage
  })
}
function page(first: number, last: number, revision = 1, chatId = 'chat'): ConversationSnapshot {
  return { sessionId: 'session', conversationId: chatId, revision, messages: messages(first, last), turns: [], hasOlder: first > 1 } as unknown as ConversationSnapshot
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
beforeEach(() => { vi.resetAllMocks(); watch.mockImplementation(() => new Promise(() => {})) })
it.each([true, false])('recovers an %s initial/read failure only after explicit read retry', async initial => {
  if (!initial) watch.mockResolvedValueOnce(page(1, 2))
  watch.mockRejectedValueOnce(new Error('Read failed'))
  const hook = renderHook(() => useConversationSnapshot('chat'))
  await waitFor(() => expect(hook.result.current.readError).toContain('Read failed'))
  expect(hook.result.current.snapshot?.messages.length ?? 0).toBe(initial ? 0 : 2)
  const calls = watch.mock.calls.length
  await act(async () => { await Promise.resolve() })
  expect(watch).toHaveBeenCalledTimes(calls)
  watch.mockResolvedValueOnce(page(1, 4, 2))
  act(() => hook.result.current.retryRead())
  await waitFor(() => expect(hook.result.current.snapshot?.revision).toBe(2))
  expect(hook.result.current.readError).toBeNull()
  expect(watch).toHaveBeenCalledWith('chat', -1)
})
it('loads bounded older pages, deduplicates split exchanges and retains old history after live updates', async () => {
  const update = deferred<ConversationSnapshot>()
  watch.mockResolvedValueOnce(page(102, 201)).mockImplementationOnce(() => update.promise)
  const hook = renderHook(() => useConversationSnapshot('chat'))
  await waitFor(() => expect(hook.result.current.snapshot?.messages).toHaveLength(100))
  watch.mockResolvedValueOnce(page(2, 101))
  await act(async () => { await hook.result.current.loadOlder() })
  expect(watch).toHaveBeenCalledWith('chat', -1, 102)
  expect(hook.result.current.snapshot?.messages).toHaveLength(200)
  // Advancing the live tail changes page boundaries; refresh back to the revealed floor.
  watch.mockResolvedValueOnce(page(4, 103, 2)).mockResolvedValueOnce(page(1, 3, 2))
  await act(async () => { update.resolve(page(104, 203, 2)) })
  await waitFor(() => expect(hook.result.current.snapshot?.messages).toHaveLength(203))
  expect(hook.result.current.snapshot?.messages.map(item => item.sequence)).toEqual(Array.from({ length: 203 }, (_, i) => i + 1))
  expect(hook.result.current.snapshot?.hasOlder).toBe(false)
})
it('keeps a newer live reply and revision metadata when an older page resolves late', async () => {
  const update = deferred<ConversationSnapshot>(); const old = deferred<ConversationSnapshot>()
  watch.mockResolvedValueOnce(page(101, 200)).mockImplementationOnce(() => update.promise)
  const hook = renderHook(() => useConversationSnapshot('chat'))
  await waitFor(() => expect(watch).toHaveBeenCalledTimes(2))
  watch.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(page(2, 101, 2))
  let loading!: Promise<void>
  act(() => { loading = hook.result.current.loadOlder() })
  await act(async () => { update.resolve(page(102, 201, 2)) })
  await waitFor(() => expect(hook.result.current.snapshot?.revision).toBe(2))
  // The page must also bridge message101 from the earlier tail. Native page remains <=100;
  // retaining the captured tail closes that seam even when its request was overtaken.
  await act(async () => { old.resolve(page(1, 100)); await loading })
  expect(hook.result.current.snapshot?.messages.at(-1)?.sequence).toBe(201)
  expect(hook.result.current.snapshot?.revision).toBe(2)
  expect(hook.result.current.snapshot?.messages.map(item => item.sequence)).toEqual(Array.from({ length: 201 }, (_, i) => i + 1))
})
it('rejects a page from another scope and ignores late old-scope loads', async () => {
  watch.mockResolvedValueOnce(page(101, 200))
  const hook = renderHook(({ id }) => useConversationSnapshot(id), { initialProps: { id: 'chat' } })
  await waitFor(() => expect(hook.result.current.snapshot).not.toBeNull())
  watch.mockResolvedValueOnce(page(1, 100, 1, 'wrong'))
  await act(async () => { await hook.result.current.loadOlder() })
  expect(hook.result.current.olderError).toContain('scope mismatch')
  const older = deferred<ConversationSnapshot>(); watch.mockImplementationOnce(() => older.promise)
  let loading!: Promise<void>; act(() => { loading = hook.result.current.loadOlder() })
  watch.mockResolvedValueOnce(page(1, 2, 3, 'other'))
  hook.rerender({ id: 'other' })
  await waitFor(() => expect(hook.result.current.snapshot?.conversationId).toBe('other'))
  await act(async () => { older.resolve(page(1, 100)); await loading })
  expect(hook.result.current.snapshot?.messages).toHaveLength(2)
  expect(hook.result.current.olderError).toBeNull()
})
it('merges by durable message identity and newest revision, independent of arrival', () => {
  const older = page(1, 4)
  const newer = page(3, 6, 2)
  newer.messages[0] = { ...newer.messages[0], replacedBy: 'replacement', text: 'Revised metadata' }
  const merged = mergeConversationPages([newer, older])
  expect(merged.messages).toHaveLength(6)
  expect(merged.messages[2]).toMatchObject({ replacedBy: 'replacement', text: 'Revised metadata' })
  expect(merged.hasOlder).toBe(false)
})

it('bridges multiple live pages while an older-page request remains in flight', async () => {
  const update = deferred<ConversationSnapshot>(); const old = deferred<ConversationSnapshot>()
  watch.mockResolvedValueOnce(page(101, 200)).mockImplementationOnce(() => update.promise)
  const hook = renderHook(() => useConversationSnapshot('chat'))
  await waitFor(() => expect(watch).toHaveBeenCalledTimes(2))
  watch.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(page(301, 400, 2)).mockResolvedValueOnce(page(201, 300, 2)).mockResolvedValueOnce(page(101, 200, 2))
  let loading!: Promise<void>
  act(() => { loading = hook.result.current.loadOlder() })
  await act(async () => { update.resolve(page(401, 500, 2)) })
  await waitFor(() => expect(hook.result.current.snapshot?.revision).toBe(2))
  await act(async () => { old.resolve(page(1, 100)); await loading })
  expect(hook.result.current.snapshot?.messages.map(item => item.sequence)).toEqual(Array.from({ length: 500 }, (_, i) => i + 1))
})
