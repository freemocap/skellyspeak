import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../localization/i18n'
import { cssToken } from '../../platform/appearance/css-token'
import type { InspectionSpectrogram } from '../../generated/contracts'

/** The dB window a spectrogram is painted with. Two recordings shown side by
 * side must share one, or their brightness cannot be compared. */
export interface SpectrogramScale { dbMin: number; dbMax: number }

/** The shared scale for a set of recordings: the widest window any of them
 * declares, so the same colour means the same level in every panel. */
export function sharedScale(sources: InspectionSpectrogram[]): SpectrogramScale {
  if (!sources.length) throw new Error('A spectrogram scale needs at least one analysis.')
  return {
    dbMin: Math.min(...sources.map(source => source.dbMin)),
    dbMax: Math.max(...sources.map(source => source.dbMax)),
  }
}

/** Mel-band rows painted on a time axis: one canvas, wherever a recording is
 * shown. `scale` overrides the analysis's own dB window for paired views. */
export function Spectrogram({ data, duration, zoom, scale, startSeconds = 0, mapTime }: {
  data: InspectionSpectrogram
  duration: number
  zoom: number
  scale?: SpectrogramScale
  mapTime?: (seconds: number) => number
  startSeconds?: number
}) {
  const tr = useI18n()
  const [unavailable, setUnavailable] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const { dbMin, dbMax } = scale ?? data
  useEffect(() => {
    const paint = () => {
      const element = canvas.current
      if (!element || !data.bins.length || !data.bins[0].length) return
      const context = element.getContext('2d')
      if (!context) { setUnavailable(true); return }
      element.width = Math.ceil(Math.max(1000, data.bins.length) * zoom); element.height = data.bins[0].length
      const channels = (token: `--${string}`) => {
        context.fillStyle = cssToken(token); context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const stops = (['--spectrogram-low', '--spectrogram-mid', '--spectrogram-high'] as const).map(channels)
      // A band this recording could not carry reads as its own colour: absent
      // data, never a convincing stretch of quiet.
      const absent = channels('--spectrogram-unavailable')
      const pixels = context.createImageData(element.width, element.height)
      data.bins.forEach((frame, index) => {
        const start = data.frameStartSeconds[index]
        const end = start + data.windowSeconds
        const left = ((mapTime ? mapTime(start) : start) - startSeconds) / duration * element.width
        const right = ((mapTime ? mapTime(end) : Math.min(end, startSeconds + duration)) - startSeconds) / duration * element.width
        const width = right - left
        frame.forEach((db, band) => {
          let color = absent
          if (db !== null) {
            const level = Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin))) * 2
            const lower = Math.min(1, Math.floor(level)); const mix = level - lower
            color = stops[lower].map((value, channel) => Math.round(value * (1 - mix) + stops[lower + 1][channel] * mix))
          }
          for (let pixel = Math.max(0, Math.floor(left)); pixel < Math.min(element.width, Math.ceil(left + width)); pixel++) {
            const offset = ((element.height - 1 - band) * element.width + pixel) * 4
            color.forEach((value, channel) => { pixels.data[offset + channel] = value })
            pixels.data[offset + 3] = 255
          }
        })
      })
      context.putImageData(pixels, 0, 0)
    }
    paint()
    const observer = new MutationObserver(paint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [data, duration, zoom, dbMin, dbMax, startSeconds, mapTime])
  return <>{unavailable && <p role="status">{tr("Spectrogram rendering unavailable.")}</p>}
    <canvas ref={canvas} className="inspection-spectrogram" role="img"
      aria-label={data.measuredMaxFrequencyHz < data.maxFrequencyHz
        ? tr("Spectrogram, {value0} to {value1} Hz on a mel scale, measured to {value2} Hz, {value3} to {value4} dB", {
            value0: Math.round(data.minFrequencyHz), value1: Math.round(data.maxFrequencyHz),
            value2: Math.round(data.measuredMaxFrequencyHz), value3: dbMin, value4: dbMax,
          })
        : tr("Spectrogram, {value0} to {value1} Hz on a mel scale, {value2} to {value3} dB", {
            value0: Math.round(data.minFrequencyHz), value1: Math.round(data.maxFrequencyHz), value2: dbMin, value3: dbMax,
          })} /></>
}

/** Frequency ticks for a mel axis, low to high. The labels are the band centres
 * the analysis reported, so the axis cannot drift from the picture. */
export function melAxisTicks(data: InspectionSpectrogram, count = 5): number[] {
  const bands = data.bands
  if (!bands.length || count < 2) return []
  return [...new Set(Array.from({ length: count }, (_, tick) =>
    Math.round(bands[Math.min(bands.length - 1, Math.round(tick * (bands.length - 1) / (count - 1)))].centerHz)))]
}

/** The frequency axis for a spectrogram, drawn over its trailing edge: highest
 * band at the top, matching the canvas rows. Paired panels pass the same
 * analysis parameters, so their labels line up. */
export function SpectrogramFrequencyScale({ data, count }: { data: InspectionSpectrogram; count?: number }) {
  const tr = useI18n()
  return <div className="inspection-frequency-scale" aria-hidden="true">
    {melAxisTicks(data, count).reverse().map(hz => <span key={hz}>{hz}{tr(" Hz")}</span>)}
  </div>
}
