// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillNavigationProvider } from '../../hooks/useSkillNavigation'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'
import { RewardDetail } from './RewardBadge'

vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))

it('shows all quotes once with one stored credit, including repeated-phrase ambiguity', () => {
  HTMLDialogElement.prototype.showModal = function (): void { this.open = true }
  HTMLDialogElement.prototype.close = function (): void { this.open = false }
  const item: MessageEvidence = { id: 'a:referent', skillId: 'referent', domainId: 'statements', label: 'Identify a referent', xp: 10, quote: 'Ese café', ambiguous: true, rationale: 'Ese identifies a particular coffee.', start: 0, end: 8, color: domainColors('statements').ink, explanation: '' }
  const close = vi.fn()
  render(<SkillNavigationProvider><RewardDetail automatic={false} interactive={true} evidence={[item, { ...item, start: 10, end: 18 }, { ...item, quote: 'aquel té', ambiguous: false }]} onClose={close} /></SkillNavigationProvider>)
  expect(screen.getAllByText('Ese café')).toHaveLength(1)
  expect(screen.getByText('aquel té')).toBeVisible()
  expect(screen.getAllByText('10 XP')).toHaveLength(1)
  expect(screen.queryByText('+10 XP')).not.toBeInTheDocument()
  expect(screen.getByText(/does not specify which occurrence/)).toBeVisible()
  expect(screen.getByRole('dialog', { name: 'XP details' }).tagName).toBe('SECTION')
  fireEvent.pointerDown(document.body)
  expect(close).toHaveBeenCalledTimes(1)
})
