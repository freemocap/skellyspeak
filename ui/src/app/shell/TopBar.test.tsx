// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useConnectionHealth } from '../../state/session/connection-health'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSessionStore } from '../../state/session/session'
import type { Settings } from '../../types'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { useAiBusyStore } from '../../state/session/ai-busy'

const viewport = vi.hoisted(() => ({ mobile: false }))
vi.mock('../../components/layout/useIsMobile', () => ({ useIsMobile: () => viewport.mobile }))
vi.mock('../../state/learning/useSkillEvidence', () => ({ useSkillEvidence: () => ({ snapshot: null }) }))
const windowApi = vi.hoisted(() => ({ openAiWindow: vi.fn() }))
vi.mock('../../platform/ipc/window', () => ({ ...windowApi, aiWindowState: async () => ({ supported: true, open: false }) }))
vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true, languages: () => [
  {code:'spanish',base:'spanish',name:'Spanish',endonym:'Español'}, {code:'french',base:'french',name:'French',endonym:'Français'}
] }))
beforeEach(() => {
  useConnectionHealth.setState({ routes: {} })
  viewport.mobile = false
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSessionStore.setState(useSessionStore.getInitialState())
  useSettingsStore.setState({...useSettingsStore.getInitialState(), settings: {my_languages:['spanish','french'], target_varieties:{}, target_language:'spanish'} as Settings})
})
it.each(['hosted', 'openrouter', 'custom'] as const)('opens AI access from the %s setup status', route => {
  useSessionStore.setState({ connection: {
    route, signedIn: false, ownKeyConfigured: false, email: '', revision: 1,
    configured: false, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
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
it('returns from review to conversation history and preserves secondary navigation', () => {
  useNavigationStore.getState().setMode('review')
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', {name:'Conversations'}))
  expect(useNavigationStore.getState()).toMatchObject({mode:'practice',historyOpen:true})
  fireEvent.click(screen.getByRole('button', {name:'More'}))
  expect(useNavigationStore.getState().overlay).toBe('more')
})

it('opens the language browser alongside the compact selector', () => {
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'My languages' }))
  expect(useNavigationStore.getState().overlay).toBe('languages')
  expect(screen.getByRole('combobox', { name: 'Target language' })).toBeInTheDocument()
})


it('shows a clickable connected state only after a successful check at the current revision', () => {
  useSessionStore.setState({ connection: {
    route: 'custom', signedIn: false, ownKeyConfigured: false, email: '', revision: 9,
    configured: true, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
  } })
  const view = render(<TopBar />)
  expect(screen.getByRole('button', { name: 'AI Not Connected' })).toBeInTheDocument()
  useConnectionHealth.getState().record('custom', 9)
  view.rerender(<TopBar />)
  // Connected, the status opens the AI View; AI access stays under Settings.
  fireEvent.click(screen.getByRole('button', { name: 'AI Connected' }))
  expect(useNavigationStore.getState().overlay).toBe('activity')
  useSessionStore.setState(state => ({ connection: { ...state.connection!, revision: 10 } }))
  view.rerender(<TopBar />)
  expect(screen.getByRole('button', { name: 'AI Not Connected' })).toBeInTheDocument()
})

it('updates the System theme toggle when the OS appearance changes', async () => {
  const original = window.matchMedia
  let matches = false
  const listeners = new Set<() => void>()
  window.matchMedia = vi.fn(() => ({ matches, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }) as unknown as MediaQueryList)
  const update = vi.fn()
  useSettingsStore.setState({ settings: { my_languages:['spanish','french'], target_varieties:{}, target_language: 'spanish', theme: 'system' } as Settings, update })
  const view = render(<TopBar />)
  try {
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
    const { act } = await import('@testing-library/react')
    act(() => { matches = true; listeners.forEach(listener => listener()) })
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(update.mock.calls[0][0]({ theme: 'system' }).theme).toBe('light')
  } finally {
    view.unmount()
    window.matchMedia = original
  }
})

function connect() {
  useSessionStore.setState({ connection: {
    route: 'hosted', signedIn: true, ownKeyConfigured: false, email: '', revision: 1,
    configured: true, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
  } })
  useConnectionHealth.setState({ routes: { hosted: { revision: 1, status: 'connected', checkedAt: 1, error: null } } })
}

it('opens and closes the AI View from the connected status, and pulses while AI works', () => {
  connect()
  useAiWindowStore.setState({ supported: true, open: false })
  useAiBusyStore.setState({ busy: true })
  render(<TopBar />)
  const button = screen.getByRole('button', { name: 'AI Connected' })
  expect(button).toHaveAttribute('data-busy', 'true')
  fireEvent.click(button)
  expect(useNavigationStore.getState().overlay).toBe('activity')
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(button)
  expect(useNavigationStore.getState().overlay).toBeNull()
  useAiBusyStore.setState({ busy: false })
})

it('focuses the popped-out AI window instead of opening a second view', () => {
  connect()
  windowApi.openAiWindow.mockResolvedValue(undefined)
  useAiWindowStore.setState({ supported: true, open: true })
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'AI Connected' }))
  expect(windowApi.openAiWindow).toHaveBeenCalledOnce()
  expect(useNavigationStore.getState().overlay).toBeNull()
  useAiWindowStore.setState({ supported: false, open: false })
})
