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
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const size = this.classList.contains('message-tools-primary') ? 100 : this.classList.contains('message-tools-fixed') ? 30 : this.hasAttribute('data-measured-tool') ? 80 : 24
    return { width: size, height: 24, x: 0, y: 0, top: 0, left: 0, right: size, bottom: 24, toJSON: () => ({}) }
  })
  const select = vi.fn()
  render(<MessageTools play={null} inspect={null} tools={[]} actions={null}
    more={[{ key:'words', label:'Word by word', onSelect:select }, { key:'analysis', label:'Analysis', onSelect:select }]} />)
  expect(screen.queryByRole('button', { name:'More actions' })).toBeNull()
  expect(screen.getByRole('button', { name:'Analysis' })).toBeVisible()
  act(() => { width = 250; callbacks.forEach(callback => callback()) })
  expect(screen.getByRole('button', { name:'Word by word' })).toBeVisible()
  expect(screen.queryByRole('button', { name:'Analysis' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name:'More actions' }))
  fireEvent.click(screen.getByRole('button', { name:'Analysis' }))
  expect(select).toHaveBeenCalledOnce()
  act(() => { width = 300; callbacks.forEach(callback => callback()) })
  expect(screen.queryByRole('button', { name:'More actions' })).toBeNull()
  expect(screen.getAllByRole('button', { name:'Analysis' })).toHaveLength(1)
})
