// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StableTurn } from './StableTurn'

afterEach(() => vi.restoreAllMocks())

it('keeps allocated height across hydration and replacement, releasing it for resizing and direct interaction', () => {
  let height = 120, width = 300
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { width, height: Math.max(height, Number.parseFloat(this.style.minBlockSize) || 0) } as DOMRect
  })
  const content = (key: string) => <StableTurn className="turn-stack"><div className="partner-turn">
    <div key={key} className="msg chat-message bot"><button>Translate</button></div>
  </div></StableTurn>
  const view = render(content('pending'))
  const bubble = () => view.container.querySelector<HTMLElement>('.msg')!
  expect(bubble().style.minBlockSize).toBe('120px')
  height = 90
  view.rerender(content('saved'))
  expect(bubble().style.minBlockSize).toBe('120px')
  height = 180
  view.rerender(content('saved'))
  expect(bubble().style.minBlockSize).toBe('180px')
  width = 500; height = 100
  view.rerender(content('saved'))
  expect(bubble().style.minBlockSize).toBe('100px')
  fireEvent.click(view.getByRole('button'))
  height = 80
  view.rerender(content('saved'))
  expect(bubble().style.minBlockSize).toBe('80px')
})
