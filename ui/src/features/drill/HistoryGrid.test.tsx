// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HistoryGrid } from './HistoryGrid'

afterEach(() => vi.restoreAllMocks())

it('moves outgoing words only when the next completed card replaces the expanded attempt', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { left: 10, top: Number(this.dataset.top ?? 20), width: 60, height: 20 } as DOMRect
  })
  const cancel = vi.fn()
  const animate = vi.fn(() => ({ cancel, onfinish: null }) as unknown as Animation)
  const original = HTMLElement.prototype.animate
  HTMLElement.prototype.animate = animate
  try {
    const view = render(<HistoryGrid expandedId="old" arriving={false}>
      <div data-history-id="old"><div className="drill-word-pair"><span className="drill-word-reference">word</span></div></div>
      <div data-history-id="older" data-top="300" />
    </HistoryGrid>)
    expect(animate).not.toHaveBeenCalled()
    view.rerender(<HistoryGrid expandedId="new" arriving={false}>
      <div data-history-id="old"><span className="drill-word-cell">word</span></div>
      <div data-history-id="older" data-top="324" />
    </HistoryGrid>)
    expect(animate).toHaveBeenCalledTimes(3)
    expect(animate.mock.calls[0]).toEqual([expect.any(Array), { duration: 800, easing: 'ease-in-out' }])
    expect(animate.mock.calls[1]).toEqual([[{ transform: 'translateY(-24px)', opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 800, easing: 'ease-in-out' }])
    expect(document.querySelector('.drill-word-flight')?.textContent).toBe('word')
    view.rerender(<HistoryGrid expandedId="new" arriving={false}>
      <div data-history-id="old"><span className="drill-word-cell">word</span></div>
      <div data-history-id="older" data-top="324" />
    </HistoryGrid>)
    expect(animate).toHaveBeenCalledTimes(3)
    view.unmount()
    expect(cancel).toHaveBeenCalledTimes(3)
    expect(document.querySelector('.drill-word-flight')).toBeNull()
  } finally { HTMLElement.prototype.animate = original }
})
