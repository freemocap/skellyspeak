// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TopBar } from './TopBar'
import { useConnectionHealth } from '../../state/session/connection-health'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSessionStore } from '../../state/session/session'
import type { Settings } from '../../types'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { useAiBusyStore } from '../../state/session/ai-busy'

vi.mock('../../state/learning/useSkillEvidence', () => ({ useSkillEvidence: () => ({ snapshot: null }) }))
vi.mock('../../platform/ipc/skill-evidence', () => ({ getLanguageTotals: vi.fn(async () => [
  { target: 'spanish', name: 'Spanish', nativeName: 'Español', languageTag: 'es', xp: 12, conversations: 2, partnerUnderstood: 1, noIssuesFlagged: 1, revisionsSent: 0, practiceAttempts: 3 },
  { target: 'french', name: 'French', nativeName: 'Français', languageTag: 'fr', xp: 30, conversations: 1, partnerUnderstood: 0, noIssuesFlagged: 0, revisionsSent: 0, practiceAttempts: 0 },
]) }))
const windowApi = vi.hoisted(() => ({ openAiWindow: vi.fn() }))
vi.mock('../../platform/ipc/window', () => ({ ...windowApi, aiWindowState: async () => ({ supported: true, open: false }) }))
vi.mock('../../platform/ipc/tauri', () => ({ isTauri: true, languages: () => [
  {code:'spanish',base:'spanish',name:'Spanish',endonym:'Español',defaultVariety:'spanish-mexico',varieties:[{id:'spanish-mexico',label:'Mexico'}]}, {code:'french',base:'french',name:'French',endonym:'Français',defaultVariety:'french-france',varieties:[{id:'french-france',label:'France'}]}
] }))
beforeEach(() => {
  useConnectionHealth.setState({ routes: {} })
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSessionStore.setState(useSessionStore.getInitialState())
  useSettingsStore.setState({...useSettingsStore.getInitialState(), settings: {my_languages:['spanish','french'], target_varieties:{}, target_language:'spanish'} as Settings})
})
it.each(['hosted', 'custom'] as const)('opens AI access from the %s setup status', route => {
  useSessionStore.setState({ connection: {
    route, signedIn: false, email: '', revision: 1,
    configured: false, assessmentAdapter: 'jev_choice' as const, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
  } })
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'AI Not Connected' }))
  expect(useNavigationStore.getState().overlay).toBe('settings')
})
it('keeps the target language reachable, with the Chat and Practice tabs leading the bar', () => {
  const setLanguage = vi.fn().mockResolvedValue(undefined)
  useSettingsStore.setState({selectLanguageVariety:setLanguage})
  useNavigationStore.getState().openSkills()
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', {name:'Target language'}))
  fireEvent.click(screen.getByRole('button', {name:'Français (French)'}))
  expect(setLanguage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name:'France'}))
  expect(setLanguage).toHaveBeenCalledExactlyOnceWith('french','french-france')
  // The conversation list opens from the chat header; the theme is in Settings.
  expect(screen.queryByRole('button', {name:'Conversations'})).toBeNull()
  expect(screen.queryByRole('button', {name:/Switch to (dark|light) mode/})).toBeNull()
  // Chat and Practice come straight after the wordmark, before the language and
  // the bar's controls, in the one row the bar has at every width.
  const tabs = screen.getByRole('navigation', {name:'Main navigation'})
  expect(within(tabs).getAllByRole('button').map(button => button.textContent)).toEqual(['Chat', 'Practice'])
  const following = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
  expect(following(screen.getByRole('button', {name:/SkellySpeak home/}), tabs)).toBe(true)
  expect(following(tabs, screen.getByRole('button', {name:'Target language'}))).toBe(true)
  expect(following(tabs, screen.getByRole('button', {name:'More'}))).toBe(true)
})
it('disables language switching during a save or settings edit', () => {
  useSettingsStore.setState({savingLanguage:true})
  const view = render(<TopBar />)
  expect(screen.getByRole('button', {name:'Target language'})).toBeDisabled()
  useSettingsStore.setState({savingLanguage:false})
  useNavigationStore.getState().showOverlay('settings')
  view.rerender(<TopBar />)
  expect(screen.getByRole('button', {name:'Target language'})).toBeDisabled()
})
it('returns from review to Chat or Practice from the tabs and preserves secondary navigation', () => {
  useNavigationStore.getState().setMode('review')
  render(<TopBar />)
  const tabs = screen.getByRole('navigation', {name:'Main navigation'})
  expect(within(tabs).getByRole('button', {name:'Chat'})).not.toHaveAttribute('aria-current')
  fireEvent.click(within(tabs).getByRole('button', {name:'Practice'}))
  expect(useNavigationStore.getState()).toMatchObject({mode:'practice',page:'guided',practiceView:'drill'})
  expect(within(tabs).getByRole('button', {name:'Practice'})).toHaveAttribute('aria-current', 'page')
  fireEvent.click(within(tabs).getByRole('button', {name:'Chat'}))
  expect(useNavigationStore.getState()).toMatchObject({page:'guided',practiceView:'chat',mobileSurface:'chat'})
  fireEvent.click(screen.getByRole('button', {name:'More'}))
  expect(useNavigationStore.getState().overlay).toBe('more')
})

