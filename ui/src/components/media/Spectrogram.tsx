import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../localization/i18n'
import { cssToken } from '../../platform/appearance/css-token'
import type { InspectionSpectrogram } from '../../generated/contracts'
import type { SpectrumFeed } from '../../domain/audio/spectrum-feed'

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

interface PaintOptions {
  duration: number
  zoom: number
  dbMin: number
  dbMax: number
  startSeconds?: number
  mapTime?: (seconds: number) => number
}

/** The palette for the current token colours, converted to channels once per
 * set of colours rather than read back from the painted canvas on every paint. */
const TOKENS = ['--spectrogram-low', '--spectrogram-mid', '--spectrogram-high', '--spectrogram-unavailable'] as const
const colourCache = new Map<string, { palette: number[][]; absent: number[] }>()
function spectrogramColours() {
  const values = TOKENS.map(token => cssToken(token))
  const key = values.join('|')
  const cached = colourCache.get(key)
  if (cached) return cached
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const context = probe.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const channels = (colour: string) => {
    context.fillStyle = colour; context.fillRect(0, 0, 1, 1)
    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }
  const stops = values.slice(0, 3).map(channels)
  const palette = Array.from({ length: 256 }, (_, index) => {
    const level = index / 255 * 2
    const lower = Math.min(1, Math.floor(level)), mix = level - lower
    return stops[lower].map((value, channel) => Math.round(value * (1 - mix) + stops[lower + 1][channel] * mix))
  })
  // A band this recording could not carry reads as its own colour: absent
  // data, never a convincing stretch of quiet.
  const colours = { palette, absent: channels(values[3]) }
  colourCache.set(key, colours)
  return colours
}

/** The pixel buffer each canvas reuses while its size holds, so a live stream
 * does not allocate a new image for every frame. */
const buffers = new WeakMap<HTMLCanvasElement, ImageData>()

/** Paint mel-band rows onto a time axis. Returns false when the canvas has no
 * 2D context. The canvas is resized only when the analysis changes its shape. */
function paintSpectrogram(element: HTMLCanvasElement, data: InspectionSpectrogram, { duration, zoom, dbMin, dbMax, startSeconds = 0, mapTime }: PaintOptions): boolean {
  if (!data.bins.length || !data.bins[0].length) return true
  const context = element.getContext('2d')
  const colours = context && spectrogramColours()
  if (!context || !colours) return false
  const width = Math.ceil(Math.max(1000, data.bins.length) * zoom), height = data.bins[0].length
  if (element.width !== width) element.width = width
  if (element.height !== height) element.height = height
  let pixels = buffers.get(element)
  if (!pixels || pixels.width !== width || pixels.height !== height) {
    pixels = context.createImageData(width, height)
    buffers.set(element, pixels)
  } else pixels.data.fill(0)
  const { palette, absent } = colours
  data.bins.forEach((frame, index) => {
    const start = data.frameStartSeconds[index]
    const end = start + data.windowSeconds
    const left = ((mapTime ? mapTime(start) : start) - startSeconds) / duration * width
    const right = ((mapTime ? mapTime(end) : end) - startSeconds) / duration * width
    // Later frames replace overlapping FFT windows. Paint each time column
    // once, stopping where the next frame would overwrite this one.
    const next = data.frameStartSeconds[index + 1]
    const nextLeft = next === undefined ? Infinity
      : Math.floor(((mapTime ? mapTime(next) : next) - startSeconds) / duration * width)
    const first = Math.max(0, Math.floor(left))
    const last = Math.min(width, Math.ceil(right), nextLeft)
    if (first >= last) return
    frame.forEach((db, band) => {
      const color = db === null ? absent : palette[Math.round(Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin))) * 255)]
      let offset = ((height - 1 - band) * width + first) * 4
      for (let pixel = first; pixel < last; pixel++, offset += 4) {
        pixels.data[offset] = color[0]
        pixels.data[offset + 1] = color[1]
        pixels.data[offset + 2] = color[2]
        pixels.data[offset + 3] = 255
      }
    })
  })
  context.putImageData(pixels, 0, 0)
  return true
}

