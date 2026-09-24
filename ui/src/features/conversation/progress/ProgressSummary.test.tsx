import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ProgressSummary } from './ProgressSummary'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'

const backend = vi.hoisted(() => ({ getPracticeOverview: vi.fn() }))
vi.mock('../../../platform/ipc/skill-evidence', async original => ({ ...await original<typeof import('../../../platform/ipc/skill-evidence')>(), ...backend }))

it('separates global activity from language tabs and keeps an unused language empty', async () => {
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
  expect(screen.getByText('We don’t have any experience for this language yet.')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Spanish progress' })).toBeNull()
  expect(screen.getByText('Total practice XP').parentElement).toHaveTextContent('1')
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Arabic 0 XP' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('heading', { name: 'Spanish progress' })).toBeVisible()
})
