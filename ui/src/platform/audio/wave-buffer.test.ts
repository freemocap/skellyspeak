import { expect, it } from 'vitest'
import { WaveBuffer } from './wave-buffer'

it('keeps the capture clock and waveform identical at different display rates', () => {
  const frequent = new WaveBuffer(48000), delayed = new WaveBuffer(48000)
  const expected: number[] = []
  for (let frame = 0; frame < 1407; frame++) {
    const samples = Float32Array.from({ length: 2048 }, (_, i) => Math.sin((frame * 2048 + i) / 70))
    frequent.append(samples); delayed.append(samples)
    expected.push(...frequent.read())
  }
  expect(delayed.endSeconds()).toBeCloseTo(1407 * 2048 / 48000)
  expect(delayed.read()).toEqual(expected.slice(-9000))
  expect(delayed.read()).toEqual([])
  expect(frequent.endSeconds()).toBe(delayed.endSeconds())
})

it('preserves peaks across chunk boundaries', () => {
  const wave = new WaveBuffer(48000)
  wave.append(Float32Array.from([0, -0.9, ...Array(30).fill(0)]))
  expect(wave.read()).toEqual([])
  wave.append(new Float32Array(32).fill(0.1))
  expect(wave.read()).toEqual([Math.fround(-0.9)])
})
