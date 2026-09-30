// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MessageTools } from './MessageTools'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows tools when they fit and moves only excess tools into the menu as its container resizes', () => {
  let width = 300
  const callbacks = new Set<() => void>()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { callbacks.add(callback) }
    observe() {} disconnect() {} unobserve() {}
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return width })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    const size = this.classList.contains('message-tools-primary') ? 100 : this.classList.contains('message-tools-fixed') ? 30 : this.hasAttribute('data-measured-tool') ? 80 : 24
    return size
  })
  // A transformed entrance frame must not shrink the preferred toolbar width.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 0 } as DOMRect)
  const select = vi.fn()
  render(<MessageTools play={null} inspect={null} tools={[]} actions={null}
    more={[{ key:'words', label:'Words', onSelect:select }, { key:'analysis', label:'Analysis', onSelect:select }]} />)
  expect(screen.queryByRole('button', { name:'More actions' })).toBeNull()
  expect(screen.getByRole('button', { name:'Analysis' })).toBeVisible()
  act(() => { width = 250; callbacks.forEach(callback => callback()) })
  expect(screen.getByRole('button', { name:'Words' })).toBeVisible()
  expect(screen.queryByRole('button', { name:'Analysis' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name:'More actions' }))
  const analysis = screen.getByRole('button', { name:'Analysis' })
  expect(analysis.closest('.message-tools-panel')?.parentElement).toBe(document.body)
  fireEvent.keyDown(analysis, { key: 'Escape' })
  expect(screen.queryByRole('button', { name:'Analysis' })).toBeNull()
  expect(screen.getByRole('button', { name:'More actions' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name:'More actions' }))
  fireEvent.click(screen.getByRole('button', { name:'Analysis' }))
  expect(select).toHaveBeenCalledOnce()
  act(() => { width = 300; callbacks.forEach(callback => callback()) })
  expect(screen.queryByRole('button', { name:'More actions' })).toBeNull()
  expect(screen.getAllByRole('button', { name:'Analysis' })).toHaveLength(1)
})

it('announces pending work without exposing the reserved controls', () => {
  render(<MessageTools pending="Sending…" play={{ playing: false, onToggle: vi.fn() }} inspect={null}
    tools={[{ key: 'translate', label: 'Translate', onSelect: vi.fn() }]}
    more={[]} actions={<button>Edit</button>} />)
  expect(screen.getByRole('status')).toHaveTextContent('Sending…')
  expect(screen.queryByRole('button')).toBeNull()
})

it('keeps one playback button through preparation and playing, with cancellation available', () => {
  const toggle = vi.fn()
  const view = render(<MessageTools play={{ playing: false, preparing: true, onToggle: toggle }} inspect={null} tools={[]} actions={null} more={[]} />)
  const button = screen.getByRole('button', { name: 'Cancel speech preparation' })
  expect(screen.getByRole('status')).toHaveTextContent('Preparing audio…')
  fireEvent.click(button)
  expect(toggle).toHaveBeenCalledOnce()
  view.rerender(<MessageTools play={{ playing: true, preparing: false, onToggle: toggle }} inspect={null} tools={[]} actions={null} more={[]} />)
  expect(screen.getByRole('button', { name: 'Stop playback' })).toBe(button)
  expect(screen.queryByRole('status')).toBeNull()
})
