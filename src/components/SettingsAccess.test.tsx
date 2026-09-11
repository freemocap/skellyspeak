// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsAccess } from './SettingsAccess'

const native = vi.hoisted(() => vi.fn())
vi.mock('../lib/native', () => ({ invoke: native }))
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
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Server session token' }))
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Delete key' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('save_access_settings', {
    expectedRevision: 7, custom: access.custom, apiKey: null, removeKey: true,
  }))
})

it('selects only the persisted route from tab headings and never falls back after rejection', async () => {
  let saved = { ...connection }
  native.mockImplementation(async (command: string, args: { route?: string }) => {
    if (command === 'get_connection') return saved
    if (command === 'get_access_settings') return access
    if (command === 'select_route') {
      if (args.route === 'hosted') throw new Error('Route change failed')
      saved = { ...saved, route: args.route!, revision: 8 }
      return saved
    }
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  expect(await screen.findByRole('tab', { name: 'Custom URL' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'API keys' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'API keys' })).toHaveAttribute('aria-selected', 'true'))
  expect(screen.getByLabelText('OpenRouter API key', { selector: 'input' })).toHaveAttribute('type', 'password')
  expect(screen.getByLabelText('Groq API key', { selector: 'input' })).toHaveValue('')
  expect(native).toHaveBeenCalledWith('select_route', { expectedRevision: 7, route: 'openrouter' })
  fireEvent.click(screen.getByRole('tab', { name: 'Hosted sign-in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Route change failed')
  expect(screen.getByRole('tab', { name: 'API keys' })).toHaveAttribute('aria-selected', 'true')
  expect(native).toHaveBeenCalledWith('select_route', { expectedRevision: 8, route: 'hosted' })
  expect(native.mock.calls.filter(call => call[0] === 'select_route')).toHaveLength(2)
})

it('fills known model defaults in a fresh Custom form without writes on mount', async () => {
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings') return { ...access, custom: { ...access.custom, baseUrl: '', standardModel: '', fastModel: '', transcriptionModel: null } }
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  await screen.findByLabelText('Server address')
  expect(screen.queryByLabelText('Voice input')).toBeNull()
  expect(screen.getByLabelText('Standard model')).toHaveValue('google/gemini-2.5-flash')
  expect(screen.getByLabelText('Fast model')).toHaveValue('google/gemini-2.5-flash')
  expect(screen.getByLabelText('Transcription model')).toHaveValue('whisper-large-v3')
  expect(native.mock.calls.map(call => call[0])).toEqual(['get_connection', 'get_access_settings'])
})


it.each(['Standard model', 'Fast model', 'Transcription model'])('restores the known default after clearing %s without saving null', async label => {
  let saved = { ...access }
  native.mockImplementation(async (command: string, args: { custom: typeof access.custom }) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings') return saved
    if (command === 'save_access_settings') { saved = { ...saved, custom: args.custom }; return saved }
    throw new Error(command)
  })
  const changed = vi.fn()
  render(<SettingsAccess onBusyChange={vi.fn()} onChanged={changed} />)
  const model = await screen.findByLabelText(label)
  fireEvent.focus(model)
  fireEvent.change(model, { target: { value: '' } })
  await new Promise(resolve => setTimeout(resolve, 550))
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(0)
  fireEvent.blur(model)
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  const key = label === 'Transcription model' ? 'transcriptionModel' : label === 'Standard model' ? 'standardModel' : 'fastModel'
  expect(saved.custom[key]).toBe(key === 'transcriptionModel' ? 'whisper-large-v3' : 'google/gemini-2.5-flash')
  expect(saved.custom.transcriptionModel).not.toBeNull()
  expect(native.mock.calls.some(call => ['select_route', 'disconnect', 'verify_openrouter_key', 'check_access'].includes(call[0]))).toBe(false)
})

it('a failed access draft can be explicitly discarded to unlock navigation and closing', async () => {
  const busy = vi.fn()
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    if (command === 'get_access_settings') return access
    if (command === 'save_access_settings') throw new Error('Invalid URL')
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={busy} onChanged={vi.fn()} />)
  const url = await screen.findByLabelText('Server address')
  fireEvent.focus(url); fireEvent.change(url, { target: { value: 'invalid' } }); fireEvent.blur(url)
  await screen.findByText('Invalid URL')
  expect(url).toHaveValue('invalid')
  expect(screen.getByRole('tab', { name: 'API keys' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(url).toHaveValue(access.custom.baseUrl)
  expect(screen.getByRole('tab', { name: 'API keys' })).not.toBeDisabled()
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(1)
  expect(native.mock.calls.filter(call => call[0] === 'select_route')).toHaveLength(0)
})
it('waits for URL blur and releases the lock when a draft is reverted', async () => {
  const busy = vi.fn()
  render(<SettingsAccess onBusyChange={busy} onChanged={vi.fn()} />)
  const url = await screen.findByLabelText('Server address')
  fireEvent.focus(url); fireEvent.change(url, { target: { value: 'https://unfinished' } })
  await new Promise(resolve => setTimeout(resolve, 600))
  expect(native.mock.calls.filter(call => call[0] === 'save_access_settings')).toHaveLength(0)
  fireEvent.change(url, { target: { value: access.custom.baseUrl } })
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  expect(screen.getByRole('tab', { name: 'API keys' })).not.toBeDisabled()
})

it('recovers from a fresh rejected key save without deleting credentials or changing routes', async () => {
  const busy = vi.fn()
  const freshConnection = { ...connection, ownKeyConfigured: false, configured: false }
  const freshAccess = { ...access, customKeyConfigured: false, groqKeyConfigured: false,
    custom: { ...access.custom, baseUrl: '', standardModel: '', fastModel: '', transcriptionModel: null } }
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return freshConnection
    if (command === 'get_access_settings') return freshAccess
    if (command === 'save_access_settings') throw new Error('Server address is required')
    throw new Error(command)
  })
  render(<SettingsAccess onBusyChange={busy} onChanged={vi.fn()} />)
  const key = await screen.findByLabelText('Server session token', { selector: 'input' })
  fireEvent.focus(key); fireEvent.change(key, { target: { value: 'synthetic-unsaved-key' } }); fireEvent.blur(key)
  await screen.findByText('Server address is required')
  expect(key).toHaveValue('synthetic-unsaved-key')
  expect(key).not.toBeDisabled()
  fireEvent.focus(key); fireEvent.change(key, { target: { value: 'synthetic-corrected-key' } })
  expect(key).toHaveValue('synthetic-corrected-key')
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(key).toHaveValue('')
  expect(screen.getByRole('tab', { name: 'API keys' })).not.toBeDisabled()
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  expect(native.mock.calls.filter(call => !['get_connection', 'get_access_settings'].includes(call[0]))).toEqual([
    ['save_access_settings', { expectedRevision: 7, custom: { ...freshAccess.custom, standardModel: 'google/gemini-2.5-flash', fastModel: 'google/gemini-2.5-flash', transcriptionModel: 'whisper-large-v3' }, apiKey: 'synthetic-unsaved-key', removeKey: false }],
  ])
})
