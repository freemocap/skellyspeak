// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { SettingsModal } from './SettingsModal'

const backend = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn(), hostedSignIn: vi.fn(), hostedAccount: vi.fn() }))
vi.mock('../lib/tauri', () => ({ ...backend, logInfo: vi.fn(), languages: () => [], validateKey: vi.fn() }))
vi.mock('./FactoryReset', () => ({ FactoryReset: () => null }))
vi.mock('./DialectField', () => ({ DialectField: () => null }))
vi.mock('../lib/speech', () => ({ speechSupported: () => false }))
vi.mock('../lib/updater', () => ({ getUpdateChannel: async () => 'stable' }))
const SETTINGS: Settings = {
  provider_mode: 'hosted',
  hosted_token: '',
  hosted_email: 'me@example.com',
  install_id: '',
  openrouter_key: '',
  custom_base_url: '',
  custom_api_key: '',
  custom_model: '',
  groq_key: '',
  openrouter_model: 'google/gemini-2.5-flash',
  observer_model: null,
  target_language: 'es-ES',
  target_dialect: '',
  native_language: 'en',
  microphone_device_id: null,
  auto_speak: false,
  auto_send: false,
  always_romanize: false,
  auto_translate: false,
  always_pronunciation: false,
  fast_mode: true, reward_sounds: 'follow_tts',
  tts_engine: 'cloud',
  tts_voice: 'nova',
  tts_rate: 1,
  shortcuts: { mic: 'ctrl+m', speak: 'ctrl+l', panel: 'ctrl+b', settings: 'ctrl+,' },
}

beforeEach(() => {
  vi.clearAllMocks()
  backend.getSettings.mockResolvedValue({ ...SETTINGS, hosted_email: '' })
  backend.saveSettings.mockResolvedValue(undefined)
  backend.hostedAccount.mockResolvedValue(null)
  backend.hostedSignIn.mockResolvedValue(null)
})

it('notifies the app immediately after Google sign-in re-reads native settings', async () => {
  const changed = vi.fn()
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={changed} />)
  const signIn = await screen.findByRole('button', { name: 'Sign in with Google' })
  backend.getSettings.mockResolvedValue(SETTINGS)
  fireEvent.click(signIn)
  await waitFor(() => expect(changed).toHaveBeenCalledWith(SETTINGS))
  expect(backend.hostedSignIn).toHaveBeenCalledOnce()
})

it('waits for the pending API key write before refreshing the chat on close', async () => {
  backend.getSettings.mockResolvedValue({ ...SETTINGS, provider_mode: 'cloud' })
  let finish: () => void = () => { throw new Error('Save has not started') }
  backend.saveSettings.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const changed = vi.fn()
  const view = render(<SettingsModal onClose={vi.fn()} onSettingsChanged={changed} />)
  const key = await screen.findByPlaceholderText('sk-or-…')
  fireEvent.focus(key)
  fireEvent.change(key, { target: { value: 'test-api-key' } })
  view.unmount()
  expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ openrouter_key: 'test-api-key' }))
  expect(changed).not.toHaveBeenCalled()
  const saved = { ...SETTINGS, provider_mode: 'cloud', openrouter_key: 'masked-saved-key' }
  backend.getSettings.mockResolvedValue(saved)
  await act(async () => { finish() })
  expect(changed).toHaveBeenCalledWith(saved)
})

it('dismisses on the backdrop but keeps settings open for clicks inside', async () => {
  const close = vi.fn()
  const view = render(<SettingsModal onClose={close} onSettingsChanged={vi.fn()} />)
  const search = await screen.findByLabelText('Search settings')
  fireEvent.click(search)
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(view.container.querySelector('.modal-backdrop')!)
  expect(close).toHaveBeenCalledOnce()
})
