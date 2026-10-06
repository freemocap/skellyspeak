import { beforeEach, expect, it, vi } from 'vitest'
import { openLanguageProgress } from './language-progress'
import { useNavigationStore } from './navigation'
import { useSettingsStore } from '../settings/settings'
import { useFaultStore } from '../../platform/diagnostics/faults'
import type { Settings } from '../../types'

vi.mock('../../platform/ipc/tauri', async original => ({ ...(await original<object>()), languages: () => [
  { code: 'spanish', base: 'spanish', name: 'Spanish', endonym: 'Español', defaultVariety: 'spanish-mexico', varieties: [{ id: 'spanish-mexico', label: 'Mexico' }, { id: 'spanish-spain', label: 'Spain' }] },
  { code: 'french', base: 'french', name: 'French', endonym: 'Français', defaultVariety: 'french-france', varieties: [{ id: 'french-france', label: 'France' }] },
] }))

const select = vi.fn<(language: string, variety: string) => Promise<void>>()
beforeEach(() => {
  select.mockReset().mockResolvedValue(undefined)
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSettingsStore.setState({ settings: { target_language: 'french', target_varieties: { spanish: 'spanish-spain' } } as unknown as Settings, selectLanguageVariety: select })
})

it('switches to the language with its last variety, then opens the requested tab', async () => {
  await openLanguageProgress('spanish', 'effort')
  expect(select).toHaveBeenCalledWith('spanish', 'spanish-spain')
  expect(useNavigationStore.getState()).toMatchObject({ page: 'skills', progressTab: 'effort' })
})

it('only opens the page for the active language', async () => {
  await openLanguageProgress('french', 'xp')
  expect(select).not.toHaveBeenCalled()
  expect(useNavigationStore.getState()).toMatchObject({ page: 'skills', progressTab: 'xp' })
})

it('reports a failed switch and leaves the page closed', async () => {
  select.mockRejectedValue(new Error('A language change is already being saved.'))
  await openLanguageProgress('spanish', 'xp')
  expect(useNavigationStore.getState().page).toBe('guided')
  expect(useFaultStore.getState().faults.at(-1)?.message).toContain('already being saved')
})
