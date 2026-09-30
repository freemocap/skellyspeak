// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useEffortProgress } from './useEffortProgress'
import { getEffortProgress, claimEffortAwards } from '../../platform/ipc/effort'
import type { EffortProgress } from '../../generated/contracts'
vi.mock('../../platform/ipc/effort', () => ({ getEffortProgress: vi.fn(), claimEffortAwards: vi.fn() }))
const progress = (target: string): EffortProgress => ({ target, partnerUnderstood: 1, revisionsSent: 2, practiceAttempts: 3, noIssuesFlagged: 4, recent: [{ id: target, sourceId: 'source', dimension: 'practice_attempts', language: target, variety: 'standard', conversationId: null, policy: 'effort-inclusion-1', createdAt: '2026-09-29T12:00:00Z', claimed: false }] })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(claimEffortAwards).mockImplementation(async (_target, ids) => ids) })
it('keeps lifetime totals visible if presentation claiming fails', async () => {
  vi.mocked(getEffortProgress).mockResolvedValue(progress('spanish'))
  vi.mocked(claimEffortAwards).mockRejectedValue(new Error('Claim failed'))
  const { result } = renderHook(() => useEffortProgress('spanish', 1))
  await waitFor(() => expect(result.current.value?.practiceAttempts).toBe(3))
  expect(result.current.error).toContain('Claim failed')
  expect(result.current.arrived).toEqual([])
})
it('hides the old language immediately and ignores its late read', async () => {
  let finish!: (value: EffortProgress) => void
  vi.mocked(getEffortProgress).mockImplementation(target => target === 'spanish' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(progress(target)))
  const { result, rerender } = renderHook(({ target }) => useEffortProgress(target, 1), { initialProps: { target: 'spanish' } })
  rerender({ target: 'french' })
  expect(result.current.value).toBeNull()
  await waitFor(() => expect(result.current.value?.target).toBe('french'))
  await act(async () => finish(progress('spanish')))
  expect(result.current.value?.target).toBe('french')
  expect(claimEffortAwards).not.toHaveBeenCalledWith('spanish', expect.anything())
})
it('does not animate historical awards on first load but exposes newly claimed awards after refresh', async () => {
  vi.mocked(getEffortProgress).mockResolvedValue(progress('spanish'))
  const { result, rerender } = renderHook(({ revision }) => useEffortProgress('spanish', revision), { initialProps: { revision: 1 } })
  await waitFor(() => expect(result.current.value).not.toBeNull())
  expect(result.current.arrived).toEqual([])
  rerender({ revision: 2 })
  await waitFor(() => expect(result.current.arrived).toEqual(['spanish']))
})
