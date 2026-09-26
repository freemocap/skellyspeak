import { expect, it } from 'vitest'
import { POP_SOUNDS, renderPops, type PopSound } from '../tools/pop-sounds'
it('renders all choices without clipping and repeats without changing pitch', () => {
  for (const kind of Object.keys(POP_SOUNDS) as PopSound[]) {
    const one = renderPops(kind, 1)
    const burst = renderPops(kind, 12)
    let peak = 0
    for (const value of burst) { if (!Number.isFinite(value)) throw new Error('Nonfinite sample'); peak = Math.max(peak, Math.abs(value)) }
    expect(peak).toBeGreaterThan(.01)
    expect(peak).toBeLessThan(1)
    expect(burst.slice(0, 4800)).toEqual(one.slice(0, 4800))
    expect(burst.slice(2 * 11040 + 1000, 2 * 11040 + 4800)).toEqual(one.slice(1000, 4800))
    expect(burst.at(-1)).toBe(0)
  }
})
it('places repeated cues at the selected interval', () => {
  for (const interval of [40, 120, 1000]) {
    const burst = renderPops('click', 3, 48000, interval)
    const one = renderPops('click', 1)
    const offset = Math.round(interval / 1000 * 48000)
    expect(burst.slice(offset, offset + 800)).toEqual(one.slice(0, 800))
    expect(burst.length).toBe(Math.ceil((2 * interval / 1000 + .34) * 48000))
  }
})
