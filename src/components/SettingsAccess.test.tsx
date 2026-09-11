// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsAccess } from './SettingsAccess'

const native = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: native }))
// Explicit native-response fixtures; no live account or credential data.
const connection = { route: 'custom', signedIn: false, ownKeyConfigured: true, email: '', revision: 7,
  configured: true, standardModel: 'fixture-standard', fastModel: 'fixture-fast', paused: false }
const access = { revision: 7, groqKeyConfigured: true, customKeyConfigured: true,
  custom: { baseUrl: 'https://fixture.example/v1', standardModel: 'fixture-standard', fastModel: 'fixture-fast', bearerAuth: true, transcriptionModel: 'fixture-transcription' } }
beforeEach(() => {
  native.mockReset()
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings') return access
    throw new Error(`Unexpected native call: ${command}`)
  })
})
it('loads only configuration on mount and shows no stored secret or cloud-key fallback for custom', async () => {
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  const key = await screen.findByLabelText('Server session token', { selector: 'input' })
  expect(key).toHaveValue('')
  expect(key).toHaveAttribute('type', 'password')
  expect(screen.queryByLabelText('OpenRouter API key', { selector: 'input' })).toBeNull()
  expect(screen.queryByLabelText('Groq API key', { selector: 'input' })).toBeNull()
  expect(native.mock.calls.map(call => call[0])).toEqual(['get_connection', 'get_access_settings'])
})
it('preserves a rejected replacement and retries explicitly without changing route', async () => {
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings') return access
    if (command === 'save_access_settings') throw new Error('Credential store unavailable')
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  const key = await screen.findByLabelText('Server session token', { selector: 'input' })
  fireEvent.focus(key); fireEvent.change(key, { target: { value: 'fixture-replacement' } }); fireEvent.blur(key)
  expect(await screen.findByRole('alert')).toHaveTextContent('Credential store unavailable')
  expect(key).toHaveValue('fixture-replacement')
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
  await waitFor(() => expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(2))
  expect(native).not.toHaveBeenCalledWith('select_route', expect.anything())
})
it('requires a separate confirmed deletion and sends revision-scoped removal', async () => {
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings' || command === 'save_access_settings') return access
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Delete key' }))
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(0)
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete key' })[1])
  await waitFor(() => expect(native).toHaveBeenCalledWith('save_access_settings', {
    expectedRevision: 7, custom: access.custom, apiKey: null, removeKey: true,
  }))
})
