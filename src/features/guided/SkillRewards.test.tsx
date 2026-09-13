import { SKILL_CATALOG_VERSION } from '../../contracts'
import { RewardInspectionContext } from './RewardInspectionContext'
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillRewards } from './SkillRewards'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { skillDemo } from '../../domain/skills/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../../domain/skills/skills'

it('silently loads history, announces new credit, and clears it on chat changes', () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  vi.useFakeTimers()
  const arrive = vi.fn()
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 2
  const ui = (value: SkillSnapshot, chatId = 'chat') => <SkillEvidenceContext value={{ snapshot: value, error: null }}><RewardInspectionContext value={{ arrive, open: vi.fn() }}><SkillRewards chatId={chatId} active={true} /></RewardInspectionContext></SkillEvidenceContext>
  const view = render(ui(snapshot))
  try {
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    const next = structuredClone(snapshot)
    next.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
    next.profile.credits = [{ attempt_id: 'a', skill_id: 'referent', xp: 10 }]
    next.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 10
    view.rerender(ui(next))
    expect(screen.getByRole('status')).toHaveTextContent('8 XP for Identify a referent: Ese café')
    expect(arrive).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'a:referent', xp: 8 })]), 1, 'Ese café.')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    view.rerender(ui(structuredClone(next)))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(arrive).toHaveBeenCalledOnce()
    view.rerender(ui(snapshot, 'another-chat'))
    view.rerender(ui(next, 'chat'))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  } finally { view.unmount(); media.mockRestore(); vi.useRealTimers() }
})

it('presents assisted revision credit once and does not replay it after reopening', () => {
  const arrive = vi.fn()
  const baseline = structuredClone(skillDemo)
  const earned = structuredClone(skillDemo)
  earned.records = [{ attempt_id: 'repair', session_id: 's', turn_id: 2, message_id: 3, replaces_message_id: 1, chat_id: 'chat', learner_id: earned.learner_id, target: earned.target, native: 'en', source: 'Ese café.', input: { ...unreportedInput(), revision: true }, at_secs: 1, model: 'fixture', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'fixture', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
  earned.profile.credits = [{ attempt_id: 'repair', skill_id: 'referent', xp: 2 }]
  earned.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 2
  earned.profile.xp = 2
  const ui = (snapshot: SkillSnapshot) => <SkillEvidenceContext value={{ snapshot, error: null }}><RewardInspectionContext value={{ arrive, open: vi.fn() }}><SkillRewards chatId="chat" active /></RewardInspectionContext></SkillEvidenceContext>
  const view = render(ui(baseline))
  view.rerender(ui(earned))
  expect(arrive).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('2 XP for Identify a referent: Ese café')
  view.rerender(ui(structuredClone(earned)))
  expect(arrive).toHaveBeenCalledOnce()
  view.unmount()
  render(ui(earned))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(arrive).toHaveBeenCalledOnce()
})
