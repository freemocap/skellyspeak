import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
import { RewardInspectionContext } from './RewardInspectionContext'
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillRewards } from './SkillRewards'
vi.mock('../../../platform/ipc/rewards', () => ({claimRewardEvents: vi.fn(async (_target: string, ids: string[]) => ids.map(id => ({ id })))}))
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../../../domain/learning/evidence/skills'

it('silently loads history, announces new credit, and clears it on chat changes', async () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  vi.useFakeTimers()
  const arrive = vi.fn()
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 2
  const ui = (value: SkillSnapshot, chatId = 'chat') => <SkillEvidenceContext value={{ snapshot: value, error: null }}><RewardInspectionContext value={{ arrive }}><SkillRewards chatId={chatId} active={true} /></RewardInspectionContext></SkillEvidenceContext>
  const view = render(ui(snapshot))
  try {
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    const next = structuredClone(snapshot)
    next.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'identify_describe', presence: 'direct', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
    next.profile.credits = [{ attempt_id: 'a', skill_id: 'identify_describe', xp: 10 }]
    next.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 10
    await act(async () => view.rerender(ui(next)))
    expect(screen.getByRole('status')).toHaveTextContent('8 XP for Identify and describe: Ese café')
    expect(arrive).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'a:identify_describe', xp: 8 })]), 1, 'Ese café.')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await act(async () => view.rerender(ui(structuredClone(next))))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(arrive).toHaveBeenCalledOnce()
    await act(async () => view.rerender(ui(snapshot, 'another-chat')))
    await act(async () => view.rerender(ui(next, 'chat')))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  } finally { view.unmount(); media.mockRestore(); vi.useRealTimers() }
})

it('presents effort revision credit once and does not replay it after reopening', async () => {
  const arrive = vi.fn()
  const baseline = structuredClone(skillDemo)
  const earned = structuredClone(skillDemo)
  earned.records = [{ attempt_id: 'repair', session_id: 's', turn_id: 2, message_id: 3, replaces_message_id: 1, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: earned.learner_id, target: earned.target, native: 'english', source: 'Ese café.', input: { ...unreportedInput(), revision: true }, at_secs: 1, model: 'fixture', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'fixture', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'identify_describe', presence: 'direct', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
  earned.profile.credits = [{ attempt_id: 'repair', skill_id: 'identify_describe', xp: 2 }]
  earned.profile.skills.find(skill => skill.skill_id === 'identify_describe')!.xp = 2
  earned.profile.xp = 2
  const ui = (snapshot: SkillSnapshot) => <SkillEvidenceContext value={{ snapshot, error: null }}><RewardInspectionContext value={{ arrive }}><SkillRewards chatId="chat" active /></RewardInspectionContext></SkillEvidenceContext>
  const view = render(ui(baseline))
  await act(async () => view.rerender(ui(earned)))
  expect(arrive).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('2 XP for Identify and describe: Ese café')
  await act(async () => view.rerender(ui(structuredClone(earned))))
  expect(arrive).toHaveBeenCalledOnce()
  view.unmount()
  render(ui(earned))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(arrive).toHaveBeenCalledOnce()
})

it('waits for a durable claim and suppresses events another window already consumed', async () => {
  const { claimRewardEvents } = await import('../../../platform/ipc/rewards')
  const claim=vi.mocked(claimRewardEvents)
  claim.mockResolvedValue([])
  const arrive=vi.fn()
  const baseline=structuredClone(skillDemo)
  baseline.profile.rules_version=3
  const earned=structuredClone(baseline)
  earned.records=[{attempt_id:'partial',session_id:'s',turn_id:1,message_id:1,replaces_message_id:null,construct_registry_hash:'fixture-registry',mapping_error:null,support_step:null,chat_id:'chat',learner_id:earned.learner_id,target:earned.target,native:'english',source:'Ese café.',input:unreportedInput(),at_secs:1,model:'fixture',provider_mode:'hosted',catalog_version:SKILL_CATALOG_VERSION,prompt_version:'fixture',status:'complete',error:null,assessment:{judgments:[{skill_id:'identify_describe',presence:'direct',quotes:['Ese café'],rationale:'Reference is partly clear.'}]}}]
  earned.profile.credits=[{attempt_id:'partial',skill_id:'identify_describe',xp:12}]
  earned.profile.skills.find(s=>s.skill_id==='identify_describe')!.xp=12
  const ui=(snapshot:SkillSnapshot, enabled = true)=><SkillEvidenceContext value={{snapshot,error:null}}><RewardInspectionContext value={{enabled,arrive}}><SkillRewards chatId="chat" active /></RewardInspectionContext></SkillEvidenceContext>
  const view=render(ui(baseline))
  await act(async()=>view.rerender(ui(earned)))
  expect(claim).toHaveBeenCalledWith(earned.target,['partial:identify_describe'])
  expect(arrive).not.toHaveBeenCalled()
  // A successful durable claim is still consumed while effects are disabled.
  claim.mockResolvedValue([{ id: 'partial:identify_describe' } as Awaited<ReturnType<typeof claimRewardEvents>>[number]])
  await act(async () => view.rerender(ui(baseline, false)))
  await act(async () => view.rerender(ui(earned, false)))
  expect(arrive).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  await act(async () => view.rerender(ui(earned, true)))
  expect(arrive).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})
