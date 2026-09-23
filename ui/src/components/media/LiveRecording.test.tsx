// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LiveRecording } from './LiveRecording'
import { I18nProvider } from '../localization/i18n'
import type { ListeningTake, LiveSpectrogram } from '../../generated/contracts'
import fixture from '../../../tools/spectrogram-fixture.json'
vi.mock('./WaveformStrip', () => ({ WaveformStrip: () => null }))
vi.mock('./Spectrogram', () => ({ Spectrogram: () => null, SpectrogramFrequencyScale: () => null }))
it('positions only real retained clips on the native recording clock, clipping old history', () => {
  const take: ListeningTake = { recordingId: 'r1', number: 1, startSeconds: 13, endSeconds: 16, cutSeconds: 17, state: 'processing', failure: null }
  const spectrum = { endSeconds: 20, data: fixture[0].spectrogram } as LiveSpectrogram
  render(<I18nProvider locale="english"><LiveRecording active={false} source={null} spectrum={spectrum} takes={[{ ...take, recordingId: 'old', number: 0, startSeconds: 0, endSeconds: 1 }, take]} /></I18nProvider>)
  expect(screen.queryByText('Take 0')).not.toBeInTheDocument()
  const region = screen.getByText('Take 1').parentElement!
  expect(parseFloat(region.style.left)).toBeCloseTo(100 * 5 / 12)
  expect(parseFloat(region.style.width)).toBeCloseTo(25)
  expect(screen.getByText('Take 1 clipped →')).toBeInTheDocument()
  expect(screen.getByText('Recording timeline')).toBeInTheDocument()
})
