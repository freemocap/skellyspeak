// @vitest-environment jsdom
import { act, fireEvent, renderHook, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useDeferredReading } from './useDeferredReading'
const request = vi.hoisted(() => vi.fn())
vi.mock('../../../platform/ipc/message-help', () => ({ requestMessageHelp: request }))
beforeEach(() => { request.mockReset().mockResolvedValue(undefined) })
it('waits for a deliberate action and shares an in-flight command', async () => {
  let finish!: () => void
  request.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const { result } = renderHook(() => useDeferredReading('source', null, null))
  expect(request).not.toHaveBeenCalled()
  let first!: Promise<void>
  act(() => { first = result.current.request('word_gloss'); void result.current.request('word_gloss') })
  expect(request).toHaveBeenCalledExactlyOnceWith('source', 'word_gloss', false)
  await act(async () => { finish(); await first })
})
it.each(['ready', 'running', 'succeeded', 'failed', 'unknown', 'held'])('does not resubmit %s reading work on open', async state => {
  const { result } = renderHook(() => useDeferredReading('source', state, state))
  await act(async () => { await result.current.request('translation'); await result.current.request('word_gloss') })
  expect(request).not.toHaveBeenCalled()
})
it('retries failed translation only from its retry button', async () => {
  function View() { return useDeferredReading('source', 'failed', null).status }
  render(<View />)
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry translation' }))
  await waitFor(() => expect(request).toHaveBeenCalledExactlyOnceWith('source', 'translation', true))
})
