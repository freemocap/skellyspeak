// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearningPicker } from './LanguagePickers'
import { useSettingsStore } from '../../../state/settings/settings'
import { useNavigationStore } from '../../../state/navigation/navigation'
import type { Settings } from '../../../types'
vi.mock('../../../platform/ipc/tauri', () => ({ languages: () => [
  {code:'spanish',name:'Spanish',endonym:'Español'},
  {code:'french',name:'French',endonym:'Français'},
  {code:'german',name:'German',endonym:'Deutsch'},
]}))
const change = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  useSettingsStore.setState({...useSettingsStore.getInitialState(),settings:{target_language:'spanish',my_languages:['french']} as Settings,setLanguage:change})
  useNavigationStore.setState(useNavigationStore.getInitialState())
})
it('shows saved shortcuts and the current language, with Add language opening the browser', () => {
  render(<LearningPicker />)
  expect(screen.getAllByRole('option').map(item => item.textContent)).toEqual(['Español (Spanish)','Français (French)','Add language…'])
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'__add_language__'}})
  expect(useNavigationStore.getState().overlay).toBe('languages')
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveValue('spanish')
})
it('switches only when selecting an existing language shortcut', () => {
  render(<LearningPicker />)
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'french'}})
  expect(change).toHaveBeenCalledWith('target_language','french')
})