/** Repaint when the theme changes the spectrogram tokens. */
function watchTheme(paint: () => void): () => void {
  const observer = new MutationObserver(paint)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] })
  return () => observer.disconnect()
}

function spectrogramLabel(tr: ReturnType<typeof useI18n>, data: InspectionSpectrogram, dbMin: number, dbMax: number) {
  return data.measuredMaxFrequencyHz < data.maxFrequencyHz
    ? tr("Spectrogram, {value0} to {value1} Hz on a mel scale, measured to {value2} Hz, {value3} to {value4} dB", {
        value0: Math.round(data.minFrequencyHz), value1: Math.round(data.maxFrequencyHz),
        value2: Math.round(data.measuredMaxFrequencyHz), value3: dbMin, value4: dbMax,
      })
    : tr("Spectrogram, {value0} to {value1} Hz on a mel scale, {value2} to {value3} dB", {
        value0: Math.round(data.minFrequencyHz), value1: Math.round(data.maxFrequencyHz), value2: dbMin, value3: dbMax,
      })
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
      if (element && !paintSpectrogram(element, data, { duration, zoom, dbMin, dbMax, startSeconds, mapTime })) setUnavailable(true)
    }
    paint()
    return watchTheme(paint)
  }, [data, duration, zoom, dbMin, dbMax, startSeconds, mapTime])
  return <>{unavailable && <p role="status">{tr("Spectrogram rendering unavailable.")}</p>}
    <canvas ref={canvas} className="inspection-spectrogram" role="img" aria-label={spectrogramLabel(tr, data, dbMin, dbMax)} /></>
}

/** The live spectrogram, painted straight from the recorder's feed over the
 * last `seconds`. Each update repaints the canvas without a React render: at
 * twenty updates a second, passing the frames through props re-rendered the
 * tree, and React's development build stored a diff of every changed frame. */
export function LiveSpectrogram({ feed, seconds }: { feed: SpectrumFeed; seconds: number }) {
  const tr = useI18n()
  const [unavailable, setUnavailable] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  // The label names the analysis, which is fixed for a recording; it changes rarely.
  const label = useSyncExternalStore(feed.subscribe, () => {
    const data = feed.get()?.data
    return data ? spectrogramLabel(tr, data, data.dbMin, data.dbMax) : ''
  })
  useEffect(() => {
    const paint = () => {
      const element = canvas.current, value = feed.get()
      if (element && value && !paintSpectrogram(element, value.data, {
        duration: seconds, zoom: 1, dbMin: value.data.dbMin, dbMax: value.data.dbMax, startSeconds: value.endSeconds - seconds,
      })) setUnavailable(true)
    }
    paint()
    const unsubscribe = feed.subscribe(paint)
    const unwatch = watchTheme(paint)
    return () => { unsubscribe(); unwatch() }
  }, [feed, seconds])
  return <>{unavailable && <p role="status">{tr("Spectrogram rendering unavailable.")}</p>}
    <canvas ref={canvas} className="inspection-spectrogram" role="img" aria-label={label} /></>
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
  return <FrequencyTicks ticks={melAxisTicks(data, count)} />
}

/** The live stream's frequency axis. Its bands are fixed for a recording, so it
 * renders when they change, not with every frame. */
export function LiveFrequencyScale({ feed, count }: { feed: SpectrumFeed; count?: number }) {
  const ticks = useSyncExternalStore(feed.subscribe, () => {
    const data = feed.get()?.data
    return data ? melAxisTicks(data, count).join(',') : ''
  })
  return <FrequencyTicks ticks={ticks ? ticks.split(',').map(Number) : []} />
}

function FrequencyTicks({ ticks }: { ticks: number[] }) {
  const tr = useI18n()
  return <div className="inspection-frequency-scale" aria-hidden="true">
    {[...ticks].reverse().map(hz => <span key={hz}>{hz}{tr(" Hz")}</span>)}
  </div>
}
