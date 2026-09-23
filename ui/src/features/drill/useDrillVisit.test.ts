// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useDrillVisit } from './useDrillVisit'
const api = vi.hoisted(() => ({ start: vi.fn(), end: vi.fn(), enter: vi.fn(), leave: vi.fn() }))
vi.mock('../../platform/ipc/drill', () => ({ startDrillSession: api.start, endDrillSession: api.end, enterDrillVisit: api.enter, leaveDrillVisit: api.leave }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  api.start.mockResolvedValue('session')
  api.end.mockResolvedValue(undefined)
  api.enter.mockImplementation(async (_session: string, item: string) => `visit-${item}`)
  api.leave.mockResolvedValue(undefined)
})
it('serializes an abandoned visit before entering the newly selected phrase', async () => {
  let resolve!: (id: string) => void
  api.enter.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { result, rerender, unmount } = renderHook(({ item }) => useDrillVisit(true, 'spanish', item), { initialProps: { item: 'a' } })
  await waitFor(() => expect(api.enter).toHaveBeenCalledWith('session', 'a'))
  rerender({ item: 'b' })
  expect(result.current.visitId).toBeNull()
  expect(api.enter).toHaveBeenCalledTimes(1)
  await act(async () => { resolve('visit-a') })
  await waitFor(() => expect(result.current.visitId).toBe('visit-b'))
  expect(api.leave).toHaveBeenCalledWith('visit-a')
  expect(api.leave.mock.invocationCallOrder[0]).toBeLessThan(api.enter.mock.invocationCallOrder[1])
  unmount()
  await waitFor(() => expect(api.end).toHaveBeenCalledWith('session'))
})
it('closes a session that finishes opening after its page unmounts', async () => {
  let resolve!: (id: string) => void
  api.start.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const view = renderHook(() => useDrillVisit(true, 'spanish', 'a'))
  await waitFor(() => expect(api.start).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { resolve('late-session') })
  await waitFor(() => expect(api.end).toHaveBeenCalledWith('late-session'))
  expect(api.enter).not.toHaveBeenCalled()
})
it('offers an explicit retry when session creation fails', async () => {
  api.start.mockRejectedValueOnce(new Error('storage unavailable'))
  const { result, unmount } = renderHook(() => useDrillVisit(true, 'spanish', 'a'))
  await waitFor(() => expect(result.current.failure).toBeInstanceOf(Error))
  expect(result.current.visitId).toBeNull()
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.visitId).toBe('visit-a'))
  expect(result.current.failure).toBeNull()
  expect(api.start).toHaveBeenCalledTimes(2)
  unmount()
  await waitFor(() => expect(api.end).toHaveBeenCalledWith('session'))
})
