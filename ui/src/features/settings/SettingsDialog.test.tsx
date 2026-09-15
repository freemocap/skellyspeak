// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
it('uses native modality, preserves shortcut capture and restores the opener', () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const close = vi.fn()
  const view = render(<SettingsDialog title="Settings" onClose={close}><input aria-label="Shortcut" data-shortcut-capture /></SettingsDialog>)
  const dialog = screen.getByRole('dialog') as HTMLDialogElement
  expect(dialog.open).toBe(true)
  const input = screen.getByLabelText('Shortcut')
  input.focus()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(close).not.toHaveBeenCalled()
  input.removeAttribute('data-shortcut-capture')
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(close).toHaveBeenCalledOnce()
  view.unmount()
  expect(opener).toHaveFocus()
  opener.remove()
})
it('leaves nested dialog cancellation to its own handler', () => {
  const close = vi.fn()
  const nestedClose = vi.fn()
  render(<SettingsDialog title="Settings" onClose={close}><dialog open aria-label="Reset" onCancel={nestedClose}>Reset</dialog></SettingsDialog>)
  fireEvent(screen.getByRole('dialog', { name: 'Reset' }), new Event('cancel', { cancelable: true }))
  expect(nestedClose).toHaveBeenCalledOnce()
  expect(close).not.toHaveBeenCalled()
})
