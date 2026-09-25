// @vitest-environment jsdom
import { useEffect } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { DrillAttemptPage, DrillAttemptView } from '../../generated/contracts'
import { useDrillAttempts } from './useDrillAttempts'
import { useAttemptAudio } from './useAttemptAudio'

const api = vi.hoisted(() => ({ history: vi.fn(), audio: vi.fn(), inspect: vi.fn() }))
vi.mock('../../platform/ipc/drill', () => ({ drillAttempts: api.history, drillAttemptAudio: api.audio, inspectDrillAudio: api.inspect }))
vi.mock('../../platform/audio/recording-events', () => ({ onRecordingPublished: () => () => {} }))

it('never pairs a new phrase with old attempts, including effects before history clears', async () => {
  const oldTake = { id: 'take-a', audioBytes: 12n, audioPrunedAt: null } as DrillAttemptView
  let finishAudio!: (audio: string) => void
  let finishHistory!: (page: DrillAttemptPage) => void
  api.history.mockResolvedValueOnce({ attempts: [oldTake], nextCursor: 'older-a' })
    .mockImplementationOnce(() => new Promise(resolve => { finishHistory = resolve }))
  api.audio.mockImplementation(() => new Promise(resolve => { finishAudio = resolve }))
  const observed = vi.fn()
  const { result, rerender } = renderHook(({ item, active }) => {
    const history = useDrillAttempts(item, active)
    useAttemptAudio(item, history.attempts[0] ?? null)
    useEffect(() => { observed(item, history.attempts.map(take => take.id)) }, [item, history.attempts])
    return history
  }, { initialProps: { item: 'phrase-a', active: true } })
  await waitFor(() => expect(result.current.attempts).toEqual([oldTake]))
  rerender({ item: 'phrase-b', active: true })
  expect(observed.mock.calls.filter(([item]) => item === 'phrase-b').every(([, takes]) => takes.length === 0)).toBe(true)
  expect(result.current.hasMore).toBe(false)
  await act(async () => { finishAudio('old-audio') })
  expect(api.inspect).not.toHaveBeenCalled()
  rerender({ item: 'phrase-b', active: false })
  await act(async () => { finishHistory({ attempts: [oldTake], nextCursor: null }) })
  expect(result.current.attempts).toEqual([])
  expect(result.current.loading).toBe(false)
})
