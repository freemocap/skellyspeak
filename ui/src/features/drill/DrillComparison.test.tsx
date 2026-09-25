// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import type { AudioInspection } from '../../generated/contracts'
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

const inspection: AudioInspection = {
  recordingId: 'recording-1', owner: { kind: 'drillItem', id: 'item-1' }, duration: 1, sampleRate: 16000,
  waveform: { binSeconds: 0.5, min: [-0.2], max: [0.2] },
  spectrogram: {
    frameSeconds: 0.5, frameStartSeconds: [0], windowSeconds: 0.5, fftSize: 512,
    bands: [{ lowHz: 50, centerHz: 100, highHz: 200 }], minFrequencyHz: 50, maxFrequencyHz: 8000,
    measuredMaxFrequencyHz: 8000, melScale: 'htk', normalization: 'unit-peak triangular filters',
    dbReference: '0 dB = full-scale power (1.0)', dbMin: -100, dbMax: 0, bins: [[-40]],
  },
  activity: { algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -40, regions: [], pauses: [], limitations: [] },
  wordTiming: { status: 'unavailable', reason: null, words: [], unsupported: [] },
}

it('disables alignment without word timing and shows no timing error', () => {
  const { container } = render(view({ reference: inspection, attempt: inspection, attemptLabel: 'Take 1', timeScale: 'words' }))
  expect(container.querySelectorAll('.audio-spectrum-cursor')[1]).toHaveStyle({ left: '0%' })
  expect(screen.getByRole('radio', { name: 'Align words' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Fit' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByText(/Word timings unavailable/)).not.toBeInTheDocument()
})

it('aligns the word track, preserves playback, and resets the view when timing disappears', () => {
  const timed = (duration: number, start: number, end: number): AudioInspection => ({ ...inspection, duration,
    wordTiming: { status: 'available', reason: null, unsupported: [], words: [
      { index: 0, word: 'Hola', start, end, providerStart: start, providerEnd: end, clipped: false },
    ] },
  })
  const reference = timed(2, 0.2, 1), attempt = timed(4, 1, 3)
  const onTimeScale = vi.fn(), onPlayAttempt = vi.fn()
  const props = { reference, attempt, attemptLabel: 'Take 1', onTimeScale, onPlayAttempt }
  const { container, rerender } = render(view(props))
  fireEvent.click(screen.getByRole('radio', { name: 'Align words' }))
  expect(onTimeScale).toHaveBeenCalledWith('words')
  rerender(view({ ...props, timeScale: 'words', attemptTime: 2 }))
  const cursor = container.querySelectorAll<HTMLElement>('.audio-spectrum-cursor')[1]
  expect(parseFloat(cursor.style.left)).toBeCloseTo(30)
  expect(container.querySelector('.inspection-token-label')).toHaveStyle({ left: '10%', width: '40%' })
  expect(screen.getByText(/Word-aligned display; playback uses original timing/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  expect(onPlayAttempt).toHaveBeenCalledOnce()
  rerender(view({ ...props, attempt: inspection, timeScale: 'words' }))
  expect(screen.getByRole('radio', { name: 'Align words' })).toBeDisabled()
  expect(screen.queryByText(/Word-aligned display; playback uses original timing/)).not.toBeInTheDocument()
})
