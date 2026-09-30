// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useLanguageTotals } from './useLanguageTotals'
vi.mock('../../platform/ipc/skill-evidence', () => ({ getLanguageTotals: vi.fn(async () => [
  { target: 'spanish', xp: 10, explorations: 3, bot: 2, partnerUnderstood: 0, noIssuesFlagged: 0, revisionsSent: 0, practiceAttempts: 0 },
  { target: 'french', xp: 20, explorations: 7, bot: 4, partnerUnderstood: 0, noIssuesFlagged: 0, revisionsSent: 0, practiceAttempts: 0 },
]) }))
it('includes hidden languages in app exploration totals while filtering table rows', async () => {
  const { result } = renderHook(() => useLanguageTotals(null, null, ['spanish']))
  await waitFor(() => expect(result.current.globalEffort?.explorations).toBe(10))
  expect(result.current.rows?.map(row => row.target)).toEqual(['spanish'])
  expect(result.current.globalXp).toBe(30)
  expect(result.current.globalEffort?.bot).toBe(6)
})
