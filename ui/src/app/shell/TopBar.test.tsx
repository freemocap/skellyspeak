// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useConnectionHealth } from '../../state/session/connection-health'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSessionStore } from '../../state/session/session'
import type { Settings } from '../../types'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('../../components/layout/useIsMobile', () => ({ useIsMobile: () => viewport.mobile }))
vi.mock('../../state/learning/useSkillEvidence', () => ({ useSkillEvidence: () => ({ snapshot: null }) }))
vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true, languages: () => [
  {code:'spanish',base:'spanish',name:'Spanish',endonym:'Español'}, {code:'french',base:'french',name:'French',endonym:'Français'}
] }))
beforeEach(() => {
  useConnectionHealth.setState({ routes: {} })
  viewport.mobile = false
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSessionStore.setState(useSessionStore.getInitialState())
  useSettingsStore.setState({...useSettingsStore.getInitialState(), settings: {target_language:'spanish'} as Settings})
})
it.each(['hosted', 'openrouter', 'custom'] as const)('opens AI access from the %s setup status', route => {
  useSessionStore.setState({ connection: {
    route, signedIn: false, ownKeyConfigured: false, email: '', revision: 1,
    configured: false, standardModel: 'standard', fastModel: 'fast', transcriptionModel: 'whisper-large-v3', paused: false,
  } })
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'AI Not Connected' }))
  expect(useNavigationStore.getState().overlay).toBe('settings')
})
it.each([false, true])('keeps history and target language reachable with mobile=%s', mobile => {
  viewport.mobile = mobile
  const setLanguage = vi.fn()
  useSettingsStore.setState({setLanguage})
  useNavigationStore.getState().openSkills()
  render(<TopBar />)
  fireEvent.change(screen.getByRole('combobox', {name:'Target language'}), {target:{value:'french'}})
  expect(setLanguage).toHaveBeenCalledExactlyOnceWith('target_language','french')
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

it('opens the language browser alongside the compact selector', () => {
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'Browse languages' }))
  expect(useNavigationStore.getState().overlay).toBe('languages')
  expect(screen.getByRole('combobox', { name: 'Target language' })).toBeInTheDocument()
})


it('shows a clickable connected state only after a successful check at the current revision', () => {
  useSessionStore.setState({ connection: {
    route: 'custom', signedIn: false, ownKeyConfigured: false, email: '', revision: 9,
    configured: true, standardModel: 'standard', fastModel: 'fast', transcriptionModel: 'whisper-large-v3', paused: false,
  } })
  const view = render(<TopBar />)
  expect(screen.getByRole('button', { name: 'AI Not Connected' })).toBeInTheDocument()
  useConnectionHealth.getState().record('custom', 9)
  view.rerender(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'AI Connected' }))
  expect(useNavigationStore.getState().overlay).toBe('settings')
  useSessionStore.setState(state => ({ connection: { ...state.connection!, revision: 10 } }))
  view.rerender(<TopBar />)
  expect(screen.getByRole('button', { name: 'AI Not Connected' })).toBeInTheDocument()
})
