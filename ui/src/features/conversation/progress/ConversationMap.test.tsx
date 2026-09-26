// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationMap } from './ConversationMap'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
it('shows per-skill XP in conversation and continues beyond the first milestone', async () => {
  const snapshot=structuredClone(skillDemo)
  snapshot.profile.skills.find(s=>s.skill_id==='identify_describe')!.xp=52
  render(<SkillEvidenceContext value={{snapshot,error:null}}><PracticeContext value={{chatId:'chat',selected:'identify_describe',selectionVersion:0,select:vi.fn()}}><ConversationMap /></PracticeContext></SkillEvidenceContext>)
  const bar=screen.getByRole('progressbar',{name:'Identify and describe practice XP'})
  await waitFor(()=>expect(bar).toHaveAttribute('value','2'))
  expect(bar).toHaveAttribute('aria-valuetext','52 XP; next milestone 100')
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(12)
})
