// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ProgressSummary } from './ProgressSummary'
import { SkillNavigationProvider } from '../../hooks/useSkillNavigation'
import { skillDemo } from '../../lib/skillDemo'

const backend = vi.hoisted(() => ({ getPracticeOverview: vi.fn() }))
vi.mock('../../lib/skills', async original => ({ ...await original<typeof import('../../lib/skills')>(), ...backend }))

it('separates global activity from language tabs and keeps an unused language empty', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const spanish = structuredClone(skillDemo)
  spanish.conversation_count = 1
  const skill = spanish.profile.skills[0]
  Object.assign(skill, { xp: 10, successes: 1, checked: true })
  spanish.profile.xp = 10
  spanish.profile.credits = [{ attempt_id: 'a', skill_id: skill.skill_id, xp: 10 }]
  spanish.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'Esa taza.', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, at_secs: 100, model: 'test', provider_mode: 'custom', catalog_version: 4, prompt_version: 'v1', status: 'complete', assessment: { judgments: [{ skill_id: skill.skill_id, outcome: 'demonstrated', quotes: ['taza'], rationale: 'Identifies the cup.' }] }, error: null }]
  const arabic = structuredClone(skillDemo)
  arabic.target = 'ar'; arabic.profile.choices.target = 'ar'
  backend.getPracticeOverview.mockResolvedValue({ languages: [{ name: 'Spanish', endonym: 'Español', snapshot: spanish }, { name: 'Arabic', endonym: 'العربية', snapshot: arabic }] })
  render(<SkillNavigationProvider><ProgressSummary snapshot={spanish} onClose={vi.fn()} /></SkillNavigationProvider>)
  expect(await screen.findByRole('heading', { name: 'Spanish progress' })).toBeVisible()
  expect(screen.getByText('Total practice XP').parentElement).toHaveTextContent('10')
  expect(screen.getByText('Practice XP').parentElement).toHaveTextContent('10')
  const domain = skillDemo.catalog.find(node => node.kind === 'domain')!
  fireEvent.click(screen.getByRole('button', { name: `${domain.label} 10 XP` }))
  expect(screen.getByRole('heading', { name: `${domain.label} · skill evidence` })).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Arabic 0 XP' }))
  expect(screen.getByText('We don’t have any experience for this language yet.')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Spanish progress' })).toBeNull()
  expect(screen.getByText('Total practice XP').parentElement).toHaveTextContent('10')
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Arabic 0 XP' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('heading', { name: 'Spanish progress' })).toBeVisible()
})