it('opens the language browser from the compact selector', () => {
  render(<TopBar />)
  fireEvent.click(screen.getByRole('button', { name: 'Target language' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add language…' }))
  expect(useNavigationStore.getState().overlay).toBe('languages')
  expect(screen.getByRole('button', { name: 'Target language' })).toBeInTheDocument()
})


it('shows a clickable connected state only after a successful check at the current revision', () => {
  useSessionStore.setState({ connection: {
    route: 'custom', signedIn: false, email: '', revision: 9,
    configured: true, assessmentAdapter: 'jev_choice' as const, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
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

function connect() {
  useSessionStore.setState({ connection: {
    route: 'hosted', signedIn: true, email: '', revision: 1,
    configured: true, assessmentAdapter: 'jev_choice' as const, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
  } })
  useConnectionHealth.setState({ routes: { hosted: { revision: 1, status: 'connected', checkedAt: 1, error: null } } })
}

it('opens the activity view and clears its busy border state when work stops', () => {
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
  act(() => useAiBusyStore.setState({ busy: false }))
  expect(button).not.toHaveAttribute('data-busy')
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
it('opens the progress card first and the full report on the second press', () => {
  render(<TopBar />)
  const progress = screen.getByRole('button', { name: 'Language progress' })
  fireEvent.click(progress)
  expect(screen.getByRole('dialog', { name: 'All languages' })).toBeVisible()
  expect(useNavigationStore.getState().overlay).not.toBe('profile')
  fireEvent.click(progress)
  expect(screen.queryByRole('dialog', { name: 'All languages' })).toBeNull()
  expect(useNavigationStore.getState().overlay).toBe('profile')
})
it('shows the progress card on mouse hover, where a click then opens the full report', async () => {
  vi.useFakeTimers()
  render(<TopBar />)
  const progress = screen.getByRole('button', { name: 'Language progress' })
  fireEvent.pointerEnter(progress.parentElement!, { pointerType: 'mouse' })
  expect(screen.getByRole('dialog', { name: 'All languages' })).toBeVisible()
  fireEvent.pointerLeave(progress.parentElement!, { pointerType: 'mouse' })
  act(() => { vi.advanceTimersByTime(300) })
  expect(screen.queryByRole('dialog', { name: 'All languages' })).toBeNull()
  fireEvent.pointerEnter(progress.parentElement!, { pointerType: 'mouse' })
  fireEvent.click(progress)
  expect(useNavigationStore.getState().overlay).toBe('profile')
  vi.useRealTimers()
})
it('ignores touch hover so a tap opens the card', () => {
  render(<TopBar />)
  const progress = screen.getByRole('button', { name: 'Language progress' })
  fireEvent.pointerEnter(progress.parentElement!, { pointerType: 'touch' })
  expect(screen.queryByRole('dialog', { name: 'All languages' })).toBeNull()
  fireEvent.click(progress)
  expect(screen.getByRole('dialog', { name: 'All languages' })).toBeVisible()
})
it('shows the total across languages behind a globe, and lists every language in the card', async () => {
  render(<TopBar />)
  expect(await screen.findByLabelText('Total XP: 42')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Language progress' }))
  const card = screen.getByRole('dialog', { name: 'All languages' })
  expect(within(card).getAllByRole('row').slice(1).map(row => within(row).getByRole('rowheader').textContent)).toEqual(['FRFrench', 'ESSpanish'])
})
