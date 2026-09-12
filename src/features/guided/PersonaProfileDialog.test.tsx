// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Persona, PersonaDetails } from '../../contracts'
import { PersonaProfileDialog } from './PersonaProfileDialog'

const persona: Persona = { id: 'persona', learnerId: 'learner', languageId: 'es', revision: 1, details: { name: 'Carmen', romanizedName: null, age: 44, location: 'Sevilla', occupation: 'Teacher', background: '', currentSituation: '', interests: [], opinions: [], interestingFacts: [], favoriteBooks: [], favoriteMovies: [], manner: '', quirks: [], vibe: ['🌿', '🌊'] } }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
function Fixture({ save }: { save: (persona: Persona, details: PersonaDetails) => Promise<Persona> }) {
  const [saved, setSaved] = useState(persona)
  const [open, setOpen] = useState(true)
  return <><button onClick={() => setOpen(true)}>Open profile</button>{open && <PersonaProfileDialog persona={saved} language="Spanish" romanized={false} onNewPersona={vi.fn()} onSave={async (base, details) => { const next = await save(base, details); setSaved(next); return next }} onClose={() => setOpen(false)} />}</>
}
it('Escape flushes a focused field before closing; reopening reads the saved value', async () => {
  let resolve!: (persona: Persona) => void
  const save = vi.fn().mockImplementation(() => new Promise<Persona>(done => { resolve = done }))
  render(<Fixture save={save} />)
  const user = userEvent.setup()
  const name = screen.getByRole('textbox', { name: 'Name' })
  await user.click(name); await user.clear(name); await user.type(name, 'Revised')
  expect(save).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  expect(save).toHaveBeenCalledExactlyOnceWith(persona, { ...persona.details, name: 'Revised' })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  resolve({ ...persona, revision: 2, details: { ...persona.details, name: 'Revised' } })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await user.click(screen.getByRole('button', { name: 'Open profile' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Revised')
})
it('a settled failed save cannot be discarded by closing; successful retry permits reopen', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Save rejected'))
  render(<Fixture save={save} />)
  const user = userEvent.setup()
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Draft' } })
  fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
  await screen.findByText('Save rejected')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft')
  save.mockImplementation(async (base: Persona, details: PersonaDetails) => ({ ...base, revision: 2, details }))
  await user.click(screen.getByRole('button', { name: 'Close Persona' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await user.click(screen.getByRole('button', { name: 'Open profile' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft')
})
it('blank-name validation retains the focused draft on Escape without a command', async () => {
  const save = vi.fn()
  render(<Fixture save={save} />)
  const user = userEvent.setup()
  await user.clear(screen.getByRole('textbox', { name: 'Name' }))
  await user.keyboard('{Escape}')
  expect(await screen.findByText('Name must be nonempty and be at most 80 characters.')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  expect(save).not.toHaveBeenCalled()
})

it('offers a way into a new persona from the editor', () => {
  const onNewPersona = vi.fn()
  render(<PersonaProfileDialog persona={persona} language="Spanish" romanized={false} onSave={vi.fn()} onNewPersona={onNewPersona} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'New persona…' }))
  expect(onNewPersona).toHaveBeenCalledOnce()
})
