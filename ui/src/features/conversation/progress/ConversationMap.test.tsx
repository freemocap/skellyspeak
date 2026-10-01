// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationMap } from './ConversationMap'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { ConversationProgress } from './ConversationProgress'

it('uses one set of reward destinations and keeps practice selection in the radar panel', () => {
  const select = vi.fn()
  render(<SkillEvidenceContext value={{ snapshot: skillDemo, error: null }}><PracticeContext value={{ chatId: 'chat', selected: 'identify_describe', selectionVersion: 0, select }}><ConversationProgress chatId="chat" /></PracticeContext></SkillEvidenceContext>)
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(12)
  expect(document.querySelector('.skill-list')).toBeNull()
  fireEvent.click(document.querySelector('[data-reward-skill="quantity"]')!)
  expect(select).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use this in a conversation' }))
  expect(select).toHaveBeenCalledWith('quantity')
})
it('shows per-skill XP in conversation without milestone bars', async () => {
  const snapshot=structuredClone(skillDemo)
  snapshot.profile.skills.find(s=>s.skill_id==='identify_describe')!.xp=52
  render(<SkillEvidenceContext value={{snapshot,error:null}}><PracticeContext value={{chatId:'chat',selected:'identify_describe',selectionVersion:0,select:vi.fn()}}><ConversationMap /></PracticeContext></SkillEvidenceContext>)
  await waitFor(()=>expect(document.querySelector('[data-reward-skill="identify_describe"]')).toHaveTextContent('52 XP'))
  expect(screen.queryByRole('progressbar')).toBeNull()
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(12)
})
