import { useSettingsStore } from '../../../state/settings/settings'
import type { Settings } from '../../../types'
import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProgressSummary } from './ProgressSummary'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'

const backend = vi.hoisted(() => ({ getPracticeOverview: vi.fn() }))
vi.mock('../../../platform/ipc/skill-evidence', async original => ({ ...await original<typeof import('../../../platform/ipc/skill-evidence')>(), ...backend }))

it('separates global activity from language tabs and shows every skill at zero for an unused language', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const spanish = structuredClone(skillDemo)
  spanish.conversation_count = 1
  const skill = spanish.profile.skills[0]
  Object.assign(skill, { xp: 1, experience: 1, checked: true })
  spanish.profile.xp = 1
  spanish.profile.credits = [{ attempt_id: 'a', skill_id: skill.skill_id, xp: 1, experience: 1, effort: 0, event: { id: `a:${skill.skill_id}`, attemptId: 'a', constructId: skill.skill_id, kind: 'experience', tier: 1, xp: 1, experience: 1, effort: 0, quote: 'Esa taza.', support: 'not_weighted', difficulty: 'not_weighted', novelty: 'not_weighted', policyHash: 'experience-effort-1', atSecs: 100n, claimed: false } }]
  spanish.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'Esa taza.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'v1', status: 'complete', assessment: { judgments: [{ skill_id: skill.skill_id, presence: 'direct', quotes: ['taza'], rationale: 'Identifies the cup.' }] }, error: null }]
  const arabic = structuredClone(skillDemo)
  arabic.target = 'arabic'; arabic.profile.choices.target = 'arabic'
  backend.getPracticeOverview.mockResolvedValue({ languages: [{ name: 'Spanish', endonym: 'Español', snapshot: spanish }, { name: 'Arabic', endonym: 'العربية', snapshot: arabic }] })
  render(<ProgressSummary snapshot={spanish} onClose={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: 'Spanish progress' })).toBeVisible()
  expect(screen.getByText('Total practice XP').parentElement).toHaveTextContent('1')
  expect(screen.getByText('Practice XP').parentElement).toHaveTextContent('1')
  const domain = skillDemo.catalog.find(node => node.kind === 'domain')!
  fireEvent.click(document.querySelector(`[data-reward-skill="${skill.skill_id}"]`)!)
  expect(screen.getByRole('heading', { name: `${domain.label} · skill evidence` })).toBeVisible()
  const report = screen.getByRole('dialog', { name: 'Identify and describe' })
  expect(within(report).getByText('Esa taza.')).toBeVisible()
  expect(within(report).getByText('Identifies the cup.')).toBeVisible()
  fireEvent.click(within(report).getByRole('button', { name: 'Close Identify and describe' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Arabic 0 XP' }))
  expect(screen.getByRole('heading', { name: 'Arabic progress' })).toBeVisible()
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(12)
  expect(screen.getByText('Practice XP').parentElement).toHaveTextContent('0')
  expect(screen.getByRole('checkbox', { name: 'Include skills without credit' })).toBeChecked()
  expect(screen.queryByRole('heading', { name: 'Spanish progress' })).toBeNull()
  expect(screen.getByText('Total practice XP').parentElement).toHaveTextContent('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Arabic 0 XP' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('heading', { name: 'Spanish progress' })).toBeVisible()
})

it('keeps an open skill inspector mounted while a saved-data refresh is pending', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const snapshot = structuredClone(skillDemo)
  backend.getPracticeOverview.mockResolvedValueOnce({languages:[{name:'Spanish',endonym:'Español',snapshot}]})
  const view = render(<ProgressSummary snapshot={snapshot} onClose={vi.fn()} />)
  await screen.findByRole('heading',{name:'Spanish progress'})
  fireEvent.click(document.querySelector('[data-reward-skill]')!)
  expect(screen.getByRole('dialog',{name:'Identify and describe'})).toBeVisible()
  backend.getPracticeOverview.mockReturnValue(new Promise(() => {}))
  view.rerender(<ProgressSummary snapshot={structuredClone(snapshot)} onClose={vi.fn()} />)
  expect(screen.getByRole('dialog',{name:'Identify and describe'})).toBeVisible()
})

beforeEach(() => { useSettingsStore.setState({settings: {my_languages: [skillDemo.target, 'arabic']} as Settings}) })

it('shows only included languages in saved order and opens the existing language manager', async () => {
  const { useNavigationStore } = await import('../../../state/navigation/navigation')
  const spanish = structuredClone(skillDemo)
  const arabic = {...structuredClone(skillDemo), target:'arabic'}
  const german = {...structuredClone(skillDemo), target:'german'}
  arabic.profile.choices.target = 'arabic'
  german.profile.choices.target = 'german'
  useSettingsStore.setState({settings:{my_languages:['arabic',skillDemo.target]} as Settings})
  backend.getPracticeOverview.mockResolvedValue({languages:[
    {name:'Spanish',endonym:'Español',snapshot:spanish},
    {name:'German',endonym:'Deutsch',snapshot:german},
    {name:'Arabic',endonym:'العربية',snapshot:arabic},
  ]})
  render(<ProgressSummary snapshot={spanish} onClose={vi.fn()} />)
  await screen.findByRole('heading',{name:'Spanish progress'})
  expect(screen.getAllByRole('tab').map(tab => tab.getAttribute('aria-label'))).toEqual(['Arabic 0 XP','Spanish 0 XP'])
  expect(screen.queryByRole('tab',{name:'German 0 XP'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Add language…'}))
  expect(useNavigationStore.getState().overlay).toBe('languages')
})
