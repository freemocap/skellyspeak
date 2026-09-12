// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from './App'
import { useSessionStore } from './state/session'

vi.mock('./ui/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('./state/useSkillEvidence', async importOriginal => ({ ...await importOriginal<typeof import('./state/useSkillEvidence')>(), useSkillEvidence: () => ({ snapshot: null, error: null }) }))
const { native, state } = vi.hoisted(() => {
  const state = { connection: { route: 'hosted', signedIn: true, ownKeyConfigured: false, email: '', revision: 1, configured: true, standardModel: '', fastModel: '', paused: false } }
  const native = vi.fn(async (command: string) => {
    if (command === 'get_connection') return state.connection
    if (command === 'select_route') {
      state.connection = { ...state.connection, route: 'hosted', revision: state.connection.revision + 1 }
      return state.connection
    }
    if (command === 'hosted_sign_in') {
      state.connection = { ...state.connection, signedIn: true, configured: true }
      return { email: 'learner@example.test', remaining: 1 }
    }
    throw new Error(`Unexpected command: ${command}`)
  })
  return { native, state }
})
vi.mock('./platform/ipc/tauri', () => ({ isTauri: true, getSettings: async () => ({ native_language: 'en', target_language: 'es', provider_mode: 'custom' }), invoke: native, languageFor: () => null, languages: () => [] }))
vi.mock('./app/shell/UpdateBanner', () => ({ UpdateBanner: () => null }))
vi.mock('./features/settings/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('./features/skills/SkillsPage', () => ({ default: ({ onPractice }: { onPractice: () => void }) => <button onClick={onPractice}>Practice this skill</button> }))
// The page is replaced, but it reads access the way the real one does — from the
// session store — rather than through props the shell no longer threads down.
vi.mock('./features/guided/GuidedPage', () => ({ default: ({ mobileSurface }: { mobileSurface: string }) => {
  const [draft, setDraft] = useState('')
  const connection = useSessionStore((state) => state.connection)
  const startHostedSignIn = useSessionStore((state) => state.startHostedSignIn)
  return <><p>Practice surface: {mobileSurface}</p><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />{connection?.configured === false && <button type="button" onClick={() => void startHostedSignIn()}>Sign in with Google</button>}</>
} }))

it('keeps Chat and Lesson reachable through Skill Tree and preserves the chat draft', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  render(<App />)
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['Chat', 'Coach'])
  expect(screen.queryByText('Guided conversation')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Keep my words' } })
  for (const destination of ['Chat', 'Coach']) {
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skill tree' }))
    await screen.findByRole('button', { name: 'Practice this skill' })
    fireEvent.click(within(nav).getByRole('button', { name: destination }))
    expect(within(nav).getByRole('button', { name: destination })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
    expect(screen.getByText(`Practice surface: ${destination === 'Chat' ? 'chat' : 'panel'}`)).toBeInTheDocument()
  }
  fireEvent.click(within(nav).getByRole('button', { name: 'Coach' }))
  fireEvent.click(screen.getByRole('button', { name: 'SkellySpeak home — Chat' }))
  expect(within(nav).getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  fireEvent.click(screen.getByRole('button', { name: 'AI activity & tools' }))
  expect(screen.getByText('Live operations')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close AI activity & tools' }))
  expect(screen.queryByText('Live operations')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
})

vi.mock('./features/activity/LiveActivity', () => ({ LiveActivity: () => <p role="status">Live operations</p> }))

it('starts hosted sign-in directly when no AI access is configured', async () => {
  state.connection = { route: 'custom', signedIn: false, ownKeyConfigured: false, email: '', revision: 7, configured: false, standardModel: '', fastModel: '', paused: false }
  native.mockClear()
  // Startup loads the session store; a test that asserts on what it holds seeds
  // it the same way rather than relying on the shell to fetch.
  await act(async () => { await useSessionStore.getState().refresh() })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('select_route', { expectedRevision: 7, route: 'hosted' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('hosted_sign_in'))
})
