// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Settings } from '../types'
import { SettingsModal } from './SettingsModal'

const backend = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn(), hostedSignIn: vi.fn(), hostedAccount: vi.fn() }))
vi.mock('../lib/tauri', () => ({ ...backend, isTauri: false, logInfo: vi.fn(), languages: () => [], validateKey: vi.fn() }))
vi.mock('./FactoryReset', () => ({ FactoryReset: () => null }))
vi.mock('./DialectField', () => ({ DialectField: () => null }))
vi.mock('../lib/speech', () => ({ speechSupported: () => false, setVoiceVolume: vi.fn() }))
vi.mock('../lib/updater', () => ({ getUpdateChannel: async () => 'stable' }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: async () => '0.13.4' }))
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
  text_size: 100,
  text_spacing: 2,
  fast_mode: true, reward_sounds: 'follow_tts',
  master_volume: 100, voice_volume: 100, effects_volume: 100,
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

it('shows the installed native app version above the update controls without checking for updates', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'updates' } })
  expect(await screen.findByText('Installed version: v0.13.4')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Check for updates' })).toBeVisible()
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

it('keeps reading size and spacing independent and saves both', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'text' } })
  fireEvent.change(screen.getByLabelText('Text size · 100%'), { target: { value: '125' } })
  expect(screen.getByLabelText('Text spacing · 2px')).toHaveValue('2')
  fireEvent.change(screen.getByLabelText('Text spacing · 2px'), { target: { value: '0' } })
  await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ text_size: 125, text_spacing: 0 })))
})

it('groups mobile settings into collapsible sections and searches inside closed groups', async () => {
  const original = window.matchMedia
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  try {
    const view = render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
    await screen.findByLabelText('Search settings')
    const groups = view.container.querySelectorAll('details.settings-section')
    expect(groups.length).toBeGreaterThan(1)
    expect(groups[0]).toHaveAttribute('open')
    expect(groups[1]).not.toHaveAttribute('open')
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'microphone' } })
    expect(view.container.querySelector('details.settings-section')).toBeNull()
    expect(screen.getByText('Microphone')).toBeVisible()
  } finally { window.matchMedia = original }
})

it('autosaves independent audio levels and keeps the effects level when toggled off and on', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'volume' } })
  fireEvent.change(screen.getByRole('slider', { name: 'Overall volume' }), { target: { value: '50' } })
  fireEvent.change(screen.getByRole('slider', { name: 'Voice volume' }), { target: { value: '80' } })
  fireEvent.change(screen.getByRole('slider', { name: 'Sound effects volume' }), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sound effects' }))
  await waitFor(() => expect(backend.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ master_volume: 50, voice_volume: 80, effects_volume: 30, reward_sounds: 'no' })))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Sound effects' }))
  await waitFor(() => expect(backend.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ master_volume: 50, voice_volume: 80, effects_volume: 30, reward_sounds: 'yes' })))
})

it('shows a closable error instead of blanking the app when native volume fields are missing', async () => {
  const incomplete = { ...SETTINGS } as Partial<Settings>
  delete incomplete.master_volume
  delete incomplete.voice_volume
  delete incomplete.effects_volume
  backend.getSettings.mockResolvedValue(incomplete)
  const close = vi.fn()
  render(<SettingsModal onClose={close} onSettingsChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings response is missing the required field: master_volume.')
  expect(screen.queryByRole('slider')).toBeNull()
  expect(backend.saveSettings).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledOnce()
})

it('shows native settings-load failures inside the settings dialog', async () => {
  backend.getSettings.mockRejectedValue(new Error('Settings response is incomplete.'))
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings response is incomplete.')
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})
