// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardProgress } from './RewardProgress'
import { skillDemo } from '../../lib/skillDemo'
import type { MessageEvidence } from '../../lib/message-evidence'

it('deduplicates repeated evidence and fills from previous XP to the saved total', () => {
  vi.useFakeTimers()
  const snapshot = structuredClone(skillDemo)
  const progress = snapshot.profile.skills[0]
  progress.xp = 20
  snapshot.profile.xp = 120
  const item: MessageEvidence = { id: 'attempt:skill', skillId: progress.skill_id, domainId: 'reference', label: 'Referent', xp: 10, quote: 'cup', ambiguous: false, rationale: '', start: 0, end: 3, color: '', explanation: '' }
  const close = vi.fn()
  const view = render(<RewardProgress evidence={[item, item]} snapshot={snapshot} onClose={close} />)
  try {
    expect(screen.getByRole('status')).toHaveTextContent('+10 XP · 120 XP total')
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '20')
    const fill = bar.firstElementChild as HTMLElement
    expect(parseFloat(fill.style.width)).toBeCloseTo(100 / 3)
    act(() => vi.advanceTimersByTime(100))
    expect(parseFloat(fill.style.width)).toBeCloseTo(200 / 3)
    act(() => vi.advanceTimersByTime(2700))
    expect(close).toHaveBeenCalledOnce()
  } finally { view.unmount(); vi.useRealTimers() }
})
