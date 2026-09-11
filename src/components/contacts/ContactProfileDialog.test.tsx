// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Partner, PartnerDetails } from '../../contracts'
import { ContactProfileDialog } from './ContactProfileDialog'

const contact: Partner = { id: 'contact', learnerId: 'learner', languageId: 'es', revision: 1, details: { name: 'Carmen', background: '', tendencies: '', vibe: [], avatar: { seed: 1, hue: 60, lobes: 4 } } }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
function Fixture({ save }: { save: (contact: Partner, details: PartnerDetails) => Promise<Partner> }) {
  const [saved, setSaved] = useState(contact)
  const [open, setOpen] = useState(true)
  return <><button onClick={() => setOpen(true)}>Open profile</button>{open && <ContactProfileDialog contact={saved} language="Spanish" onSave={async (base, details) => { const next = await save(base, details); setSaved(next); return next }} onClose={() => setOpen(false)} />}</>
}
it('Escape flushes a focused field before closing; reopening reads the saved value', async () => {
  let resolve!: (contact: Partner) => void
  const save = vi.fn().mockImplementation(() => new Promise<Partner>(done => { resolve = done }))
  render(<Fixture save={save} />)
  const user = userEvent.setup()
  const name = screen.getByRole('textbox', { name: 'Name' })
  await user.click(name); await user.clear(name); await user.type(name, 'Revised')
  expect(save).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  expect(save).toHaveBeenCalledExactlyOnceWith(contact, { ...contact.details, name: 'Revised' })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  resolve({ ...contact, revision: 2, details: { ...contact.details, name: 'Revised' } })
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
  save.mockImplementation(async (base: Partner, details: PartnerDetails) => ({ ...base, revision: 2, details }))
  await user.click(screen.getByRole('button', { name: 'Close Contact profile' }))
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
  expect(await screen.findByText('Name is required.')).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  expect(save).not.toHaveBeenCalled()
})
