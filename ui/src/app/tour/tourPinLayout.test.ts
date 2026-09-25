import { expect, it } from 'vitest'
import { declutterPins } from './tourPinLayout'

function minPairwiseDistance(positions: { left: number; top: number }[]): number {
  let min = Infinity
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      min = Math.min(min, Math.hypot(positions[i].left - positions[j].left, positions[i].top - positions[j].top))
    }
  }
  return min
}

it('leaves pins that are already far apart untouched', () => {
  const positions = [{ left: 0, top: 0 }, { left: 200, top: 200 }, { left: 400, top: 0 }]
  expect(declutterPins(positions, 20)).toEqual(positions)
})

it('separates two pins placed at the exact same point', () => {
  const [first, second] = declutterPins([{ left: 50, top: 50 }, { left: 50, top: 50 }], 20)
  expect(first).toEqual({ left: 50, top: 50 })
  expect(Math.hypot(second.left - first.left, second.top - first.top)).toBeGreaterThanOrEqual(20)
})

it('keeps every pin at least minGap from every other pin in a dense cluster', () => {
  const cluster = [
    { left: 100, top: 40 }, { left: 102, top: 41 }, { left: 98, top: 39 },
    { left: 101, top: 45 }, { left: 99, top: 44 }, { left: 103, top: 42 },
  ]
  expect(minPairwiseDistance(declutterPins(cluster, 20))).toBeGreaterThanOrEqual(20 - 1e-9)
})

it('never moves the first pin, since earlier stops take placement priority', () => {
  const positions = [{ left: 10, top: 10 }, { left: 10, top: 10 }, { left: 10, top: 10 }]
  const [first] = declutterPins(positions, 15)
  expect(first).toEqual({ left: 10, top: 10 })
})

it('returns an empty array for no pins', () => {
  expect(declutterPins([], 20)).toEqual([])
})
