// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { InfoTip } from './InfoTip'

it('opens supporting text in the top layer for pointer and keyboard access', () => {
  const show = vi.fn(), hide = vi.fn()
  HTMLElement.prototype.showPopover = show
  HTMLElement.prototype.hidePopover = hide
  const view = render(<InfoTip>Calculation details</InfoTip>)
  const button = screen.getByRole('button', { name: 'Information' })
  expect(show).not.toHaveBeenCalled()
  fireEvent.mouseEnter(button)
  expect(show).toHaveBeenCalledOnce()
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveAttribute('popover', 'manual')
  fireEvent.mouseLeave(button)
  expect(hide).toHaveBeenCalledOnce()
  fireEvent.focus(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(button, { key: 'Escape' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  view.unmount()
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
})
