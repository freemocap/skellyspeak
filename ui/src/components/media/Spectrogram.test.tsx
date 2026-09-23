// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../localization/i18n'
import { Spectrogram, SpectrogramFrequencyScale, melAxisTicks, sharedScale } from './Spectrogram'
import type { InspectionSpectrogram } from '../../generated/contracts'

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
