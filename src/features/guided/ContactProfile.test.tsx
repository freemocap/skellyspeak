// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Partner } from '../../contracts'
import { ContactProfile } from './ContactProfile'
import { ContactChooser } from './ContactChooser'
const contact: Partner = { id: 'contact', learnerId: 'learner', languageId: 'ar', revision: 2, details: { name: 'ريم', background: 'Reads.', tendencies: 'Curious', vibe: ['🌿'], avatar: { seed: 4, hue: 60, lobes: 5 } } }

it('renders and edits without requesting work; blur saves and preserves avatar and source revision', async () => {
  const save = vi.fn().mockResolvedValue({ ...contact, revision: 3 })
  const view = render(<ContactProfile contact={contact} language="Arabic" onSave={save} />)
  fireEvent.click(screen.getByText('Background', { selector: 'summary' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'رِيم' } })
  expect(save).not.toHaveBeenCalled()
  view.rerender(<ContactProfile contact={{ ...contact, revision: 8 }} language="Arabic" onSave={save} />)
  fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save).toHaveBeenCalledWith(contact, { ...contact.details, name: 'رِيم' })
})

it('keeps failed edits and lets the user dismiss the error', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Revision changed'))
  render(<ContactProfile contact={contact} language="Arabic" onSave={save} />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Edited' } })
  fireEvent.blur(screen.getByRole('textbox', { name: 'Name' }))
  await screen.findByText('Revision changed')
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Edited')
  fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }))
  expect(screen.queryByText('Revision changed')).toBeNull()
  expect(save).toHaveBeenCalledTimes(1)
})

it('contact selection filters only; creation requires its own button', () => {
  const select = vi.fn(), create = vi.fn(), edit = vi.fn()
  render(<ContactChooser contacts={[contact]} selectedId={contact.id} busy={false} onSelect={select} onCreate={create} onEdit={edit} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: contact.id } })
  expect(select).toHaveBeenCalledWith(contact.id)
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
  expect(edit).toHaveBeenCalledWith(contact.id)
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
  expect(create).toHaveBeenCalledExactlyOnceWith(contact.id)
})
