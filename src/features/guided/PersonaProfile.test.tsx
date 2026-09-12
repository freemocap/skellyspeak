// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Persona, PersonaDetails } from '../../contracts'
import { PersonaProfile } from './PersonaProfile'
const persona: Persona = { id: 'persona', learnerId: 'learner', languageId: 'ar', revision: 2, details: { name: 'ريم', romanizedName: 'Rīm', age: 31, location: 'Cairo', occupation: 'Engineer', background: 'Reads.', currentSituation: 'Moving house.', interests: ['Books'], opinions: ['Tea first'], interestingFacts: ['Recites poetry'], favoriteBooks: [], favoriteMovies: [], manner: 'Curious', quirks: ['Hums'], vibe: ['🌿', '🌊'] } }

it('renders and edits without requesting work; blur saves and preserves the romanized name and source revision', async () => {
  const save = vi.fn().mockResolvedValue({ ...persona, revision: 3 })
  const view = render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'رِيم' } })
  expect(save).not.toHaveBeenCalled()
  view.rerender(<PersonaProfile persona={{ ...persona, revision: 8 }} language="Arabic" romanized onSave={save} />)
  fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save).toHaveBeenCalledWith(persona, { ...persona.details, name: 'رِيم' })
})

it('keeps failed edits and lets the user dismiss the error', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Revision changed'))
  render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Edited' } })
  fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
  await screen.findByText('Revision changed')
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Edited')
  fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
  expect(screen.queryByText('Revision changed')).toBeNull()
  expect(save).toHaveBeenCalledTimes(1)
})

it('accepts any emoji into the Vibe and refuses text', async () => {
  const save = vi.fn().mockImplementation(async (base: Persona, next: PersonaDetails) => ({ ...base, revision: base.revision + 1, details: next }))
  render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  const add = screen.getByRole('textbox', { name: 'Add a Vibe emoji' })
  fireEvent.change(add, { target: { value: 'not an emoji' } })
  fireEvent.blur(add)
  await screen.findByText('Each Vibe entry must be one emoji. not an emoji is not an emoji.')
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(add, { target: { value: '🍊' } })
  fireEvent.keyDown(add, { key: 'Enter' })
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][1].vibe).toEqual(['🌿', '🌊', '🍊'])
  fireEvent.click(screen.getByRole('button', { name: 'Remove 🌿' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][1].vibe).toEqual(['🌊', '🍊'])
})

it('reads authored lists one entry per line and drops blanks and repeats', async () => {
  const save = vi.fn().mockImplementation(async (base: Persona, next: PersonaDetails) => ({ ...base, revision: base.revision + 1, details: next }))
  render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  const interests = screen.getByRole('textbox', { name: 'Interests' })
  expect(interests).toHaveValue('- Books')
  // Plain lines and Markdown bullets both read as items; the box shows bullets back.
  fireEvent.change(interests, { target: { value: 'Cycling\n\n- Cycling\n* Markets' } })
  fireEvent.blur(interests)
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][1].interests).toEqual(['Cycling', 'Markets'])
  expect(interests).toHaveValue('- Cycling\n- Markets')
})

it('refuses to write an out-of-range age without a command', async () => {
  const save = vi.fn()
  render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  const age = screen.getByRole('spinbutton', { name: 'Age' })
  fireEvent.change(age, { target: { value: '12' } })
  fireEvent.blur(age)
  await screen.findByText('Age must be blank or a whole number between 18 and 100.')
  expect(save).not.toHaveBeenCalled()
})


it('Clear blanks the draft without saving it', () => {
  const save = vi.fn()
  render(<PersonaProfile persona={persona} language="Arabic" romanized onSave={save} />)
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  expect(screen.getByRole('textbox', { name: 'Interests' })).toHaveValue('')
  expect(save).not.toHaveBeenCalled()
})
