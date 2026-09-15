// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TranscriptionInspectionResult } from '../../../generated/contracts'
import { TranscriptionInspector } from './TranscriptionInspector'
const transcript: TranscriptionInspectionResult = {
  text: 'fixture transcript', audioBase64: '', segments: [],
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

it('seeks the recording from words and scrubber, and exposes segment rather than word confidence', () => {
  const result = structuredClone(transcript)
  result.audioBase64 = 'UklGRg=='
  result.segments = [{ id: 0, start: 0, end: 1, text: 'Hola', avg_logprob: -0.42, no_speech_prob: 0.01, tokens: [123, 456], seek: null, temperature: null, compression_ratio: null }]
  result.inspection.wordTiming = { status: 'available', reason: null, words: [{ index: 0, word: 'Hola', providerStart: 0.2, providerEnd: 0.8, start: 0.2, end: 0.8, clipped: false }], unsupported: [] }
  const create = vi.fn(() => 'blob:inspection')
  const revoke = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const view = render(<TranscriptionInspector result={result} onClose={() => {}} />)
  const audio = document.querySelector('audio')!
  expect(audio.src).toBe('blob:inspection')
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  expect(audio.currentTime).toBe(0.2)
  expect(screen.getByText('Segment confidence')).toBeInTheDocument()
  expect(screen.getByText('-0.420')).toBeInTheDocument()
  expect(screen.getByText('123, 456')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('slider', { name: 'Playback position' }), { target: { value: '0.6' } })
  expect(audio.currentTime).toBe(0.6)
  fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '4' } })
  expect(document.querySelector('.inspection-timeline')).toHaveStyle({ width: '400%' })
  fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
  expect(document.querySelector('.inspection-timeline')).toHaveStyle({ width: '100%' })
  view.unmount()
  expect(revoke).toHaveBeenCalledWith('blob:inspection')
  expect(pause).toHaveBeenCalled()
})

it('surfaces playback failures and follows the real media clock on the zoomed timeline', async () => {
  const result = { ...transcript, audioBase64: 'UklGRg==' }
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:inspection'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('Playback refused'))
  render(<TranscriptionInspector result={result} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Audio playback failed.'))
  expect(play).toHaveBeenCalledOnce()
  const viewport = document.querySelector('.inspection-viewport')!
  Object.defineProperties(viewport, { clientWidth: { value: 200 }, scrollWidth: { value: 800 } })
  const audio = document.querySelector('audio')!
  audio.currentTime = 0.75
  fireEvent.timeUpdate(audio)
  expect(viewport.scrollLeft).toBe(560)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Follow playback' }))
  audio.currentTime = 0.1
  fireEvent.timeUpdate(audio)
  expect(viewport.scrollLeft).toBe(560)
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
  expect(audio.currentTime).toBe(0)
})
