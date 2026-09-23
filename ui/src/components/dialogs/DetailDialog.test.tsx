// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DetailDialog } from './DetailDialog'

it('dismisses only backdrop clicks, not dialog padding or content', () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const close = vi.fn()
  render(<DetailDialog title="Details" onClose={close}><p>Message details</p></DetailDialog>)
  const dialog = screen.getByRole('dialog')
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 200))
  fireEvent.click(screen.getByText('Message details'))
  fireEvent.click(dialog, { clientX: 110, clientY: 110 })
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(dialog, { clientX: 20, clientY: 20 })
  expect(close).toHaveBeenCalledOnce()
})

it('allows capture policy to be preserved independently of dialog geometry', async () => {
  const { beginCapture, endCapture } = await import('../../platform/audio/speech')
  const suspend = vi.fn()
  const token = beginCapture(suspend)
  try {
    const view = render(<DetailDialog capture="preserve" title="Report" onClose={() => {}}>Report</DetailDialog>)
    expect(suspend).not.toHaveBeenCalled()
    view.unmount()
    render(<DetailDialog capture="suspend" title="Other view" onClose={() => {}}>Other view</DetailDialog>)
    expect(suspend).toHaveBeenCalledOnce()
  } finally { endCapture(token) }
})
