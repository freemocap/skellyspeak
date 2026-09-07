// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardFlight } from './SkillRewards'
vi.mock('../../lib/reward-anchors', () => ({ rewardAnchor: (_scope: HTMLElement, kind: string) => kind === 'evidence' ? new DOMRect(100, 250, 80, 20) : new DOMRect(600, 80, 20, 20) }))
it('starts over evidence, survives the initial resize notification, and flashes the destination on arrival', () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  const animation = { cancel: vi.fn(), onfinish: null as (() => void) | null }
  const animate = vi.fn().mockReturnValue(animation)
  const original = HTMLElement.prototype.animate
  HTMLElement.prototype.animate = animate
  let notify: ResizeObserverCallback = () => {}
  vi.stubGlobal('ResizeObserver', class { constructor(callback: ResizeObserverCallback) { notify = callback } observe() {} disconnect() {} })
  const scope = document.createElement('div')
  scope.innerHTML = '<div data-reward-domain="reference"></div>'
  document.body.append(scope)
  const view = render(<RewardFlight workspace={{ current: scope }} reward={{ id: 'a:referent', messageId: 1, skillId: 'referent', domainId: 'reference', label: 'Referent', quote: 'this cup', xp: 10 }} />)
  try {
    const flag = document.querySelector('.skill-reward-flight') as HTMLElement
    expect(flag.style.left).toBe('140px')
    expect(flag.style.top).toBe('244px')
    notify([{ contentRect: new DOMRect(0, 0, 800, 600) } as ResizeObserverEntry], {} as ResizeObserver)
    expect(animation.cancel).not.toHaveBeenCalled()
    expect(animate.mock.calls[0][0].at(-1).transform).toContain('scale(.1)')
    animation.onfinish!()
    expect(animate).toHaveBeenCalledTimes(2)
  } finally { view.unmount(); scope.remove(); media.mockRestore(); HTMLElement.prototype.animate = original; vi.unstubAllGlobals() }
})
