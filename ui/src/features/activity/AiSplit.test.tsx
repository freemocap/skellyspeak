// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { AiSplit } from './AiSplit'

beforeEach(() => localStorage.clear())
it('resizes by keyboard, clamps and restores its local width', () => {
  const view = render(<AiSplit inspector={<aside>Details</aside>}><main>Graph</main></AiSplit>)
  const handle = screen.getByRole('separator')
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(handle).toHaveAttribute('aria-valuenow', '44')
  fireEvent.keyDown(handle, { key: 'End' })
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(handle).toHaveAttribute('aria-valuenow', '75')
  view.unmount()
  render(<AiSplit inspector={<aside>Details</aside>}><main>Graph</main></AiSplit>)
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '75')
})
it('does not show a separator without an inspector', () => {
  render(<AiSplit inspector={null}><main>Graph</main></AiSplit>)
  expect(screen.queryByRole('separator')).toBeNull()
})
it('resizes with a captured pointer', () => {
  const view = render(<AiSplit inspector={<aside>Details</aside>}><main>Graph</main></AiSplit>)
  const root = view.container.firstElementChild as HTMLElement
  root.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000 } as DOMRect)
  const handle = screen.getByRole('separator')
  handle.setPointerCapture = () => {}
  handle.hasPointerCapture = () => true
  handle.releasePointerCapture = () => {}
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 })
  expect(handle).toHaveAttribute('aria-valuenow', '60')
  fireEvent.pointerUp(handle, { pointerId: 1 })
})
