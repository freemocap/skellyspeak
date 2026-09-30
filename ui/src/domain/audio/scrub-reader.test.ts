import { expect, it } from 'vitest'
import { ScrubReader } from './scrub-reader'

it.each([0.25, 0.5, 1, 2, 4])('renders ordered audio once through a complete interval at %sx', speed => {
  const sourceRate = 16000, outputRate = 48000
  const length = sourceRate * 2
  // The constant channel removes the de-click envelope from the position probe.
  const constant = new Float32Array(length).fill(1)
  const ramp = Float32Array.from({ length }, (_, i) => i / sourceRate)
  const marks = Float32Array.from({ length }, (_, i) => i >= 0.4 * sourceRate && i < 0.5 * sourceRate ? 1 : 0)
  const reader = new ScrubReader([constant, ramp, marks], sourceRate, outputRate)
  reader.start(0.2)
  const output = Array.from({ length: 3 }, () => new Float32Array(128))
  let previous = 0.2, hits = 0, inMarker = false, blocks = 0
  let smallestStep = Infinity, greatestOvershoot = -Infinity
  let position = 0.2
  const render = () => {
    reader.render(output)
    for (let i = 0; i < 128; i++) {
      if (output[0][i] === 0) continue
      const time = output[1][i] / output[0][i]
      // Inspect every sample, but avoid hundreds of thousands of matcher calls
      // competing with the full suite on CI. NaN also propagates to the checks.
      smallestStep = Math.min(smallestStep, time - previous)
      greatestOvershoot = Math.max(greatestOvershoot, time - position)
      previous = time
      const marked = output[2][i] / output[0][i] > 0.5
      if (marked && !inMarker) hits++
      inMarker = marked
    }
  }
  while (position < 0.8) {
    if (blocks++ % 6 === 0) {
      position = Math.min(0.8, position + speed * 0.016)
      reader.move(position, 0.016)
    }
    render()
  }
  for (let i = 0; i < 20; i++) render()
  expect(smallestStep).toBeGreaterThanOrEqual(-0.000001)
  expect(greatestOvershoot).toBeLessThanOrEqual(0.000001)
  expect(reader.position).toBe(0.8 * sourceRate)
  expect(hits).toBe(1)
  expect(previous).toBeGreaterThan(0.799)
  reader.render(output)
  expect(output[0].every(value => value === 0)).toBe(true)
})

it('replaces destinations during variable-speed movement without rewinding or queuing', () => {
  const reader = new ScrubReader([new Float32Array(96000).fill(1)], 48000, 44100)
  const output = [new Float32Array(128)]
  reader.start(0)
  let time = 0, previous = 0
  for (const speed of [0.2, 3, 0.5, 4, 1]) {
    for (let i = 0; i < 10; i++) {
      time += speed * 0.016
      reader.move(time, 0.016)
      for (let j = 0; j < 5; j++) {
        reader.render(output)
        expect(reader.position).toBeGreaterThanOrEqual(previous)
        expect(reader.position).toBeLessThanOrEqual(time * 48000 + 0.000001)
        previous = reader.position
      }
    }
  }
  for (let i = 0; i < 20; i++) reader.render(output)
  expect(reader.position).toBe(time * 48000)
})

it('holds silently, reverses one head, and stops immediately on release', () => {
  const reader = new ScrubReader([new Float32Array(1000).fill(1)], 1000, 48000)
  const output = [new Float32Array(128)]
  reader.start(0.8); reader.render(output)
  expect(output[0].every(value => value === 0)).toBe(true)
  reader.move(0.2, 0.016)
  let last = reader.position
  for (let i = 0; i < 20; i++) {
    reader.render(output); expect(reader.position).toBeLessThanOrEqual(last); last = reader.position
  }
  expect(reader.position).toBe(200)
  reader.move(0.9, 0.02); reader.render(output); reader.stop(); reader.render(output)
  expect(output[0].every(value => value === 0)).toBe(true)
  reader.move(1, 0.02); reader.render(output)
  expect(output[0].every(value => value === 0)).toBe(true)
})

it('clamps edges and skips no source interval on a large forward destination', () => {
  const reader = new ScrubReader([new Float32Array(1000).fill(1)], 1000, 48000)
  const output = [new Float32Array(128)]
  reader.start(-1); reader.move(20, 0.01)
  reader.render(output)
  expect(reader.position).toBeGreaterThan(0)
  expect(reader.position).toBeLessThan(1000)
  for (let i = 0; i < 20; i++) reader.render(output)
  expect(reader.position).toBe(1000)
  expect(output[0].every(Number.isFinite)).toBe(true)
})
