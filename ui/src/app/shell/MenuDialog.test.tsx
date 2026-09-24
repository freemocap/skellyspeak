// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MenuDialog } from './MenuDialog'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'

vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true, languages: () => [
  { code: 'spanish', base: 'spanish', name: 'Spanish', endonym: 'Español', defaultVariety: 'spanish-mexico', varieties: [{ id: 'spanish-mexico', label: 'Mexico' }] },
] }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSettingsStore.setState({ ...useSettingsStore.getInitialState(), settings: { my_languages: ['spanish'], target_varieties: {}, target_language: 'spanish' } as Settings })
})

it('stays closed until the menu overlay is shown', () => {
  render(<MenuDialog />)
  expect(screen.queryByRole('group', { name: 'Practice surface' })).not.toBeInTheDocument()
})

it('carries the target language and switches practice mode, closing itself', () => {
  useNavigationStore.getState().showOverlay('menu')
  render(<MenuDialog />)
  expect(screen.getByRole('region', { name: 'Target language' })).toHaveTextContent('Español')
  fireEvent.click(screen.getByRole('button', { name: 'Drill' }))
  expect(useNavigationStore.getState().practiceView).toBe('drill')
  expect(useNavigationStore.getState().overlay).toBeNull()
})
