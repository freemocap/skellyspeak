// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { ConversationProgress } from './ConversationProgress'
import { useSkillNavigationStore } from '../../../state/navigation/skill-navigation'
vi.mock('../../../platform/ipc/effort', () => ({
  getEffortProgress: vi.fn(async (target: string) => ({ target, partnerUnderstood: 2, revisionsSent: 1, practiceAttempts: 0, explorations: 0, bot: 0, recent: [] })),
}))

it('keeps practice selection in the radar panel and opens a skill on the Progress page', () => {
  const select = vi.fn()
  render(<SkillEvidenceContext value={{ snapshot: skillDemo, error: null }}><PracticeContext value={{ chatId: 'chat', selected: 'people_places', selectionVersion: 0, select }}><ConversationProgress chatId="chat" languageName="Spanish" /></PracticeContext></SkillEvidenceContext>)
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(8)
  fireEvent.click(document.querySelector('[data-reward-skill="possibilities_constraints"]')!)
  expect(select).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use this in a Spanish conversation' }))
  expect(select).toHaveBeenCalledWith('possibilities_constraints')
  fireEvent.click(screen.getByRole('button', { name: 'Possibilities and constraints in Spanish' }))
  expect(useSkillNavigationStore.getState().mapRequest?.location).toEqual({ target: skillDemo.target, skillId: 'possibilities_constraints' })
})

it('shows this conversation’s skills, XP and effort in the Progress page’s order', async () => {
  render(<SkillEvidenceContext value={{ snapshot: skillDemo, error: null }}><PracticeContext value={{ chatId: 'chat', selected: null, selectionVersion: 0, select: vi.fn() }}><ConversationProgress chatId="chat" languageName="Spanish" /></PracticeContext></SkillEvidenceContext>)
  expect(screen.getAllByRole('heading', { level: 3 }).filter(heading => heading.classList.contains('conversation-progress-title')).map(heading => heading.firstChild?.textContent)).toEqual(['Skills', 'XP', 'Effort'])
  expect(await screen.findByLabelText('Understood: 2')).toBeVisible()
  expect(screen.queryByLabelText(/^Practice:/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Open the Progress page' })).toBeVisible()
})
