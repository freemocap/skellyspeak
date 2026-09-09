// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationMap } from './ConversationMap'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { PracticeContext } from '../panes/PracticeContext'
import { skillDemo } from '../../lib/skillDemo'
import type { SkillSnapshot } from '../../lib/skills'

it('fills bars and arms on assisted and unassisted credit before a star is earned', () => {
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.forEach(skill => { skill.xp = 0; skill.successes = 0; skill.star = false })
  const ui = (value: SkillSnapshot) => <SkillEvidenceContext value={{ saving: false, save: async () => {}, snapshot: value, error: null }}><PracticeContext value={{ chatId: 'chat', selected: 'referent', selectionVersion: 0, select: vi.fn() }}><ConversationMap /></PracticeContext></SkillEvidenceContext>
  const view = render(ui(snapshot))
  const bar = screen.getByRole('progressbar', { name: 'Entities & reference practice XP' }) as HTMLProgressElement
  const arm = view.container.querySelector('[data-reward-domain="reference"] .conversation-map-fill')!
  expect(bar.value).toBe(0)
  const start = arm.getAttribute('stroke-dasharray')
  const assisted = structuredClone(snapshot)
  assisted.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 2
  view.rerender(ui(assisted))
  expect(bar.value).toBeGreaterThan(0)
  expect(arm.getAttribute('stroke-dasharray')).not.toBe(start)
  const partial = bar.value
  const earned = structuredClone(assisted)
  earned.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 10
  view.rerender(ui(earned))
  expect(bar.value).toBeGreaterThan(partial)
  expect(bar.parentElement).toHaveTextContent('10 XP · 0/')
})
