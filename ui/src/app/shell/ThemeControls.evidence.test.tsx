// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { DEFAULT_APPEARANCE } from '../../generated/contracts'
import { useAppearance } from '../../platform/appearance/useAppearance'
import { useLoadSkillEvidence } from '../../state/learning/useSkillEvidence'
import { useSkillEvidenceStore } from '../../state/learning/skill-evidence'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'
import { TopBar } from './TopBar'

const native = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), evidence: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => ({ getSettings: native.get, saveSettings: native.save, isTauri: true }))
vi.mock('../../platform/ipc/skill-evidence', () => ({
  getSkillEvidence: native.evidence,
  getLanguageTotals: vi.fn(async () => []),
}))

const snapshot = { ...skillDemo, profile: { ...skillDemo.profile, xp: 1234 } }
function ShellBar() {
  const settings = useSettingsStore(state => state.settings)
  useAppearance(settings)
  useLoadSkillEvidence()
  return <TopBar languagePicker={<span>Español</span>} />
}

beforeEach(() => {
  native.get.mockReset()
  native.save.mockReset()
  native.evidence.mockReset().mockImplementation(() => new Promise(() => {}))
  let saved = {
    theme: 'light', appearance: { ...DEFAULT_APPEARANCE }, interface_locale: 'english',
    target_language: snapshot.target,
    scope: { sessionId: 'session', conversationId: 'chat', settingsRevision: 1, learnerRevision: 1, rewardRevision: 1 },
  } as Settings
  native.get.mockImplementation(async () => saved)
  native.save.mockImplementation(async (next: Settings) => {
    saved = { ...next, scope: { ...saved.scope!, learnerRevision: saved.scope!.learnerRevision + 1 } }
  })
  useSettingsStore.setState({ settings: saved })
  useSkillEvidenceStore.setState({ snapshot, scope: 0 })
})

it('keeps the skill badge and XP mounted through light/dark saves', async () => {
  render(<ShellBar />)
  const progress = screen.getByRole('button', { name: 'Language progress' })
  await within(progress).findByLabelText('Total XP: 0')
  const badge = within(progress).getByText('Lv 0')
  const xp = within(progress).getByLabelText('Language XP: 1,234')
  const content = progress.innerHTML
  const toggle = screen.getByRole('button', { name: 'Dark theme' })
  for (const theme of ['dark', 'light', 'dark']) {
    fireEvent.click(toggle)
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe(theme))
    expect(toggle).toHaveAttribute('aria-pressed', String(theme === 'dark'))
    expect(badge).toBeInTheDocument()
    expect(xp).toBeInTheDocument()
    expect(progress.innerHTML).toBe(content)
  }
  expect(native.save).toHaveBeenCalledTimes(3)
  expect(native.evidence).not.toHaveBeenCalled()
})

it('keeps the progress content mounted through palette saves', async () => {
  render(<ShellBar />)
  const progress = screen.getByRole('button', { name: 'Language progress' })
  await within(progress).findByLabelText('Total XP: 0')
  const content = progress.innerHTML
  fireEvent.click(screen.getByRole('button', { name: 'Surface palette' }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Warm' }))
  await waitFor(() => expect(document.documentElement.dataset.palette).toBe('warm'))
  expect(progress.innerHTML).toBe(content)
  expect(native.evidence).not.toHaveBeenCalled()
})
