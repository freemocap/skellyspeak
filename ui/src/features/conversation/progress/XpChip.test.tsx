// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { XpChip } from './XpChip'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { getEffortProgress } from '../../../platform/ipc/effort'
vi.mock('../../../platform/ipc/effort', () => ({
  getEffortProgress: vi.fn(async (target: string) => ({ target, partnerUnderstood: 2, revisionsSent: 1, practiceAttempts: 0, explorations: 0, bot: 0, recent: [] })),
}))
it('opens the panel’s Progress tab at skills from the points, and shows this conversation’s effort before opening XP', async () => {
  const snapshot = structuredClone(skillDemo)
  const open = vi.fn()
  render(<SkillEvidenceContext value={{ snapshot, error: null }}><XpChip chatId="chat" onOpen={open} /></SkillEvidenceContext>)
  await waitFor(() => expect(getEffortProgress).toHaveBeenCalledWith(snapshot.target, 'chat'))
  fireEvent.click(screen.getByRole('button', { name: '0 skill points in this conversation' }))
  expect(open).toHaveBeenLastCalledWith('skills')
  const xp = screen.getByRole('button', { name: 'Conversation XP' })
  fireEvent.click(xp)
  expect(screen.getByRole('dialog', { name: 'This conversation' })).toBeVisible()
  expect(await screen.findByLabelText('Understood: 2')).toBeVisible()
  expect(open).toHaveBeenCalledTimes(1)
  fireEvent.click(xp)
  expect(open).toHaveBeenLastCalledWith('xp')
})
