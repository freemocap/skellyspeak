// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('../../components/layout/useIsMobile', () => ({ useIsMobile: () => viewport.mobile }))
vi.mock('../../state/learning/useSkillEvidence', () => ({ useSkillEvidence: () => ({ snapshot: null }) }))
vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true, languages: () => [
  {code:'es',base:'es',name:'Spanish',endonym:'Español'}, {code:'fr',base:'fr',name:'French',endonym:'Français'}
] }))
beforeEach(() => {
  viewport.mobile = false
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSettingsStore.setState({...useSettingsStore.getInitialState(), settings: {target_language:'es'} as Settings})
})
it.each([false, true])('keeps history and target language reachable with mobile=%s', mobile => {
  viewport.mobile = mobile
  const setLanguage = vi.fn()
  useSettingsStore.setState({setLanguage})
  useNavigationStore.getState().openSkills()
  render(<TopBar />)
  fireEvent.change(screen.getByRole('combobox', {name:'Target language'}), {target:{value:'fr'}})
  expect(setLanguage).toHaveBeenCalledExactlyOnceWith('target_language','fr')
  fireEvent.click(screen.getByRole('button', {name:'Conversations'}))
  expect(useNavigationStore.getState()).toMatchObject({page:'guided',mode:'practice',historyOpen:true})
  expect(screen.queryByRole('navigation', {name:'Main navigation'})).toBeNull()
})
it('disables language switching during a save or settings edit', () => {
  useSettingsStore.setState({savingLanguage:true})
  const view = render(<TopBar />)
  expect(screen.getByRole('combobox', {name:'Target language'})).toBeDisabled()
  useSettingsStore.setState({savingLanguage:false})
  useNavigationStore.getState().showOverlay('settings')
  view.rerender(<TopBar />)
  expect(screen.getByRole('combobox', {name:'Target language'})).toBeDisabled()
})
it('returns from a lesson to conversation history and preserves secondary navigation', () => {
  useNavigationStore.getState().setMode('learn')
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', {name:'Conversations'}))
  expect(useNavigationStore.getState()).toMatchObject({mode:'practice',historyOpen:true})
  fireEvent.click(screen.getByRole('button', {name:'More'}))
  expect(useNavigationStore.getState().overlay).toBe('more')
})
