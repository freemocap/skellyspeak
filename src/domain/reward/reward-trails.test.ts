// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { animateRewardTrails } from './reward-trails'

it('uses the same path ahead and behind with shrinking empty outlines and cleans up on completion', () => {
  const card = document.createElement('div')
  Object.assign(card.style, { left: '30px', top: '100px', zIndex: '1105' })
  document.body.append(card)
  const bounds = vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(30, 100, 300, 180))
  const original = Element.prototype.animate
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const animate = vi.fn<Element['animate']>(() => {
    const animation = { cancel: vi.fn(), onfinish: null }
    animations.push(animation)
    return animation as unknown as Animation
  })
  Element.prototype.animate = animate
  const cleanups = new Set<() => void>()
  const frames: Keyframe[] = [{ transform: 'translate(0, 0)', opacity: 1 }, { transform: 'translate(50px, -20px)', opacity: 1, offset: .5 }, { transform: 'translate(100px, -40px)', opacity: 0 }]
  try {
    animateRewardTrails(card, frames, { duration: 560, easing: 'ease-in' }, cleanups)
    const traces = [...document.querySelectorAll<HTMLElement>('.reward-path-trace')]
    expect(traces).toHaveLength(8)
    expect(animate.mock.calls.map(call => (call[1] as KeyframeAnimationOptions).delay)).toEqual([-55, -110, -165, -220, 55, 110, 165, 220])
    for (const trace of traces) {
      expect(trace).toHaveAttribute('aria-hidden', 'true')
      expect(trace).toHaveStyle({ width: '300px', height: '180px' })
      expect(trace.textContent).toBe('')
    }
    expect(traces[0].firstElementChild).toHaveStyle({ transform: 'scale(0.85)' })
    expect(traces[3].firstElementChild).toHaveStyle({ transform: 'scale(0.4)' })
    expect((animate.mock.calls[0][0] as Keyframe[]).map(frame => frame.transform)).toEqual(frames.map(frame => frame.transform))
    for (const animation of animations) animation.onfinish!()
    expect(document.querySelector('.reward-path-trace')).toBeNull()
    expect(cleanups.size).toBe(0)
    animateRewardTrails(card, frames, { duration: 560 }, cleanups)
    for (const stop of cleanups) stop()
    expect(document.querySelector('.reward-path-trace')).toBeNull()
    expect(animations.slice(8).every(animation => animation.cancel.mock.calls.length === 1)).toBe(true)
  } finally { for (const stop of cleanups) stop(); card.remove(); bounds.mockRestore(); Element.prototype.animate = original }
})
