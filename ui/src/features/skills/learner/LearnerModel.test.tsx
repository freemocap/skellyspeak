// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearnerModel } from './LearnerModel'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import type { LearnerProfile } from '../../../platform/ipc/learner-profile'
import { useSkillEvidenceStore } from '../../../state/learning/skill-evidence'
const api = vi.hoisted(() => ({ getLearnerProfile: vi.fn(), saveSkillProfile: vi.fn(), saveLearnerState: vi.fn(), learnerStateYaml: vi.fn() }))
vi.mock('../../../platform/ipc/learner-profile', () => api)
vi.mock('../../../platform/ipc/skill-evidence', () => ({ ...api, getSkillEvidence: vi.fn() }))
function profile(target = skillDemo.target): LearnerProfile {
  const evidence = structuredClone(skillDemo)
  evidence.target = target; evidence.profile.choices.target = target
  const id = evidence.profile.skills[0].skill_id
  evidence.guides = [{ id: 'one', name: 'One', skills: { [id]: 'Guide for one.' } }, { id: 'two', name: 'Two', skills: { [id]: 'Guide for two.' } }]
  evidence.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: evidence.construct_registry_hash, mapping_error: null, support_step: null, chat_id: 'chat', learner_id: evidence.learner_id, target, variety: 'one', native: 'english', source: 'Hola.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: evidence.catalog_version, prompt_version: 'v1', status: 'complete', assessment: { judgments: [{ skill_id: id, presence: 'direct', evidence_kind: 'whole_message', quotes: [], rationale: '' }] }, error: null }]
  Object.assign(evidence.profile.skills[0], { xp: 1, experience: 1 })
  evidence.profile.xp = 1
  evidence.profile.credits = [{ attempt_id: 'a', skill_id: id, xp: 1, experience: 1, effort: 0,
    event: { id: 'a', attemptId: 'a', constructId: id, kind: 'experience', tier: 1, xp: 1,
      experience: 1, effort: 0, quote: '', support: 'not_weighted', difficulty: 'not_weighted',
      novelty: 'not_weighted', policyHash: 'experience-effort-1', atSecs: 1n, claimed: true } }]
  return { evidence, scope: { languageId: target, personaId: null }, partners: [{ personaId: 'p1', name: 'Elena', archived: false }, { personaId: 'p2', name: 'Marta', archived: true }] }
}
const inspect = () => fireEvent.click(screen.getByRole('button', { name: skillDemo.catalog.find(n => n.id === skillDemo.profile.skills[0].skill_id)!.label }))
beforeEach(() => {
  vi.clearAllMocks()
  useSkillEvidenceStore.setState({ snapshot: null, read: null })
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  api.getLearnerProfile.mockResolvedValue(profile())
  api.saveSkillProfile.mockResolvedValue({})
  api.saveLearnerState.mockResolvedValue('/Downloads/learning.yaml')
})
it('shows counts and source evidence with a guide, without rating estimates or refresh controls', async () => {
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  inspect()
  expect(screen.getAllByText('Hola.').some(element => element.closest('blockquote'))).toBe(true)
  expect(screen.getByText('Skill guide')).toBeVisible()
  expect(screen.queryByText('Estimate ± uncertainty')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
})
it('persists exclusions and restoration and reloads the same scope', async () => {
  const data = profile(); const excluded = profile()
  excluded.evidence.profile.choices.excluded_attempts = ['a']
  excluded.evidence.profile.credits = []; excluded.evidence.profile.xp = 0
  Object.assign(excluded.evidence.profile.skills[0], { xp: 0, experience: 0 })
  api.getLearnerProfile.mockResolvedValueOnce(data).mockResolvedValue(excluded)
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience'); inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Exclude attempt' }))
  await screen.findByRole('button', { name: 'Restore attempt' })
  expect(screen.getByRole('row', { name: /^Σ/ })).toHaveTextContent('Σ000')
  api.getLearnerProfile.mockResolvedValue(data)
  fireEvent.click(screen.getByRole('button', { name: 'Restore attempt' }))
  await waitFor(() => expect(api.saveSkillProfile).toHaveBeenLastCalledWith({ ...excluded.evidence.profile.choices, excluded_attempts: [] }))
  await waitFor(() => expect(screen.getByRole('row', { name: /^Σ/ })).toHaveTextContent('Σ101'))
})
it('keeps failed exclusions visible without claiming a change', async () => {
  api.saveSkillProfile.mockRejectedValue(new Error('Revision changed'))
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience'); inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Exclude attempt' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Revision changed')
  expect(screen.getByRole('button', { name: 'Exclude attempt' })).toBeEnabled()
})
it('updates automatically when new evidence is published', async () => {
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  act(() => useSkillEvidenceStore.setState({ snapshot: structuredClone(skillDemo) }))
  await waitFor(() => expect(api.getLearnerProfile).toHaveBeenCalledTimes(2))
})
it('ignores a late language result', async () => {
  let finish!: (value: LearnerProfile) => void
  api.getLearnerProfile.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  api.getLearnerProfile.mockResolvedValue(profile('arabic'))
  view.rerender(<LearnerModel target="arabic" onClose={vi.fn()} />)
  await screen.findByText('Experience')
  await act(async () => finish(profile()))
  expect(api.getLearnerProfile).toHaveBeenLastCalledWith('arabic', null)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('keeps evidence and guide in the inspected variety', async () => {
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  fireEvent.change(screen.getByLabelText('Variety'), { target: { value: 'two' } }); inspect()
  expect(screen.queryByText('Hola.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Skill guide'))
  expect(screen.getByText('Guide for two.')).toBeVisible()
})
it('rejects a wrong partner result and ignores a late prior partner', async () => {
  let finish!: (value: LearnerProfile) => void
  api.getLearnerProfile.mockResolvedValueOnce(profile()).mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValue(profile())
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  fireEvent.change(screen.getByLabelText('Partner'), { target: { value: 'p1' } })
  fireEvent.change(screen.getByLabelText('Partner'), { target: { value: 'p2' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Profile ownership mismatch')
  const old = profile(); old.scope.personaId = 'p1'
  await act(async () => finish(old))
  expect(screen.getByLabelText('Partner')).toHaveValue('p2')
  expect(screen.queryByText('Experience')).not.toBeInTheDocument()
})
it('exports native language-wide evidence and reports failure', async () => {
  render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  expect(await screen.findByText('Saved to /Downloads/learning.yaml')).toBeVisible()
  expect(api.saveLearnerState).toHaveBeenCalledExactlyOnceWith(skillDemo.target)
  api.saveLearnerState.mockRejectedValue(new Error('Downloads is unavailable'))
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Downloads is unavailable')
})
it('ignores export completion after a language switch', async () => {
  let finish!: (path: string) => void
  api.saveLearnerState.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<LearnerModel target={skillDemo.target} onClose={vi.fn()} />)
  await screen.findByText('Experience')
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  api.getLearnerProfile.mockResolvedValue(profile('arabic'))
  view.rerender(<LearnerModel target="arabic" onClose={vi.fn()} />)
  await screen.findByText('Experience')
  await act(async () => finish('/Downloads/old.yaml'))
  expect(screen.queryByText(/old.yaml/)).not.toBeInTheDocument()
})
