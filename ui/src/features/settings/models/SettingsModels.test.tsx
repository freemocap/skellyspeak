// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsModels } from './SettingsModels'

const native = vi.hoisted(() => vi.fn())
vi.mock('../../../platform/ipc/native', () => ({ invoke: native }))
// Explicit native-response fixtures; no live account or credential data.
const connection = { route: 'custom', signedIn: false, ownKeyConfigured: true, email: '', revision: 7,
  configured: true, assessmentAdapter: 'chat_model' as const, standardModel: 'fixture-standard', fastModel: 'fixture-fast', audio: { transcription: { model: 'fixture-transcription' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false }
beforeEach(() => {
  native.mockReset()
  native.mockImplementation(async (command: string) => {
    if (command === 'get_connection') return connection
    throw new Error(`Unexpected native call: ${command}`)
  })
})
it.each(['Standard model', 'Fast model', 'Transcription model', 'Read-aloud model'])('saves shared %s independently of access route', async label => {
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
  const actual = label === 'Transcription model' ? saved.audio.transcription.model :
    label === 'Read-aloud model' ? saved.audio.speech.model : label === 'Standard model' ? saved.standardModel : saved.fastModel
  expect(actual).toBe('shared-model')
  expect(saved.route).toBe(connection.route)
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

it('offers only model fields and no capability access selectors', async () => {
  render(<SettingsModels onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  await screen.findByLabelText('Transcription model')
  expect(screen.getAllByRole('textbox')).toHaveLength(4)
  expect(screen.getByRole('combobox', { name: 'Skill assessment' })).toHaveValue('chat_model')
  expect(screen.queryByLabelText('Transcription access')).toBeNull()
  expect(screen.queryByLabelText('Read-aloud access')).toBeNull()
})

it('disables Jev selection and explains the retained adapters', async () => {
  HTMLElement.prototype.showPopover = vi.fn()
  HTMLElement.prototype.hidePopover = vi.fn()
  let saved = { ...connection }
  native.mockImplementation(async (command, args) => {
    if (command === 'get_connection') return saved
    if (command === 'save_models') { saved = { ...saved, ...args, revision: 8 }; return saved }
    throw new Error(command)
  })
  render(<SettingsModels onBusyChange={vi.fn()} onChanged={vi.fn()} />)
  const select = await screen.findByRole('combobox', { name: 'Skill assessment' })
  expect(select).toHaveValue('chat_model')
  fireEvent.click(screen.getByRole('button', { name: 'Information' }))
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('selected Fast model then locates supporting quotes')
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('not learner proficiency')
  expect(select).toBeDisabled()
  expect(screen.getByRole('option', { name: 'Jev Choice — Disabled' })).toBeDisabled()
  expect(native).not.toHaveBeenCalledWith('save_models', expect.anything())
  expect(select).toHaveValue('chat_model')
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
})
