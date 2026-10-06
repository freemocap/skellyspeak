// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { EffortReport } from './EffortReport'
const api = vi.hoisted(() => ({ getEffortReport: vi.fn() }))
vi.mock('../../../platform/ipc/effort', () => api)
it('renders translated aggregate statistics and pages through retained or deleted sources', async () => {
  const activity = [{ dimension: 'practice_attempts', total: 105, lastSevenDays: 18, activeDays: 7, firstAt: '2026-09-01T12:00:00Z', lastAt: '2026-09-29T12:00:00Z' }]
  api.getEffortReport.mockResolvedValueOnce({ target: 'spanish', activity, entries: [{ id: 'one', dimension: 'practice_attempts', createdAt: '2026-09-29T12:00:00Z', sourceText: 'Hola.' }], next: 'one' })
    .mockResolvedValueOnce({ target: 'spanish', activity, entries: [{ id: 'two', dimension: 'practice_attempts', createdAt: '2026-09-28T12:00:00Z', sourceText: null }], next: null })
  render(<EffortReport languageName="Spanish" target="spanish" revision={1} />)
  expect(await screen.findByText('105')).toBeVisible()
  expect(screen.getByText('Hola.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  expect(await screen.findByText('Source history deleted; credit retained.')).toBeVisible()
  expect(screen.getByText('Hola.')).toBeVisible()
  expect(api.getEffortReport).toHaveBeenLastCalledWith('spanish', null, 'one')
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
})
