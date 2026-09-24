// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearnerModel } from './LearnerModel'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import type { LearnerProfile } from '../../../platform/ipc/learner-profile'
const api = vi.hoisted(() => ({ getLearnerProfile: vi.fn(), saveSkillProfile: vi.fn(), saveLearnerState: vi.fn(), learnerStateYaml: vi.fn(), reload: vi.fn() }))
vi.mock('../../../platform/ipc/learner-profile', () => api)
vi.mock('../../../platform/ipc/skill-evidence', () => api)
vi.mock('../../../state/learning/skill-evidence', () => ({ useSkillEvidenceStore: { getState: () => ({ reload: api.reload }) } }))
function profile(): LearnerProfile {
  const evidence = structuredClone(skillDemo)
  const id = evidence.catalog.find(node => node.kind === 'skill')!.id
  evidence.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'hash', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: evidence.learner_id, target: evidence.target, variety: 'spanish-mexico', native: 'english', source: 'Hola.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: evidence.catalog_version, prompt_version: 'v1', status: 'complete', assessment: { judgments: [{ skill_id: id, presence: 'direct', quotes: ['Hola'], rationale: 'You greeted your partner.' }] }, error: null }]
  return { evidence, scope: {languageId:evidence.target, personaId:null}, partners:[{personaId:'p1',name:'Elena',archived:false},{personaId:'p2',name:'Marta',archived:true}], constructLenses: {[id]:'pragmatics'}, model: { learnerId: evidence.learner_id, languageId: evidence.target, asOfSecs: 100, configHash: 'c', constructRegistryHash: 'hash', estimatorHash: 'e', estimatorVersion: 1, calibration: 'uncalibrated_product_heuristic', choices: {}, observations: [], constructs: [{ constructId: id, varietyId: 'spanish-mexico', rating: 0.5, uncertainty: 0.8, lastSeen: 100, halfLifeDays: 1, n: 2, independentN: 1, effectiveN: 1.5, recall: 1, dueAt: 200, due: false, insufficientEvidence: true, evidenceAttemptIds: ['a'] }] } }
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  api.getLearnerProfile.mockResolvedValue(profile())
  api.saveSkillProfile.mockResolvedValue({})
  api.saveLearnerState.mockResolvedValue('/Downloads/learning.yaml')
})
it('opens quotes from the estimate and shows uncertainty without calling it proficiency', async () => {
  const data = profile()
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  expect(await screen.findByText('Not enough independent evidence')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: data.evidence.catalog.find(node => node.id === data.model.constructs[0].constructId)!.label }))
  expect(screen.getByText('Hola.')).toBeVisible()
  expect(screen.getByText('You greeted your partner.')).toBeVisible()
  expect(screen.getByText(/Contributes to the selected estimates/)).toBeVisible()
})
it('persists exclusions with the captured revision then reloads evidence and permits restore', async () => {
  const data = profile()
  api.getLearnerProfile.mockResolvedValueOnce(data)
  const excluded = structuredClone(data)
  excluded.evidence.profile.choices.excluded_attempts = ['a']
  excluded.model.constructs = []
  api.getLearnerProfile.mockResolvedValue(excluded)
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  await screen.findByText('Not enough independent evidence')
  fireEvent.change(screen.getByLabelText('Inspect evidence'), { target: { value: data.model.constructs[0].constructId } })
  fireEvent.click(screen.getByRole('button', { name: 'Exclude attempt' }))
  expect(await screen.findByRole('button', { name: 'Restore attempt' })).toBeVisible()
  expect(api.saveSkillProfile).toHaveBeenCalledWith({ ...data.evidence.profile.choices, excluded_attempts: ['a'] })
  fireEvent.click(screen.getByRole('button', { name: 'Restore attempt' }))
  await waitFor(() => expect(api.saveSkillProfile).toHaveBeenLastCalledWith({ ...excluded.evidence.profile.choices, excluded_attempts: [] }))
})
it('keeps evidence and shows failed exclusion rather than claiming success', async () => {
  api.saveSkillProfile.mockRejectedValue(new Error('Revision changed'))
  const data = profile()
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  await screen.findByText('Not enough independent evidence')
  fireEvent.change(screen.getByLabelText('Inspect evidence'), { target: { value: data.model.constructs[0].constructId } })
  fireEvent.click(screen.getByRole('button', { name: 'Exclude attempt' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Revision changed')
  expect(screen.getByRole('button', { name: 'Exclude attempt' })).toBeEnabled()
})
it('does not display a previous language when its request finishes late', async () => {
  let finish!: (value: LearnerProfile) => void
  api.getLearnerProfile.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const data = profile()
  const view = render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  const other = profile(); other.scope.languageId = 'arabic'; other.model.languageId = 'arabic'; other.evidence.target = 'arabic'; other.model.constructs = []; other.evidence.records = []
  api.getLearnerProfile.mockResolvedValue(other)
  view.rerender(<LearnerModel target="arabic" onClose={() => {}} />)
  await screen.findByText(/No usable learning evidence/)
  finish(data)
  await waitFor(() => expect(screen.queryByText('Not enough independent evidence')).not.toBeInTheDocument())
})
it('filters source evidence by variety without treating absent evidence as failure', async () => {
  const data = profile()
  const second = structuredClone(data.model.constructs[0]); second.varietyId = 'spanish-spain'; second.evidenceAttemptIds = []
  data.model.constructs.push(second)
  api.getLearnerProfile.mockResolvedValue(data)
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  await screen.findByLabelText('Variety')
  fireEvent.change(screen.getByLabelText('Variety'), { target: { value: 'spanish-spain' } })
  fireEvent.change(screen.getByLabelText('Inspect evidence'), { target: { value: second.constructId } })
  expect(screen.getByText('No recorded evidence for this skill.')).toBeVisible()
  expect(screen.queryByText('Hola.')).not.toBeInTheDocument()
})

it('exports the selected language rather than frontend estimates or a variety-filtered subset', async () => {
  const data = profile()
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  const save = await screen.findByRole('button', { name: 'Save YAML' })
  fireEvent.change(screen.getByLabelText('Variety'), { target: { value: 'spanish-mexico' } })
  fireEvent.click(save)
  expect(await screen.findByRole('status')).toHaveTextContent('Saved to /Downloads/learning.yaml')
  expect(api.saveLearnerState).toHaveBeenCalledExactlyOnceWith(data.evidence.target)
})
it('previews saved learning YAML without creating a file', async () => {
  const target = profile().evidence.target
  api.learnerStateYaml.mockResolvedValue('languageId: es\nobservations: []\n')
  render(<LearnerModel target={target} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'View YAML' }))
  fireEvent.click(screen.getByRole('button', { name: 'View YAML' }))
  expect(await screen.findByLabelText('Learning evidence YAML content')).toHaveTextContent('languageId: es')
  expect(api.learnerStateYaml).toHaveBeenCalledExactlyOnceWith(target)
  expect(api.saveLearnerState).not.toHaveBeenCalled()
})
it('reports a failed export without claiming a file was saved', async () => {
  api.saveLearnerState.mockRejectedValue(new Error('Downloads is unavailable'))
  render(<LearnerModel target={profile().evidence.target} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Save YAML' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Downloads is unavailable')
  expect(screen.queryByText(/Saved to/)).not.toBeInTheDocument()
})
it('ignores a late export result after switching language', async () => {
  let finish!: (path: string) => void
  api.saveLearnerState.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<LearnerModel target={profile().evidence.target} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Save YAML' }))
  expect(screen.getByRole('button', { name: 'Saving evidence…' })).toBeDisabled()
  const other = profile(); other.evidence.target = 'arabic'; other.model.languageId = 'arabic'; other.scope.languageId = 'arabic'
  api.getLearnerProfile.mockResolvedValue(other)
  view.rerender(<LearnerModel target="arabic" onClose={() => {}} />)
  await screen.findByRole('button', { name: 'Save YAML' })
  finish('/Downloads/old-language.yaml')
  await waitFor(() => expect(screen.queryByText(/old-language/)).not.toBeInTheDocument())
})

it('groups estimates by registry lens and keeps partner-filtered exports language-wide', async () => {
  const data = profile()
  const scoped = structuredClone(data); scoped.scope.personaId='p1'
  api.getLearnerProfile.mockResolvedValueOnce(data).mockResolvedValue(scoped)
  render(<LearnerModel target={data.evidence.target} onClose={()=>{}} />)
  await screen.findByRole('rowheader',{name:'Pragmatics'})
  fireEvent.change(screen.getByLabelText('Partner'),{target:{value:'p1'}})
  await screen.findByText('Not enough independent evidence')
  expect(api.getLearnerProfile).toHaveBeenLastCalledWith(data.evidence.target,'p1')
  expect(screen.getByText('0 language-wide practice XP')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Save YAML'}))
  await screen.findByText('Saved to /Downloads/learning.yaml')
  expect(api.saveLearnerState).toHaveBeenCalledExactlyOnceWith(data.evidence.target)
})
it('ignores late partner estimates and keeps the newer partner selection', async () => {
  const data=profile()
  let finish!: (value:LearnerProfile)=>void
  const latest=structuredClone(data); latest.scope.personaId='p2'; latest.model.constructs=[]; latest.evidence.records=[]
  api.getLearnerProfile.mockResolvedValueOnce(data).mockReturnValueOnce(new Promise(resolve=>{finish=resolve})).mockResolvedValue(latest)
  render(<LearnerModel target={data.evidence.target} onClose={()=>{}} />)
  await screen.findByText('Not enough independent evidence')
  fireEvent.change(screen.getByLabelText('Partner'),{target:{value:'p1'}})
  expect(screen.queryByText('Not enough independent evidence')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Partner'),{target:{value:'p2'}})
  await screen.findByText(/No usable learning evidence/)
  const old=structuredClone(data);old.scope.personaId='p1'
  await act(async()=>finish(old))
  expect(screen.getByLabelText('Partner')).toHaveValue('p2')
  expect(screen.queryByText('Not enough independent evidence')).not.toBeInTheDocument()
})
it('rejects a profile returned for the wrong partner', async()=>{
  const data=profile(); const wrong=structuredClone(data); wrong.scope.personaId='p2'
  api.getLearnerProfile.mockResolvedValueOnce(data).mockResolvedValue(wrong)
  render(<LearnerModel target={data.evidence.target} onClose={()=>{}} />)
  await screen.findByText('Not enough independent evidence')
  fireEvent.change(screen.getByLabelText('Partner'),{target:{value:'p1'}})
  expect(await screen.findByRole('alert')).toHaveTextContent('Profile ownership mismatch')
  expect(screen.queryByText('Not enough independent evidence')).not.toBeInTheDocument()
})

it('does not surface a late exclusion failure in a different language', async()=>{
  const data=profile(); let fail!: (error:Error)=>void
  api.saveSkillProfile.mockReturnValueOnce(new Promise((_resolve,reject)=>{fail=reject}))
  const view=render(<LearnerModel target={data.evidence.target} onClose={()=>{}} />)
  await screen.findByText('Not enough independent evidence')
  fireEvent.change(screen.getByLabelText('Inspect evidence'),{target:{value:data.model.constructs[0].constructId}})
  fireEvent.click(screen.getByRole('button',{name:'Exclude attempt'}))
  const other=profile();other.scope.languageId='arabic';other.model.languageId='arabic';other.evidence.target='arabic'
  api.getLearnerProfile.mockResolvedValue(other)
  view.rerender(<LearnerModel target="arabic" onClose={()=>{}} />)
  await screen.findByText('Not enough independent evidence')
  await act(async()=>fail(new Error('Old scope changed')))
  expect(screen.queryByText('Old scope changed')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Partner')).toBeEnabled()
})
