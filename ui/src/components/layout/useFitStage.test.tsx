// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useFitStage } from './useFitStage'

const STAGES = ['full', 'compact', 'minimal'] as const
type Stage = typeof STAGES[number]

// jsdom has no layout: each test says how much room the row has and what each
// layout needs, and the row reports overflow from those numbers.
let resized: Array<() => void> = []
beforeEach(() => {
  resized = []
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized.push(callback) }
    observe() {} unobserve() {} disconnect() {}
  })
})
afterEach(() => vi.unstubAllGlobals())

const stages: Stage[] = []
function Row({ room, need, label = 'label' }: { room: () => number; need: (stage: Stage, label: string) => number; label?: string }) {
  const bar = useRef<HTMLDivElement>(null)
  const stage = useFitStage(bar, STAGES, element => need(element.dataset.fit as Stage, element.textContent ?? '') > room())
  stages.push(stage)
  return <div ref={bar} className="row"><span>{label}</span></div>
}
const row = () => document.querySelector<HTMLElement>('.row')!
const needs = { full: 150, compact: 90, minimal: 50 }

it('shows the fullest layout that fits, and marks it on the row for its stylesheet', () => {
  render(<Row room={() => 100} need={stage => needs[stage]} />)
  expect(row()).toHaveAttribute('data-fit', 'compact')
  expect(stages.at(-1)).toBe('compact')
})

it('keeps the most compact layout when none fits', () => {
  render(<Row room={() => 10} need={stage => needs[stage]} />)
  expect(row()).toHaveAttribute('data-fit', 'minimal')
  expect(stages.at(-1)).toBe('minimal')
})

it('returns to a fuller layout when the row gets its room back', () => {
  let room = 60
  render(<Row room={() => room} need={stage => needs[stage]} />)
  expect(row()).toHaveAttribute('data-fit', 'minimal')
  room = 200
  act(() => resized.forEach(callback => callback()))
  expect(row()).toHaveAttribute('data-fit', 'full')
  expect(stages.at(-1)).toBe('full')
})

it('fits again when the row’s content changes without its owner rendering', async () => {
  // A longer label needs more room in every layout: five letters fit in full,
  // nineteen fit in none.
  render(<Row room={() => 160} need={(stage, label) => needs[stage] * label.length / 5} />)
  expect(row()).toHaveAttribute('data-fit', 'full')
  await act(async () => { row().querySelector('span')!.textContent = 'a much longer label' })
  expect(row()).toHaveAttribute('data-fit', 'minimal')
})

it('fits again when the document’s appearance changes the row’s spacing or type', async () => {
  let room = 100
  render(<Row room={() => room} need={stage => needs[stage]} />)
  expect(row()).toHaveAttribute('data-fit', 'compact')
  room = 40
  await act(async () => { document.documentElement.style.setProperty('--layout-scale', '1.5') })
  expect(row()).toHaveAttribute('data-fit', 'minimal')
  document.documentElement.style.removeProperty('--layout-scale')
})
