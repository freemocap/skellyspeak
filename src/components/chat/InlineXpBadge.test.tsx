// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { InlineXpBadge } from './InlineXpBadge'
import type { MessageEvidence } from '../../lib/message-evidence'
import { playRewardSound } from '../../lib/reward-sounds'
vi.mock('../../lib/reward-sounds', () => ({ playRewardSound: vi.fn() }))

const item: MessageEvidence = { id: 'a:referent', skillId: 'referent', domainId: 'statements', label: 'Referent', xp: 10, quote: 'this cup', rationale: 'Identifies the cup.', start: 0, end: 8, ambiguous: false, color: '#a32b44', explanation: '' }

it('consumes only the selected token and restores it only with a new word generation', () => {
  vi.useFakeTimers()
  const first = vi.fn()
  const second = vi.fn()
  const bubble = vi.fn()
  const view = render(<div onClick={bubble}><InlineXpBadge generation={0} item={item} onOpen={first} /><InlineXpBadge generation={0} item={{ ...item, id: 'b', label: 'Another skill' }} onOpen={second} /></div>)
  try {
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.scroll(document.body)
    fireEvent.click(document.body)
    const token = screen.getByRole('button', { name: 'Inspect 10 XP · Referent' })
    const face = token.querySelector('.inline-xp-face')
    fireEvent.click(token)
    expect(view.container.querySelector('.inline-xp-slot')).toBeNull()
    expect(first).toHaveBeenCalledOnce()
    expect(playRewardSound).toHaveBeenCalledWith({ kind: 'pop' }, face)
    expect(second).not.toHaveBeenCalled()
    expect(bubble).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Inspect 10 XP · Referent' })).toBeNull()
    view.rerender(<InlineXpBadge generation={1} item={item} onOpen={first} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inspect 10 XP · Referent' }))
    expect(first).toHaveBeenCalledTimes(2)
  } finally { view.unmount(); vi.useRealTimers() }
})
