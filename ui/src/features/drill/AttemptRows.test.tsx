// @vitest-environment jsdom
import { act, fireEvent, render, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { AttemptRows } from './AttemptRows'
import type { DrillAttemptView } from '../../generated/contracts'

const attempt = (sequence: number): DrillAttemptView => ({
  id: `attempt-${sequence}`, sequence: BigInt(sequence), transcript: 'quisiera un cafe', audioBytes: 12n, audioPrunedAt: null,
  transcriptionAttemptId: `recording-${sequence}`, createdAt: '2026-09-22T12:00:00.000Z',
  comparison: {
    policy: 'drill-comparison-v1', target: 'Quisiera un café.', transcript: 'quisiera un cafe',
    normalizations: ['lowercase'], normalizedTarget: 'quisiera un café', normalizedTranscript: 'quisiera un cafe',
    edits: 1n, referenceGraphemes: 16n, characterErrorRate: 0.0625, matchRatio: 0.9375, scriptNote: 'matches',
    words: [
      { kind: 'same', target: 'quisiera', transcript: 'quisiera', similarity: null },
      { kind: 'substituted', target: 'café', transcript: 'cafe', similarity: 0.75 },
      // A word the learner added is keyed to no target word, so it has no column.
      { kind: 'extra', target: null, transcript: 'por', similarity: null },
    ],
  },
} as unknown as DrillAttemptView)

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.drill-word-row'))
const renderRows = (props: Partial<Parameters<typeof AttemptRows>[0]> = {}) => render(
  <I18nProvider locale="english">
    <AttemptRows attempts={[attempt(3), attempt(2), attempt(1)]} {...props} />
  </I18nProvider>)

it('draws one cell per target word, newest take first, and gives each cell its word', () => {
  renderRows({ selectedId: 'attempt-3' })
  const drawn = rows()
  expect(drawn.map(row => row.getAttribute('aria-label'))).toEqual(['Attempt 3', 'Attempt 2', 'Attempt 1'])
  expect(drawn[0]).toHaveAttribute('aria-pressed', 'true')
  const cells = drawn[0].querySelectorAll<HTMLElement>('.drill-word-cell')
  expect(cells).toHaveLength(2)
  expect(within(drawn[0]).getByText('café')).toBeVisible()
  expect(cells[1]).toHaveAttribute('title', 'café: Uncertain')
  // The columns divide the width with no minimum, so the row cannot overflow.
  expect(drawn[0].querySelector<HTMLElement>('.drill-word-row-cells')?.style.gridTemplateColumns)
    .toBe('repeat(2, minmax(0, 1fr))')
})

it('marks the take that just arrived, and the rows it displaced, while it moves', () => {
  vi.useFakeTimers()
  try {
    const onArrivalEnd = vi.fn()
    renderRows({ arrivedId: 'attempt-3', onArrivalEnd })
    expect(document.querySelector('.drill-word-grid')).toHaveAttribute('data-arriving')
    const drawn = rows()
    expect(drawn[0]).toHaveAttribute('data-arrival')
    expect(drawn[0].parentElement).toHaveClass('drill-take-arrival')
    expect(drawn[1]).not.toHaveAttribute('data-arrival')
    // The mark clears on its own, so the next arrival moves the rows again.
    expect(onArrivalEnd).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(400) })
    expect(onArrivalEnd).toHaveBeenCalled()
  } finally { vi.useRealTimers() }
})

it('marks nothing when no take has just arrived', () => {
  renderRows()
  expect(document.querySelector('.drill-word-grid')).not.toHaveAttribute('data-arriving')
  expect(rows()[0]).not.toHaveAttribute('data-arrival')
})

it('draws nothing at all for a phrase with no takes', () => {
  const { container } = render(<I18nProvider locale="english"><AttemptRows attempts={[]} /></I18nProvider>)
  expect(container).toBeEmptyDOMElement()
})


it('reveals the full hovered word without replacing its cell and dismisses on scroll', () => {
  renderRows()
  const cell = rows()[0].querySelectorAll<HTMLElement>('.drill-word-cell')[1]
  fireEvent.mouseEnter(cell)
  const expanded = document.querySelector('.drill-word-preview')
  expect(expanded).toHaveTextContent(cell.textContent!)
  expect(expanded).toHaveAttribute('data-outcome', 'substituted')
  expect(rows()[0].querySelectorAll('.drill-word-cell')[1]).toBe(cell)
  fireEvent.scroll(window)
  expect(document.querySelector('.drill-word-preview')).toBeNull()
  fireEvent.mouseEnter(cell)
  fireEvent.mouseLeave(cell)
  expect(document.querySelector('.drill-word-preview')).toBeNull()
})

it('expands the selected take in its original position with accessible controls', () => {
  const onSelect = vi.fn()
  const renderDetails = (take: DrillAttemptView) => <section aria-label={`Details ${take.sequence}`}>Details</section>
  const view = renderRows({ renderDetails, onSelect })
  expect(within(rows()[0].parentElement!).getByRole('region', { name: 'Details 3' })).toBeVisible()
  fireEvent.click(rows()[1])
  expect(onSelect).toHaveBeenCalledWith('attempt-2')
  view.rerender(<I18nProvider locale="english"><AttemptRows attempts={[attempt(3), attempt(2), attempt(1)]}
    selectedId="attempt-2" renderDetails={renderDetails} onSelect={onSelect} /></I18nProvider>)
  expect(rows().map(row => row.getAttribute('aria-label'))).toEqual(['Attempt 3', 'Attempt 2', 'Attempt 1'])
  expect(rows()[0]).toHaveAttribute('aria-expanded', 'false')
  expect(rows()[1]).toHaveAttribute('aria-expanded', 'true')
  expect(within(rows()[1].parentElement!).getByRole('region', { name: 'Details 2' })).toBeVisible()
  expect(document.getElementById(rows()[1].getAttribute('aria-controls')!)).toHaveTextContent('Details')
  expect(view.queryByRole('region', { name: 'Details 3' })).toBeNull()
})

it('uses the result color for exact, unmatched, partial and unscored attempts', () => {
  const cases = [
    { ratio: 1, accepted: true, result: 'matched' },
    { ratio: 0, accepted: true, result: 'unmatched' },
    { ratio: 0.7, accepted: true, result: 'uncertain' },
    { ratio: null, accepted: true, result: 'uncertain' },
    { ratio: 1, accepted: false, result: 'uncertain' },
  ]
  for (const { ratio, accepted, result } of cases) {
    const take = attempt(1)
    take.comparison.matchRatio = ratio
    take.comparison.reliability = { ...take.comparison.reliability, accepted } as NonNullable<typeof take.comparison.reliability>
    const view = renderRows({ attempts: [take], renderDetails: () => <p>Details</p> })
    expect(view.container.querySelector('.drill-history-entry[data-expanded]')).toHaveAttribute('data-result', result)
    view.unmount()
  }
})
