// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardProgress } from './RewardProgress'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'

it('deduplicates repeated evidence and fills from previous XP to the saved total', () => {
  vi.useFakeTimers()
  const snapshot = structuredClone(skillDemo)
  const progress = snapshot.profile.skills[0]
  progress.xp = 20
  snapshot.profile.xp = 120
  const item: MessageEvidence = { id: 'attempt:skill', skillId: progress.skill_id, domainId: 'reference', label: 'Identify a referent', xp: 10, quote: 'cup', ambiguous: false, rationale: '', start: 0, end: 3, color: '', explanation: '' }
  const close = vi.fn()
  const view = render(<RewardProgress arrivedIds={[]} evidence={[item, item]} snapshot={snapshot} onClose={close} />)
  try {
    expect(screen.getByRole('status')).toHaveTextContent('+10 XP · 120 XP total')
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '20')
    const fill = bar.firstElementChild as HTMLElement
    expect(parseFloat(fill.style.width)).toBeCloseTo(20)
    act(() => vi.advanceTimersByTime(1000))
    expect(parseFloat(fill.style.width)).toBeCloseTo(20)
    view.rerender(<RewardProgress arrivedIds={[item.id]} evidence={[item, item]} snapshot={snapshot} onClose={close} />)
    expect(parseFloat(fill.style.width)).toBeCloseTo(40)
    act(() => vi.advanceTimersByTime(2700))
    expect(close).toHaveBeenCalledOnce()
  } finally { view.unmount(); vi.useRealTimers() }
})


it('opens evidence from both the temporary skill label and its bar', () => {
  const snapshot = structuredClone(skillDemo)
  const skill = snapshot.profile.skills[0]
  const item: MessageEvidence = { id: 'a', skillId: skill.skill_id, domainId: 'reference', label: 'Identify a referent', xp: 10, quote: 'cup', ambiguous: false, rationale: '', start: 0, end: 3, color: '', explanation: '' }
  const inspect = vi.fn()
  render(<RewardProgress arrivedIds={[]} evidence={[item]} snapshot={snapshot} onClose={vi.fn()} onInspectSkill={inspect} />)
  fireEvent.click(screen.getByRole('button', { name: 'Identify a referent' }))
  fireEvent.click(screen.getByRole('progressbar'))
  expect(inspect).toHaveBeenCalledTimes(2)
  expect(inspect).toHaveBeenCalledWith(skill.skill_id)
})
