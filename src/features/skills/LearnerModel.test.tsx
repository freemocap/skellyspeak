// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearnerModel } from './LearnerModel'
import { skillDemo } from '../../domain/skills/skillDemo'
import type { LearnerProfile } from '../../platform/ipc/learner-profile'
const api = vi.hoisted(() => ({ getLearnerProfile: vi.fn(), saveSkillProfile: vi.fn(), reload: vi.fn() }))
vi.mock('../../platform/ipc/learner-profile', () => api)
vi.mock('../../platform/skill-evidence', () => api)
vi.mock('../../state/skill-evidence', () => ({ useSkillEvidenceStore: { getState: () => ({ reload: api.reload }) } }))
function profile(): LearnerProfile {
  const evidence = structuredClone(skillDemo)
  const id = evidence.catalog.find(node => node.kind === 'skill')!.id
  evidence.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'hash', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: evidence.learner_id, target: evidence.target, variety: 'es-MX', native: 'en', source: 'Hola.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: evidence.catalog_version, prompt_version: 'v1', status: 'complete', assessment: { judgments: [{ skill_id: id, outcome: 'demonstrated', quotes: ['Hola'], rationale: 'You greeted your partner.' }] }, error: null }]
  return { evidence, model: { learnerId: evidence.learner_id, languageId: evidence.target, asOfSecs: 100, configHash: 'c', constructRegistryHash: 'hash', estimatorHash: 'e', estimatorVersion: 1, calibration: 'uncalibrated_product_heuristic', choices: {}, observations: [], constructs: [{ constructId: id, varietyId: 'es-MX', rating: 0.5, uncertainty: 0.8, lastSeen: 100, halfLifeDays: 1, n: 2, independentN: 1, effectiveN: 1.5, recall: 1, dueAt: 200, due: false, insufficientEvidence: true, evidenceAttemptIds: ['a'] }] } }
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  api.getLearnerProfile.mockResolvedValue(profile())
  api.saveSkillProfile.mockResolvedValue({})
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
  const other = profile(); other.model.languageId = 'ar'; other.evidence.target = 'ar'; other.model.constructs = []; other.evidence.records = []
  api.getLearnerProfile.mockResolvedValue(other)
  view.rerender(<LearnerModel target="ar" onClose={() => {}} />)
  await screen.findByText(/No usable learning evidence/)
  finish(data)
  await waitFor(() => expect(screen.queryByText('Not enough independent evidence')).not.toBeInTheDocument())
})
it('filters source evidence by variety without treating absent evidence as failure', async () => {
  const data = profile()
  const second = structuredClone(data.model.constructs[0]); second.varietyId = 'es-ES'; second.evidenceAttemptIds = []
  data.model.constructs.push(second)
  api.getLearnerProfile.mockResolvedValue(data)
  render(<LearnerModel target={data.evidence.target} onClose={() => {}} />)
  await screen.findByLabelText('Variety')
  fireEvent.change(screen.getByLabelText('Variety'), { target: { value: 'es-ES' } })
  fireEvent.change(screen.getByLabelText('Inspect evidence'), { target: { value: second.constructId } })
  expect(screen.getByText('No recorded evidence for this skill.')).toBeVisible()
  expect(screen.queryByText('Hola.')).not.toBeInTheDocument()
})
