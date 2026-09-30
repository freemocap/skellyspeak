// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { TurnActivity } from '../../../domain/conversation/activity-summary'
import { TurnActivityLine } from './TurnActivityLine'

const activity: TurnActivity = {
  total: 3, done: 1, waiting: 1, held: 0, failed: 0,
  running: ['word gloss'], replyRunning: false, replyWords: null,
  lastFinished: 'persona reply', settled: false, elapsedMs: null,
}

it('keeps background work quiet and inspectable, then clears immediately', () => {
  const inspect = vi.fn()
  const view = render(<TurnActivityLine activity={activity} onActivity={inspect} fallback={<span>Ready</span>} />)
  fireEvent.click(screen.getByRole('button', { name: 'Background activity' }))
  expect(inspect).toHaveBeenCalledOnce()
  expect(view.container.querySelector('.activity-spinner')).toBeNull()
  expect(view.container).not.toHaveTextContent('word gloss')
  expect(view.container).not.toHaveTextContent('1/3')
  view.rerender(<TurnActivityLine activity={{ ...activity, settled: true, running: [], waiting: 0 }} onActivity={inspect} fallback={<span>Ready</span>} />)
  expect(screen.getByText('Ready')).toBeVisible()
  expect(screen.queryByRole('status')).toBeNull()
})

it('keeps settled failures and held work discoverable without a busy spinner', () => {
  const inspect = vi.fn()
  const view = render(<TurnActivityLine activity={{ ...activity, settled: true, failed: 1, running: [], waiting: 0 }} onActivity={inspect} />)
  expect(screen.getByRole('button')).toHaveTextContent(/failed/i)
  fireEvent.click(screen.getByRole('button'))
  expect(inspect).toHaveBeenCalledOnce()
  view.rerender(<TurnActivityLine activity={{ ...activity, held: 1, running: [] }} onActivity={inspect} />)
  expect(screen.getByRole('button', { name: 'Held' })).toBeVisible()
  expect(view.container.querySelector('.activity-spinner')).toBeNull()
})
