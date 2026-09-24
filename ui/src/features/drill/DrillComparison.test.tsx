// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { DrillComparison } from './DrillComparison'

function view(overrides: Partial<Parameters<typeof DrillComparison>[0]> = {}) {
  return <I18nProvider locale="english"><DrillComparison target={<p>Hola</p>} reference={null} referenceTime={0} onSeekReference={() => {}}
    onPlayReference={() => {}} playingReference={false} referenceNote="" attempt={null} attemptLabel={null} attemptFailure={null}
    onRetryAttempt={() => {}} attemptUnavailable={null} direction="ltr" onDirection={() => {}} timeScale="fit" onTimeScale={() => {}}
    holding={false} playingAttempt={false} onPlayAttempt={() => {}} {...overrides} /></I18nProvider>
}

it('draws every reference state inside the same frame', () => {
  const { container, rerender } = render(view())
  const frame = container.querySelector('.drill-plot-frame')
  expect(frame).toHaveAttribute('data-state', 'empty')
  expect(screen.getByText('Hear it once to draw the reference here.')).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeDisabled()
  rerender(view({ playingReference: true }))
  expect(container.querySelector('.drill-plot-frame')).toBe(frame)
  expect(frame).toHaveAttribute('data-state', 'loading')
  expect(screen.getByText('Loading reference…')).toBeInTheDocument()
  rerender(view({ referenceFailure: <p role="alert">No audio</p> }))
  expect(container.querySelector('.drill-plot-frame')).toBe(frame)
  expect(frame).toHaveAttribute('data-state', 'failed')
  expect(frame).toContainElement(screen.getByRole('alert'))
})

it('keeps the take frame while its recording loads', () => {
  const { container } = render(view({ attemptLabel: 'Attempt 2' }))
  const frames = container.querySelectorAll('.drill-plot-frame')
  expect(frames).toHaveLength(2)
  expect(frames[0]).toHaveTextContent('Play the reference to compare it with this attempt.')
  expect(frames[1]).toHaveAttribute('data-state', 'loading')
})
