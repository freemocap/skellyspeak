// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TranscriptionInspectionResult } from '../../../generated/contracts'
import { I18nProvider } from '../../../components/localization/i18n'
import { TranscriptionInspector } from './TranscriptionInspector'
import { replaySelectionAudio } from '../../../platform/audio/reading-speech'

vi.mock('../../../platform/audio/reading-speech', () => ({ replaySelectionAudio: vi.fn() }))
vi.mock('../../../platform/audio/scrub-player', () => ({ createScrubPlayer: () => ({ start: vi.fn(), move: vi.fn(), end: vi.fn(), dispose: vi.fn(), setVolume: vi.fn() }) }))
const replay = vi.mocked(replaySelectionAudio)
const playback = { rate: 1, volume: 1, enabled: true }
const transcript: TranscriptionInspectionResult = {
  text: 'fixture transcript', audioBase64: '', diagnostics: null,
  inspection: { recordingId: 'fixture-recording', owner: { kind: 'conversation', id: 'fixture-conversation' }, duration: 1, sampleRate: 16000,
    waveform: { binSeconds: 0.5, min: [-0.4, -0.2], max: [0.4, 0.2] },
    spectrogram: { frameSeconds: 0.5, frameStartSeconds: [0, 0.5], windowSeconds: 0.025, fftSize: 512, bands: [{ lowHz: 50, centerHz: 100, highHz: 200 }, { lowHz: 100, centerHz: 200, highHz: 400 }], minFrequencyHz: 50, maxFrequencyHz: 400, measuredMaxFrequencyHz: 400, melScale: 'htk', normalization: 'unit-peak triangular filters', dbReference: '0 dB = full-scale power (1.0)', dbMin: -80, dbMax: 0, bins: [[-60, -30], [-70, -20]] },
    activity: { algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -40, regions: [{ start: 0.1, end: 0.9 }], pauses: [], limitations: [] },
    wordTiming: { status: 'unavailable', reason: 'Provider returned text only.', words: [], unsupported: [] } },
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', '') })
  HTMLDialogElement.prototype.close = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  replay.mockReset()
})
const position = () => screen.getByRole('slider', { name: 'Playback position' })

it('shows original transcript and unavailable timings without invented words', () => {
  render(<TranscriptionInspector result={transcript} {...playback} onClose={() => {}} />)
  expect(screen.getByText('fixture transcript')).toBeInTheDocument()
  expect(screen.getByText(/Word timings unavailable/)).toHaveTextContent('Word timings unavailable: Provider returned text only.')
  expect(screen.queryByLabelText('Word timing overlays')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Detected audio activity' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Recorded audio amplitude' })).toBeInTheDocument()
})
it('focuses a timed word on the plots and shows clipping without rewriting the transcript', () => {
  const result = structuredClone(transcript)
  result.inspection.wordTiming = { status: 'available', reason: null,
    words: [{ index: 0, word: 'Hola', providerStart: 0, providerEnd: 1, start: 0.1, end: 0.9, clipped: true }],
    unsupported: [{ index: 1, word: 'adiós', providerStart: 1, providerEnd: 2, reason: 'No overlapping activity' }] }
  render(<TranscriptionInspector result={result} {...playback} onClose={() => {}} />)
  const word = screen.getByRole('button', { name: 'Hola' })
  fireEvent.focus(word)
  expect(word).toHaveAttribute('aria-pressed', 'true')
  expect(document.querySelectorAll('.timed-words[data-placement="overlay"] .timed-word[data-selected]')).toHaveLength(2)
  expect(screen.getByText(/clipped from/)).toHaveTextContent('0.10 s–0.90 s · clipped from 0.00 s–1.00 s')
  fireEvent.click(screen.getByLabelText('Word timing overlays'))
  expect(document.querySelector('.timed-words[data-placement="overlay"]')).toBeNull()
  expect(screen.getByText('These words remain in the transcript.')).toBeInTheDocument()
  expect(screen.getByText('fixture transcript')).toBeInTheDocument()
})
it('closes through the same explicit dialog action', () => {
  const close = vi.fn()
  render(<TranscriptionInspector result={transcript} {...playback} onClose={close} />)
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording inspection' }))
  expect(close).toHaveBeenCalledOnce()
})

it('seeks the recording from words and the shared progress bar, and exposes segment rather than word confidence', () => {
  const result = structuredClone(transcript)
  result.audioBase64 = 'UklGRg=='
  result.diagnostics = { segment_evidence: [{ start: 0, end: 1, avg_logprob: -0.42, no_speech_prob: 0.01 }] }
  result.inspection.wordTiming = { status: 'available', reason: null, words: [{ index: 0, word: 'Hola', providerStart: 0.2, providerEnd: 0.8, start: 0.2, end: 0.8, clipped: false }], unsupported: [] }
  render(<TranscriptionInspector result={result} {...playback} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  expect(position()).toHaveAttribute('aria-valuenow', '0.2')
  expect(screen.getByText('Diagnostics')).toBeInTheDocument()
  expect(document.querySelector('pre')).toHaveTextContent('avg_logprob')
  expect(document.querySelector('pre')).toHaveTextContent('-0.42')
  fireEvent.keyDown(position(), { key: 'End' })
  expect(position()).toHaveAttribute('aria-valuenow', '1')
  fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '4' } })
  expect(document.querySelector('.inspection-timeline')).toHaveStyle({ width: '400%' })
  fireEvent.click(screen.getByRole('button', { name: 'Fit' }))
  expect(document.querySelector('.inspection-timeline')).toHaveStyle({ width: '100%' })
})

it('plays through the shared speech player, surfaces its failures and follows its clock on the zoomed timeline', async () => {
  const result = { ...transcript, audioBase64: 'UklGRg==' }
  let observed: ((seconds: number, duration: number) => void) | undefined
  let fail: (error: Error) => void = () => {}
  replay.mockImplementation((_audio, _signal, _onPlayback, _rate, _volume, observer) => {
    observed = observer?.onTime
    return new Promise<void>((_resolve, reject) => { fail = reject })
  })
  render(<TranscriptionInspector result={result} {...playback} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  expect(replay).toHaveBeenCalledOnce()
  expect(replay.mock.calls[0][0]).toBe('UklGRg==')
  const viewport = document.querySelector('.inspection-viewport')!
  Object.defineProperties(viewport, { clientWidth: { value: 200 }, scrollWidth: { value: 800 } })
  act(() => observed!(0.75, 1))
  expect(viewport.scrollLeft).toBe(560)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Follow playback' }))
  act(() => observed!(0.1, 1))
  expect(viewport.scrollLeft).toBe(560)
  await act(async () => fail(new Error('Playback refused')))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Audio playback failed.'))
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
  expect(position()).toHaveAttribute('aria-valuenow', '0')
})

it('does not play while the microphone holds the speakers', () => {
  render(<TranscriptionInspector result={{ ...transcript, audioBase64: 'UklGRg==' }} {...playback} enabled={false} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
})

it('uses the interface locale for decimals while retaining a left-to-right scientific time axis', () => {
  render(<I18nProvider locale="german"><TranscriptionInspector result={transcript} {...playback} onClose={() => {}} /></I18nProvider>)
  expect(screen.getAllByText(/1,00 s/).length).toBeGreaterThan(0)
  expect(screen.getByText('0,25 s')).toBeVisible()
  expect(document.querySelector('.inspection-viewport')).toHaveAttribute('dir', 'ltr')
  expect(screen.getByText('fixture transcript')).toBeVisible()
})
