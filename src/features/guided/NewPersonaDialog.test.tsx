// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { PersonaDetails } from '../../contracts'
import { NewPersonaDialog } from './NewPersonaDialog'

const backend = vi.hoisted(() => ({ begin: vi.fn(), run: vi.fn(), cancel: vi.fn(), fault: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({
  beginPersonaGeneration: backend.begin,
  runPersonaGeneration: backend.run,
  cancelPersonaGeneration: backend.cancel,
  nativeError: (reason: unknown) => reason instanceof Error ? reason.message : String(reason),
}))

vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: backend.fault }))

const generated: PersonaDetails = {
  name: 'Inés', romanizedName: null, age: 52, location: 'Cádiz', occupation: 'Fisher', background: 'Grew up by the sea.',
  currentSituation: 'Repairing a boat.', interests: ['tides'], opinions: ['Tourists should walk.'], interestingFacts: ['Swims daily.'],
  favoriteBooks: ['Moby-Dick'], favoriteMovies: ['Jaws'],
  manner: 'Blunt.', quirks: ['Whistles.'], vibe: ['🌊', '🐟'],
}

beforeEach(() => {
  backend.begin.mockReset().mockResolvedValue('generation')
  backend.run.mockReset()
  backend.cancel.mockReset().mockResolvedValue(undefined)
  backend.fault.mockReset()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

function renderDialog(romanized = false) {
  const handlers = { onCreate: vi.fn().mockResolvedValue(undefined), onClose: vi.fn() }
  render(<NewPersonaDialog language="es" romanized={romanized} busy={false} {...handlers} />)
  return handlers
}

const create = () => screen.getByRole('button', { name: 'Create' })

it('Surprise me fills the form from a generation with no brief, and writes nothing', async () => {
  backend.run.mockResolvedValue(generated)
  const { onCreate } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Inés'))
  expect(backend.begin).toHaveBeenCalledExactlyOnceWith('es', '')
  expect(screen.getByRole('textbox', { name: 'Interests' })).toHaveValue('- tides')
  expect(onCreate).not.toHaveBeenCalled()
})

it('Describe and generate sends the brief and fills the form', async () => {
  backend.run.mockResolvedValue(generated)
  renderDialog()
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /Describe them/ }), { target: { value: 'a blunt fisher' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Inés'))
  expect(backend.begin).toHaveBeenCalledExactlyOnceWith('es', 'a blunt fisher')
})

it('a persona written by hand is created once, with what was typed', async () => {
  const { onCreate } = renderDialog()
  expect(create()).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Pilar' } })
  const vibe = screen.getByRole('textbox', { name: 'Add a Vibe emoji' })
  for (const symbol of ['🌿', '🎨']) {
    fireEvent.change(vibe, { target: { value: symbol } })
    fireEvent.keyDown(vibe, { key: 'Enter' })
  }
  expect(create()).toBeEnabled()
  fireEvent.click(create())
  await waitFor(() => expect(onCreate).toHaveBeenCalledOnce())
  // Age starts blank and may stay blank.
  expect(onCreate.mock.calls[0][0]).toMatchObject({ name: 'Pilar', romanizedName: null, age: null, vibe: ['🌿', '🎨'] })
  expect(backend.begin).not.toHaveBeenCalled()
})

it('a language with a romanization asks for the romanized name before Create', () => {
  renderDialog(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '小林' } })
  const vibe = screen.getByRole('textbox', { name: 'Add a Vibe emoji' })
  for (const symbol of ['🚲', '🍜']) {
    fireEvent.change(vibe, { target: { value: symbol } })
    fireEvent.keyDown(vibe, { key: 'Enter' })
  }
  expect(create()).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Romanized name must be nonempty')
  fireEvent.change(screen.getByRole('textbox', { name: /Romanized name/ }), { target: { value: 'Xiǎo Lín' } })
  expect(create()).toBeEnabled()
})

it('Cancel closes without creating or generating', () => {
  const { onCreate, onClose } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(onCreate).not.toHaveBeenCalled()
  expect(backend.begin).not.toHaveBeenCalled()
})

it('Clear empties a generated persona back to a blank form', async () => {
  backend.run.mockResolvedValue(generated)
  renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Inés'))
  expect(screen.getByRole('textbox', { name: 'Favorite books' })).toHaveValue('- Moby-Dick')
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Favorite books' })).toHaveValue('')
  expect(screen.getByRole('spinbutton', { name: 'Age' })).toHaveValue(null)
})

it('a failed generation is shown in the dialog and leaves the form as it was', async () => {
  backend.run.mockRejectedValue(new Error('Sign in with Google before generating a contact.'))
  renderDialog()
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  expect(await screen.findByText('Sign in with Google before generating a contact.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft')
})

it('closing before admission returns cancels its eventual ID without running inference', async () => {
  let finish!: (id: string) => void
  backend.begin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { onClose } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close New persona' }))
  expect(onClose).toHaveBeenCalledOnce()
  await act(async () => finish('late-generation'))
  expect(backend.cancel).toHaveBeenCalledExactlyOnceWith('late-generation')
  expect(backend.run).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
})

it('closing cancels a running generation and discards its late result', async () => {
  let finish!: (value: PersonaDetails) => void
  backend.run.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { onClose } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(backend.run).toHaveBeenCalledExactlyOnceWith('generation'))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledOnce()
  expect(backend.cancel).toHaveBeenCalledExactlyOnceWith('generation')
  await act(async () => finish(generated))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
})

it('unmount cancels a running generation and reports cancellation failure globally', async () => {
  backend.run.mockImplementationOnce(() => new Promise(() => {}))
  backend.cancel.mockRejectedValueOnce(new Error('Cancellation persistence failed'))
  const view = render(<NewPersonaDialog language="es" romanized={false} busy={false} onCreate={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(backend.run).toHaveBeenCalledOnce())
  view.unmount()
  await waitFor(() => expect(backend.fault).toHaveBeenCalledWith('Stopping persona generation', expect.objectContaining({ message: 'Cancellation persistence failed' })))
  expect(backend.cancel).toHaveBeenCalledExactlyOnceWith('generation')
})

it('unmount before admission cancels the delayed receipt without running', async () => {
  let finish!: (id: string) => void
  backend.begin.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<NewPersonaDialog language="es" romanized={false} busy={false} onCreate={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  view.unmount()
  await act(async () => finish('late-generation'))
  expect(backend.cancel).toHaveBeenCalledExactlyOnceWith('late-generation')
  expect(backend.run).not.toHaveBeenCalled()
})

it('submission collects a pending Vibe emoji before creating without relying on blur', async () => {
  backend.run.mockResolvedValue(generated)
  const { onCreate } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Inés'))
  fireEvent.change(screen.getByRole('textbox', { name: 'Add a Vibe emoji' }), { target: { value: '🍊' } })
  fireEvent.submit(screen.getByRole('form', { name: 'New persona' }))
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({ ...generated, vibe: [...generated.vibe, '🍊'] })
})

it('submission preserves invalid pending Vibe input without creating', async () => {
  backend.run.mockResolvedValue(generated)
  const { onCreate } = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Inés'))
  const add = screen.getByRole('textbox', { name: 'Add a Vibe emoji' })
  fireEvent.change(add, { target: { value: 'unfinished' } })
  fireEvent.submit(screen.getByRole('form', { name: 'New persona' }))
  expect(onCreate).not.toHaveBeenCalled()
  expect(add).toHaveValue('unfinished')
  expect(await screen.findByText('Each Vibe entry must be one emoji. unfinished is not an emoji.')).toBeInTheDocument()
})
