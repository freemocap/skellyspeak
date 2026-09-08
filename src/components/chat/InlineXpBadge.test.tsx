// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { InlineXpBadge } from './InlineXpBadge'
import type { MessageEvidence } from '../../lib/message-evidence'

const item: MessageEvidence = { id: 'a:referent', skillId: 'referent', domainId: 'reference', label: 'Referent', xp: 10, quote: 'this cup', rationale: 'Identifies the cup.', start: 0, end: 8, ambiguous: false, color: '#a32b44', explanation: '' }

it.each(['scroll', 'click'])('dismisses ignored credit only on %s after the grace period', event => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  const onDismiss = vi.fn()
  const onOpen = vi.fn()
  const view = render(<InlineXpBadge item={item} onOpen={onOpen} onDismiss={onDismiss} />)
  try {
    fireEvent(document.body, new Event(event, { bubbles: true }))
    act(() => vi.advanceTimersByTime(3000))
    expect(onDismiss).not.toHaveBeenCalled()
    view.rerender(<InlineXpBadge item={{ ...item }} onOpen={onOpen} onDismiss={() => onDismiss()} />)
    fireEvent(document.body, new Event(event, { bubbles: true }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
    view.unmount()
    fireEvent(document.body, new Event(event, { bubbles: true }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  } finally { view.unmount(); media.mockRestore(); vi.useRealTimers() }
})

it('keeps an old marker available to open and leaves an inspected card alone', () => {
  vi.useFakeTimers()
  const onDismiss = vi.fn()
  const onOpen = vi.fn()
  const view = render(<><InlineXpBadge item={item} onOpen={onOpen} onDismiss={onDismiss} /><section className="reward-inspection-card">Explanation</section></>)
  try {
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.scroll(screen.getByText('Explanation'))
    fireEvent.click(screen.getByText('Explanation'))
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  } finally { view.unmount(); vi.useRealTimers() }
})
