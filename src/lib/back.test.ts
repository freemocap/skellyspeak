// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { openOverlay } from './back'

it('serializes popover-to-dialog replacement and browser Back closes only the new top layer', async () => {
  const popoverClosed = vi.fn()
  const dialogClosed = vi.fn()
  const closePopover = openOverlay(popoverClosed)
  closePopover()
  const closeDialog = openOverlay(dialogClosed)
  await vi.waitFor(() => expect(history.state?.skellyspeak).toBe(2))
  history.back()
  await vi.waitFor(() => expect(dialogClosed).toHaveBeenCalledOnce())
  expect(popoverClosed).not.toHaveBeenCalled()
  closeDialog()
})
