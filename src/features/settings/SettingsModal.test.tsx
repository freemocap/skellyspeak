// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Settings } from '../../types'
import { SettingsModal } from './SettingsModal'

const backend = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn(), hostedSignIn: vi.fn(), hostedAccount: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => ({ ...backend, isTauri: false, logInfo: vi.fn(), languages: () => [], validateKey: vi.fn() }))
vi.mock('./SettingsAccess', () => ({ SettingsAccess: () => <p>AI access</p> }))
vi.mock('./DialectField', () => ({ DialectField: () => null }))
vi.mock('../../platform/audio/speech', () => ({ speechSupported: () => false, setVoiceVolume: vi.fn() }))
vi.mock('../../platform/updater', async original => ({ ...await original<typeof import('../../platform/updater')>(), getUpdateChannel: async () => 'stable' }))
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

it('routes explicit update checks to the shared update banner', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'updates' } })
  const check = vi.fn()
  window.addEventListener('skellyspeak-check-update', check)
  fireEvent.click(await screen.findByRole('button', { name: 'Check for updates' }))
  expect(check).toHaveBeenCalledOnce()
  fireEvent.click(await screen.findByRole('button', { name: 'v0.13.4' }))
  expect(check).toHaveBeenCalledTimes(2)
  window.removeEventListener('skellyspeak-check-update', check)
})

it('keeps the modal open until a pending preference save finishes', async () => {
  let finish!: () => void
  backend.saveSettings.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const close = vi.fn()
  render(<SettingsModal onClose={close} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'text' } })
  fireEvent.change(screen.getByLabelText('Text size · 100%'), { target: { value: '125' } })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
  await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledOnce())
  await act(async () => finish())
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledOnce()
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

it('saves text size without exposing spacing controls', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'text' } })
  fireEvent.change(screen.getByLabelText('Text size · 100%'), { target: { value: '125' } })
  expect(screen.queryByLabelText(/Text spacing/)).toBeNull()
  await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ text_size: 125 }), expect.any(Object)))
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

it('enables connected audio volume preferences', async () => {
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'volume' } })
  expect(screen.getByRole('slider', { name: 'Overall volume' })).toBeEnabled()
  expect(screen.getByRole('slider', { name: 'Voice volume' })).toBeEnabled()
  expect(backend.saveSettings).not.toHaveBeenCalled()
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

it('passes only the edited draft and its baseline to the shared settings writer', async () => {
  const initial = { ...SETTINGS, scope: { sessionId: 's', conversationId: 'c', settingsRevision: 1, learnerRevision: 1, rewardRevision: 0 } }
  const fresh = { ...initial, auto_translate: true, scope: { ...initial.scope, settingsRevision: 2 } }
  backend.getSettings.mockResolvedValueOnce(initial).mockResolvedValue(fresh)
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'romanization' } })
  fireEvent.click(screen.getByLabelText('Show romanization'))
  await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ always_romanize: true, scope: initial.scope }), initial))
})

it('preserves a newer text-size edit while the first save completes', async () => {
  let finish!: () => void
  backend.saveSettings.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  render(<SettingsModal onClose={vi.fn()} onSettingsChanged={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Search settings'), { target: { value: 'text size' } })
  fireEvent.change(screen.getByLabelText('Text size · 100%'), { target: { value: '110' } })
  await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByLabelText('Text size · 110%'), { target: { value: '125' } })
  backend.getSettings.mockResolvedValue({ ...SETTINGS, hosted_email: '', text_size: 110 })
  await act(async () => finish())
  await waitFor(() => expect(backend.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ text_size: 125 }), expect.any(Object)))
})
