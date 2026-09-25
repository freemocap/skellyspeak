import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProfileOverlay } from './ProfileOverlay'
import { useNavigationStore } from '../../state/navigation/navigation'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { PracticeOverview } from '../../domain/learning/evidence/skills'
const api = vi.hoisted(() => ({ getPracticeOverview: vi.fn() }))
vi.mock('../../platform/ipc/skill-evidence', async original => ({ ...await original<typeof import('../../platform/ipc/skill-evidence')>(), ...api }))
vi.mock('../../state/learning/useSkillEvidence', async original => ({ ...await original<typeof import('../../state/learning/useSkillEvidence')>(), useSkillEvidence: () => ({ snapshot: null, error: null }) }))
beforeEach(() => {
  vi.clearAllMocks()
  useNavigationStore.setState({ overlay: 'profile' })
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
it('opens without the shared snapshot and renders all zero-credit skills from native data', async () => {
  let resolve!: (value: PracticeOverview) => void
  api.getPracticeOverview.mockReturnValue(new Promise(done => { resolve = done }))
  render(<ProfileOverlay />)
  expect(screen.queryByText('Language evidence is not connected.')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading language profiles')
  await act(async () => resolve({ languages: [{ name: 'Spanish', endonym: 'Español', snapshot: structuredClone(skillDemo) }] }))
  expect(screen.getByRole('heading', { name: 'Spanish progress' })).toBeVisible()
  expect(document.querySelectorAll('[data-reward-skill]')).toHaveLength(12)
  expect(screen.getByText('Practice XP').parentElement).toHaveTextContent('0')
})
it('reports an actual read failure instead of inventing a zero history', async () => {
  api.getPracticeOverview.mockRejectedValue(new Error('Database read failed'))
  render(<ProfileOverlay />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Database read failed')
  expect(screen.getByRole('button', { name: 'Retry profiles' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Dismiss error' })).not.toBeInTheDocument()
  const cards = document.querySelectorAll('.scene-card')
  expect(cards).toHaveLength(12)
  fireEvent.click(cards[0])
  expect(screen.getByRole('heading', { name: 'Identify and describe' })).toBeVisible()
  expect(cards[0]).toHaveTextContent('— XP')
  expect(screen.queryByText('Language evidence is not connected.')).not.toBeInTheDocument()
})

beforeEach(() => { useSettingsStore.setState({settings: {my_languages: [skillDemo.target, 'arabic']} as Settings}) })
