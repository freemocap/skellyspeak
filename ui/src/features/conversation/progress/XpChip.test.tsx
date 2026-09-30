// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { XpChip } from './XpChip'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { getEffortProgress } from '../../../platform/ipc/effort'
vi.mock('../../../domain/input/back', () => ({ openOverlay: () => () => {} }))
vi.mock('../../../platform/ipc/effort', () => ({
  getEffortProgress: vi.fn(async (target: string) => ({ target, partnerUnderstood: 2, revisionsSent: 1, practiceAttempts: 0, noIssuesFlagged: 1, recent: [] })),
  getEffortReport: vi.fn(async () => ({ activity: [], entries: [], next: null })),
}))
it('shows this conversation’s effort in the card, then the ledger on the second press', async () => {
  const snapshot = structuredClone(skillDemo)
  render(<SkillEvidenceContext value={{ snapshot, error: null }}><XpChip chatId="chat" /></SkillEvidenceContext>)
  await waitFor(() => expect(getEffortProgress).toHaveBeenCalledWith(snapshot.target, 'chat'))
  const chip = screen.getByRole('button', { name: 'Conversation XP' })
  fireEvent.click(chip)
  expect(screen.getByRole('dialog', { name: 'This conversation' })).toBeVisible()
  expect(await screen.findByLabelText('Understood: 2')).toBeVisible()
  expect(screen.getByLabelText('Fixes: 1')).toBeVisible()
  fireEvent.click(chip)
  expect(screen.queryByRole('dialog', { name: 'This conversation' })).toBeNull()
  expect(await screen.findByRole('dialog', { name: 'Conversation XP' })).toBeVisible()
})
