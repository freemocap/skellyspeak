// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../localization/i18n'
import { LiveSpectrogram, Spectrogram, SpectrogramFrequencyScale, melAxisTicks, sharedScale } from './Spectrogram'
import { createSpectrumFeed } from '../../domain/audio/spectrum-feed'
import type { InspectionSpectrogram } from '../../generated/contracts'
import * as appearance from '../../platform/appearance/css-token'

const analysis = (overrides: Partial<InspectionSpectrogram> = {}): InspectionSpectrogram => ({
  frameSeconds: 0.016, frameStartSeconds: [0, 0.016], windowSeconds: 0.032, fftSize: 512,
  bands: [
    { lowHz: 50, centerHz: 100, highHz: 200 },
    { lowHz: 100, centerHz: 400, highHz: 900 },
    { lowHz: 400, centerHz: 1600, highHz: 3000 },
    { lowHz: 1600, centerHz: 4000, highHz: 8000 },
  ],
  minFrequencyHz: 50, maxFrequencyHz: 8000, measuredMaxFrequencyHz: 8000, melScale: 'htk', normalization: 'unit-peak triangular filters',
  dbReference: '0 dB = full-scale power (1.0)', dbMin: -100, dbMax: 0,
  bins: [[-90, -40, -60, -80], [-95, -30, -55, -85]],
  ...overrides,
})
const app = (children: React.ReactNode) => render(<I18nProvider locale="english">{children}</I18nProvider>)

it('paints sampled windows at mapped word times without filling unsampled gaps', () => {
  const token = vi.spyOn(appearance, 'cssToken').mockReturnValue('rgb(80, 90, 100)')
  const putImageData = vi.fn()
  const context = {
    fillStyle: '', fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([80, 90, 100, 255]) }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData,
  }
  const mock = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  try {
    app(<Spectrogram data={analysis({ frameStartSeconds: [0.5], windowSeconds: 0.5, bins: [[-40]] })}
      duration={2} zoom={1} mapTime={seconds => seconds * 2} />)
    const pixels = putImageData.mock.calls[0][0].data as Uint8ClampedArray
    expect(pixels[499 * 4 + 3]).toBe(0)
    expect(pixels[500 * 4 + 3]).toBe(255)
    expect(pixels[999 * 4 + 3]).toBe(255)
  } finally { mock.mockRestore(); token.mockRestore() }
})

it('shares one dB window across recordings so brightness means the same thing', () => {
  const scale = sharedScale([analysis(), analysis({ dbMin: -120, dbMax: 6 })])
  expect(scale).toEqual({ dbMin: -120, dbMax: 6 })
  expect(() => sharedScale([])).toThrow('at least one analysis')
})

it('labels the axis with the band centres the analysis reported', () => {
  const data = analysis()
  expect(melAxisTicks(data, 4)).toEqual([100, 400, 1600, 4000])
  // Fewer ticks than bands still starts at the lowest and ends at the highest.
  expect(melAxisTicks(data, 2)).toEqual([100, 4000])
  expect(melAxisTicks(analysis({ bands: [] }))).toEqual([])
  expect(melAxisTicks(analysis({ bands: [data.bands[0]] }))).toEqual([100])
  expect(melAxisTicks(data, 8)).toEqual([100, 400, 1600, 4000])
  app(<SpectrogramFrequencyScale data={data} count={2} />)
  // Highest band first: the labels read top to bottom like the canvas rows.
  expect(screen.getAllByText(/Hz/).map(node => node.textContent)).toEqual(['4000 Hz', '100 Hz'])
})

it('describes its own axes and reports when it cannot paint', () => {
  // jsdom has no 2D canvas context, which is the unavailable path.
  app(<Spectrogram data={analysis()} duration={0.05} zoom={1} scale={{ dbMin: -80, dbMax: -10 }} />)
  expect(screen.getByRole('status')).toHaveTextContent('Spectrogram rendering unavailable.')
  // The label states the shared scale it was given, not the analysis defaults.
  expect(screen.getByRole('img')).toHaveAccessibleName('Spectrogram, 50 to 8,000 Hz on a mel scale, -80 to -10 dB')
})

it('says when a recording could not measure the whole grid', () => {
  // An 8 kHz capture carries nothing above 4 kHz: those bands are null, and the
  // label says so instead of implying the learner was silent up there.
  const limited = analysis({ measuredMaxFrequencyHz: 4000, bins: [[-90, -40, null, null], [-95, -30, null, null]] })
  app(<Spectrogram data={limited} duration={0.05} zoom={1} />)
  expect(screen.getByRole('img')).toHaveAccessibleName(
    'Spectrogram, 50 to 8,000 Hz on a mel scale, measured to 4,000 Hz, -100 to 0 dB')
  // The grid itself is unchanged, so the axis still lines up with the other panel.
  expect(melAxisTicks(limited, 4)).toEqual(melAxisTicks(analysis(), 4))
})

it('keeps the latest overlapping frame and leaves true gaps transparent', () => {
  const token = vi.spyOn(appearance, 'cssToken').mockImplementation(value => value)
  const putImageData = vi.fn()
  const context = {
    fillStyle: '', fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([
      context.fillStyle === '--spectrogram-high' ? 255 : context.fillStyle === '--spectrogram-mid' ? 128 : 0, 0, 0, 255,
    ]) }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData,
  }
  const mock = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  try {
    app(<Spectrogram data={analysis({ frameStartSeconds: [0, 0.25, 0.9], windowSeconds: 0.5, bins: [[0], [-100], [0]] })} duration={1} zoom={1} />)
    const pixels = putImageData.mock.calls[0][0].data as Uint8ClampedArray
    expect(pixels[249 * 4]).toBe(255)
    expect(pixels[250 * 4]).toBe(0)
    expect(pixels[749 * 4 + 3]).toBe(255)
    expect(pixels[750 * 4 + 3]).toBe(0)
    expect(pixels[900 * 4]).toBe(255)
  } finally { mock.mockRestore(); token.mockRestore() }
})

it('paints each live frame from the feed without a React render per frame', () => {
  const token = vi.spyOn(appearance, 'cssToken').mockReturnValue('rgb(80, 90, 100)')
  const putImageData = vi.fn()
  const context = {
    fillStyle: '', fillRect: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([80, 90, 100, 255]) }),
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
    putImageData,
  }
  const mock = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  try {
    const feed = createSpectrumFeed()
    const renders = vi.fn()
    app(<Profiler id="live" onRender={renders}><LiveSpectrogram feed={feed} seconds={1} /></Profiler>)
    act(() => feed.set({ endSeconds: 1, data: analysis() }))
    const settled = renders.mock.calls.length
    // Later frames repaint the canvas and reuse its pixel buffer; React is not involved.
    act(() => feed.set({ endSeconds: 1.1, data: analysis({ frameStartSeconds: [0.05, 0.066] }) }))
    act(() => feed.set({ endSeconds: 1.2, data: analysis({ frameStartSeconds: [0.1, 0.116] }) }))
    expect(putImageData).toHaveBeenCalledTimes(3)
    expect(renders).toHaveBeenCalledTimes(settled)
    expect(putImageData.mock.calls[2][0]).toBe(putImageData.mock.calls[1][0])
    expect(screen.getByRole('img')).toHaveAccessibleName('Spectrogram, 50 to 8,000 Hz on a mel scale, -100 to 0 dB')
  } finally { mock.mockRestore(); token.mockRestore() }
})
