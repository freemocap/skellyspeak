// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TranscriptionInspectionResult } from '../../contracts'
import { TranscriptionInspector } from './TranscriptionInspector'
const transcript: TranscriptionInspectionResult = {
  text: 'fixture transcript',
  inspection: { recordingId: 'fixture-recording', conversationId: 'fixture-conversation', duration: 1, sampleRate: 16000,
    waveform: { binSeconds: 0.5, min: [-0.4, -0.2], max: [0.4, 0.2] },
    spectrogram: { frameSeconds: 0.5, frameStartSeconds: [0, 0.5], windowSeconds: 0.025, fftSize: 512, frequencyBinHz: 100, maxFrequencyHz: 200, dbMin: -80, dbMax: 0, bins: [[-60, -30], [-70, -20]] },
    activity: { algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -40, regions: [{ start: 0.1, end: 0.9 }], pauses: [], limitations: [] },
    wordTiming: { status: 'unavailable', reason: 'Provider returned text only.', words: [], unsupported: [] } },
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', '') })
  HTMLDialogElement.prototype.close = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
it('shows original transcript and unavailable timings without invented words', () => {
  render(<TranscriptionInspector result={transcript} onClose={() => {}} />)
  expect(screen.getByText('fixture transcript')).toBeInTheDocument()
  expect(screen.getByText(/Word timings unavailable/)).toHaveTextContent('Word timings unavailable: Provider returned text only.')
  expect(screen.queryByLabelText('Word timing overlays')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Detected audio activity' })).toBeInTheDocument()
})
it('focuses a timed word on the plot and shows clipping without rewriting the transcript', () => {
  const result = structuredClone(transcript)
  result.inspection.wordTiming = { status: 'available', reason: null,
    words: [{ index: 0, word: 'Hola', providerStart: 0, providerEnd: 1, start: 0.1, end: 0.9, clipped: true }],
    unsupported: [{ index: 1, word: 'adiós', providerStart: 1, providerEnd: 2, reason: 'No overlapping activity' }] }
  render(<TranscriptionInspector result={result} onClose={() => {}} />)
  const word = screen.getByRole('button', { name: 'Hola' })
  fireEvent.focus(word)
  expect(word).toHaveAttribute('aria-pressed', 'true')
  expect(document.querySelector('.inspection-plot-word')).toHaveTextContent('Hola')
  expect(screen.getByText(/clipped from/)).toHaveTextContent('0.10 s–0.90 s · clipped from 0.00 s–1.00 s')
  fireEvent.click(screen.getByLabelText('Word timing overlays'))
  expect(document.querySelector('.inspection-plot-word')).toBeNull()
  expect(screen.getByText('These words remain in the transcript.')).toBeInTheDocument()
  expect(screen.getByText('fixture transcript')).toBeInTheDocument()
})
it('closes through the same explicit dialog action', () => {
  const close = vi.fn()
  render(<TranscriptionInspector result={transcript} onClose={close} />)
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording inspection' }))
  expect(close).toHaveBeenCalledOnce()
})
