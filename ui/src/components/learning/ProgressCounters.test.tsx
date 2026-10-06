// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ProgressCounters } from './ProgressCounters'
import { ProgressCard } from './ProgressCard'
import type { EffortProgress } from '../../generated/contracts'
const effort: EffortProgress = { target: 'spanish', partnerUnderstood: 12, revisionsSent: 3, practiceAttempts: 45, explorations: 0, bot: 0, recent: [] }
it('keeps the numeric XP gain without duplicating effort icons at the counter', () => {
  const view = render(<ProgressCounters xp={1248} effort={effort} />)
  expect(screen.getByLabelText('XP: 1,248')).toBeVisible()
  expect(view.container).not.toHaveTextContent('45')
  expect(view.container.querySelector('[data-effort-gain]')).toBeNull()
  view.rerender(<ProgressCounters xp={1250} effort={{ ...effort, practiceAttempts: 46 }} />)
  expect(view.container.querySelector('[data-effort-gain]')).toBeNull()
  expect(screen.getByLabelText('XP: 1,250')).toHaveAttribute('data-gaining', 'true')
  expect(screen.getByText('+2')).toBeVisible()
})
it('does not celebrate language or conversation switching, and keeps exact large values accessible', () => {
  const view = render(<ProgressCounters xp={1} scope="chat-a" effort={effort} />)
  view.rerender(<ProgressCounters xp={1234567} scope="chat-b" effort={{ ...effort, target: 'french', practiceAttempts: 600000 }} />)
  expect(screen.getByLabelText('XP: 1,234,567')).toHaveTextContent('1.2M')
  expect(view.container.querySelector('[data-gaining], [data-effort-gain]')).toBeNull()
})
it('honors the effects preference while still updating numbers', () => {
  const view = render(<ProgressCounters xp={1} effort={effort} effects={false} />)
  view.rerender(<ProgressCounters xp={2} effort={{ ...effort, revisionsSent: 4 }} effects={false} />)
  expect(screen.getByLabelText('XP: 2')).toBeVisible()
  expect(view.container.querySelector('[data-gaining], [data-effort-gain]')).toBeNull()
})
it('lists XP and each effort unit separately in the card', () => {
  const expand = vi.fn()
  render(<ProgressCard title="Language progress" xp={1248} effort={effort} expandLabel="Open the Progress page" onExpand={expand} />)
  const card = screen.getByRole('dialog', { name: 'Language progress' })
  expect(card).toHaveTextContent('1,248 XP')
  for (const label of ['Understood: 12', 'Fixes: 3', 'Practice: 45', 'Explore: 0']) expect(screen.getByLabelText(label)).toBeVisible()
  expect(screen.queryByLabelText(/^Clean:/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Open the Progress page' }))
  expect(expand).toHaveBeenCalledOnce()
})

it('does not emit telescope popups from the XP counter', () => {
  const view = render(<ProgressCounters xp={12} effort={effort} />)
  view.rerender(<ProgressCounters xp={12} effort={{ ...effort, explorations: 1 }} />)
  expect(view.container.querySelector('[data-effort-gain]')).toBeNull()
  expect(screen.getByLabelText('XP: 12')).not.toHaveAttribute('data-gaining')
  view.rerender(<ProgressCounters xp={12} effort={{ ...effort, explorations: 2 }} effects={false} />)
  expect(view.container.querySelector('[data-effort-gain]')).toBeNull()
})

it('does not emit robot popups from the XP counter', () => {
  const view = render(<ProgressCounters xp={12} effort={effort} />)
  view.rerender(<ProgressCounters xp={12} effort={{ ...effort, bot: 1 }} />)
  expect(view.container.querySelector('[data-effort-gain]')).toBeNull()
  expect(view.container.querySelector('[data-effort-gain="telescope"]')).toBeNull()
  expect(screen.getByLabelText('XP: 12')).not.toHaveAttribute('data-gaining')
})
