// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FactoryReset } from './FactoryReset'
const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
beforeEach(() => {
  invoke.mockReset()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
it('requires explicit typed confirmation and allows cancel without erasing', () => {
  render(<FactoryReset />)
  fireEvent.click(screen.getByRole('button', { name: 'Clear all data…' }))
  const erase = screen.getByRole('button', { name: 'Erase all data and close' })
  expect(erase).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/Type DELETE/), { target: { value: 'delete' } })
  expect(erase).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(invoke).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('sends confirmation once and exposes native failures for retry', async () => {
  invoke.mockRejectedValue(new Error('Could not persist reset request'))
  render(<FactoryReset />)
  fireEvent.click(screen.getByRole('button', { name: 'Clear all data…' }))
  fireEvent.change(screen.getByLabelText(/Type DELETE/), { target: { value: 'DELETE' } })
  fireEvent.click(screen.getByRole('button', { name: 'Erase all data and close' }))
  expect(invoke).toHaveBeenCalledWith('factory_reset', { confirmation: 'DELETE' })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not persist reset request')
  expect(screen.getByRole('button', { name: 'Erase all data and close' })).toBeEnabled()
})
