// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsModels } from './SettingsModels'

const native = vi.hoisted(() => vi.fn())
vi.mock('../../../platform/ipc/native', () => ({ invoke: native }))
// Explicit native-response fixtures; no live account or credential data.
const connection = { route: 'custom', signedIn: false, ownKeyConfigured: true, email: '', revision: 7,
  configured: true, standardModel: 'fixture-standard', fastModel: 'fixture-fast', transcriptionModel: 'fixture-transcription', paused: false }
beforeEach(() => {
  native.mockReset()
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    throw new Error(`Unexpected native call: ${command}`)
  })
})
it.each(['Standard model', 'Fast model', 'Transcription model'])('saves shared %s independently of access route', async label => {
  let saved = { ...connection }
  native.mockImplementation(async (command: string, args: typeof connection) => {
    if (command === 'get_connection') return saved
    if (command === 'save_models') { saved = { ...saved, ...args, revision: 8 }; return saved }
    throw new Error(command)
  })
  const changed = vi.fn()
  render(<SettingsModels onBusyChange={vi.fn()} onChanged={changed} />)
  const model = await screen.findByLabelText(label)
  fireEvent.focus(model)
  fireEvent.change(model, { target: { value: 'shared-model' } })
  await new Promise(resolve => setTimeout(resolve, 550))
  expect(native.mock.calls.filter(call => call[0] === 'save_models')).toHaveLength(0)
  fireEvent.blur(model)
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  const key = label === 'Transcription model' ? 'transcriptionModel' : label === 'Standard model' ? 'standardModel' : 'fastModel'
  expect(saved[key]).toBe('shared-model')
  expect(native.mock.calls.some(call => ['select_route', 'disconnect', 'verify_openrouter_key', 'check_access'].includes(call[0]))).toBe(false)
})


it('retains rejected model edits and permits discard without changing access', async () => {
  const busy = vi.fn()
  native.mockImplementation(async command => {
    if (command === 'get_connection') return connection
    if (command === 'save_models') throw new Error('AI settings changed. Reload before saving models.')
    throw new Error(command)
  })
  render(<SettingsModels onBusyChange={busy} onChanged={vi.fn()} />)
  const field = await screen.findByLabelText('Standard model')
  fireEvent.focus(field); fireEvent.change(field, { target: { value: 'new/model' } }); fireEvent.blur(field)
  expect(await screen.findByRole('alert')).toHaveTextContent('AI settings changed')
  expect(field).toHaveValue('new/model')
  expect(busy).toHaveBeenLastCalledWith(true)
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(field).toHaveValue('fixture-standard')
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  expect(native.mock.calls.map(([command]) => command)).toEqual(['get_connection', 'save_models'])
})
