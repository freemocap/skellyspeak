// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CoachDock } from './CoachDock'

beforeEach(() => { localStorage.clear() })
function mount() {
  return render(<div><CoachDock actions={<button>Clear thread</button>}><div className="lesson-thread">Messages</div><textarea aria-label="Message your coach" /></CoachDock></div>)
}
it('starts compact and restores resized height and collapse state across mounts', () => {
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 700 } as DOMRect)
  let view = mount()
  expect(screen.getByLabelText('Resize coach panel')).toHaveAttribute('aria-valuenow', '160')
  fireEvent.keyDown(screen.getByLabelText('Resize coach panel'), { key: 'ArrowUp' })
  expect(screen.getByLabelText('Coach panel')).toHaveStyle({ height: '184px' })
  fireEvent.click(screen.getByLabelText('Collapse coach thread'))
  expect(screen.getByLabelText('Coach panel')).toHaveClass('is-collapsed')
  expect(screen.getByLabelText('Message your coach')).toBeVisible()
  view.unmount()
  view = mount()
  expect(screen.getByLabelText('Expand coach thread')).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByLabelText('Expand coach thread'))
  expect(screen.getByLabelText('Coach panel')).toHaveStyle({ height: '184px' })
  view.unmount()
  bounds.mockRestore()
})
it('bounds resizing to leave room for the lesson and collapses at the minimum', () => {
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect)
  mount()
  const divider = screen.getByLabelText('Resize coach panel')
  fireEvent.keyDown(divider, { key: 'ArrowUp' })
  expect(divider).toHaveAttribute('aria-valuenow', '180')
  for (let i = 0; i < 4; i += 1) fireEvent.keyDown(divider, { key: 'ArrowDown' })
  expect(screen.getByLabelText('Coach panel')).toHaveClass('is-collapsed')
  expect(screen.getByLabelText('Message your coach')).toBeVisible()
  bounds.mockRestore()
})

it('resizes upward by dragging the divider and persists the result', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains('coach-dock') ? 160 : 700 } as DOMRect
  })
  const view = mount()
  const divider = screen.getByLabelText('Resize coach panel')
  fireEvent.pointerDown(divider, { button: 0, clientY: 500 })
  fireEvent.pointerMove(divider, { clientY: 350 })
  fireEvent.pointerUp(divider)
  expect(screen.getByLabelText('Coach panel')).toHaveStyle({ height: '310px' })
  view.unmount()
  mount()
  expect(screen.getByLabelText('Coach panel')).toHaveStyle({ height: '310px' })
  bounds.mockRestore()
  vi.unstubAllGlobals()
})
