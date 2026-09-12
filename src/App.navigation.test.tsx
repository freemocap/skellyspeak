// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useState } from 'react'
import App from './App'

vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => true }))
vi.mock('./hooks/useAiActivity', () => ({ useAiActivity: () => false }))
vi.mock('./hooks/useSkillEvidence', async importOriginal => ({ ...await importOriginal<typeof import('./hooks/useSkillEvidence')>(), useSkillEvidence: () => ({ snapshot: null, error: null }) }))
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
vi.mock('./lib/tauri', () => ({ isTauri: true, takeStartupFaults: async () => [], getSettings: async () => ({ native_language: 'en', target_language: 'es', provider_mode: 'custom' }), invoke: native, languageFor: () => null, languages: () => [] }))
vi.mock('./components/UpdateBanner', () => ({ UpdateBanner: () => null }))
vi.mock('./components/PausedBanner', () => ({ PausedBanner: () => null }))
vi.mock('./components/SettingsModal', () => ({ SettingsModal: () => null }))
vi.mock('./pages/SkillsPage', () => ({ default: ({ onPractice }: { onPractice: () => void }) => <button onClick={onPractice}>Practice this skill</button> }))
vi.mock('./pages/GuidedPage', () => ({ default: ({ mobileSurface, accessConfigured, onStartHostedSignIn }: { mobileSurface: string, accessConfigured?: boolean | null, onStartHostedSignIn?: () => void }) => {
  const [draft, setDraft] = useState('')
  return <><p>Practice surface: {mobileSurface}</p><input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />{accessConfigured === false && <button type="button" onClick={onStartHostedSignIn}>Sign in with Google</button>}</>
} }))

it('keeps Chat and Lesson reachable through Skill Tree and preserves the chat draft', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  render(<App />)
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getAllByRole('button').map(button => button.textContent)).toEqual(['Chat · Persona', 'Coach'])
  expect(screen.queryByText('Guided conversation')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Keep my words' } })
  for (const destination of ['Chat · Persona', 'Coach']) {
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skill tree' }))
    await screen.findByRole('button', { name: 'Practice this skill' })
    fireEvent.click(within(nav).getByRole('button', { name: destination }))
    expect(within(nav).getByRole('button', { name: destination })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
    expect(screen.getByText(`Practice surface: ${destination === 'Chat · Persona' ? 'chat' : 'panel'}`)).toBeInTheDocument()
  }
  fireEvent.click(within(nav).getByRole('button', { name: 'Coach' }))
  fireEvent.click(screen.getByRole('button', { name: 'SkellySpeak home — Chat' }))
  expect(within(nav).getByRole('button', { name: 'Chat · Persona' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  fireEvent.click(screen.getByRole('button', { name: 'AI activity & tools' }))
  expect(screen.getByText('Live operations')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close AI activity & tools' }))
  expect(screen.queryByText('Live operations')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my words')
})

vi.mock('./components/dev/LiveActivity', () => ({ LiveActivity: () => <p role="status">Live operations</p> }))

it('starts hosted sign-in directly when no AI access is configured', async () => {
  state.connection = { route: 'custom', signedIn: false, ownKeyConfigured: false, email: '', revision: 7, configured: false, standardModel: '', fastModel: '', paused: false }
  native.mockClear()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('select_route', { expectedRevision: 7, route: 'hosted' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('hosted_sign_in'))
})
