import type { ReactNode } from 'react'
import { useI18n } from '../localization/i18n'
import type { InspectionActivity, InspectionSpectrogram, InspectionWaveform, InspectionWordTiming } from '../../generated/contracts'
import type { WordMatch } from '../../domain/audio/word-alignment'

/** Seconds to hundredths, the way every inspection surface prints a duration. */
export function useSeconds() {
  const tr = useI18n()
  return (value: number) => `${tr.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`
}

/** Where the analysis detected audio, on the recording's own time axis.
 *
 * Detected activity is not a guarantee of speech; `DetectionDetails` states the
 * threshold that produced these regions. */
export function ActivityTrack({ activity, duration }: { activity: InspectionActivity; duration: number }) {
  const tr = useI18n()
  const x = (time: number) => Math.max(0, Math.min(1000, time / duration * 1000))
  return <svg className="inspection-activity" viewBox="0 0 1000 24" preserveAspectRatio="none" role="img"
    aria-label={tr("Detected audio activity")}>
    {activity.regions.map((region, index) => (
      <rect key={index} x={x(region.start)} width={Math.max(1, x(region.end) - x(region.start))} height={24} />
    ))}
  </svg>
}

/** The boundaries between detected speech segments, drawn over a plot.
 *
 * A marker sits in the silence between two detected regions. Detection does not
 * establish separate attempts: a pause inside one utterance splits a region
 * just as a second reading of the line does. */
export function SegmentMarkers({ activity, duration, mapTime }: { activity: InspectionActivity; duration: number; mapTime?: (seconds: number) => number }) {
  const tr = useI18n()
  if (activity.regions.length < 2) return null
  return <>{activity.regions.slice(1).map((region, index) => {
    const previous = activity.regions[index]
    const middle = (previous.end + region.start) / 2
    const at = (mapTime ? mapTime(middle) : middle) / duration * 100
    return <span key={index} className="inspection-segment-mark" style={{ left: `${at}%` }}>
      <span>{tr("segment {value0}", { value0: String(index + 2) })}</span>
    </span>
  })}</>
}

/** Where the recognizer placed each word in time, drawn one way everywhere.
 *
 * `overlay` lays the words over a plot (a spectrogram or waveform); `track`
 * lays them in their own row under the plots. Word matching outcomes colour
 * each word's start edge when a comparison supplies them. Seeking always uses
 * source time, even while `mapTime` warps the display. A surface that passes
 * no handlers gets plain labels instead of controls. */
export function TimedWords({ timing, duration, placement, labels = true, mapTime, outcomes, currentTime, selected, onSelect, onSeek }: {
  timing: InspectionWordTiming
  duration: number
  placement: 'overlay' | 'track'
  labels?: boolean
  mapTime?: (seconds: number) => number
  outcomes?: WordMatch[]
  currentTime?: number
  selected?: number | null
  onSelect?: (index: number) => void
  onSeek?: (start: number) => void
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  if (!timing.words.length) return null
  const time = (value: number) => mapTime ? mapTime(value) : value
  const interactive = onSelect !== undefined || onSeek !== undefined
  return <div className="timed-words" data-placement={placement} aria-label={tr('Timed words')}>
    {timing.words.map((word, index) => {
      const outcome = outcomes ? outcomes[index] ?? 'unknown' : undefined
      const title = outcome === undefined ? `${word.word}: ${seconds(word.start)}–${seconds(word.end)}`
        : `${word.word}: ${tr(outcome === 'same' ? 'Matched' : outcome === 'missing' ? 'Not matched' : 'Uncertain')} · ${tr('{value0} s', { value0: tr.number(word.start, { maximumFractionDigits: 2 }) })}`
      const active = currentTime !== undefined && currentTime >= word.start && currentTime < word.end
      const style = {
        left: `${time(word.start) / duration * 100}%`,
        width: `${Math.max(0.2, (time(word.end) - time(word.start)) / duration * 100)}%`,
      }
      return <span key={word.index} className="timed-word" data-outcome={outcome} data-active={active || undefined}
        data-selected={selected === word.index || undefined} style={style} title={title}>
        {interactive
          ? <button type="button" aria-label={outcome === undefined ? undefined : title} aria-pressed={onSelect ? selected === word.index : undefined}
            onFocus={() => onSelect?.(word.index)} onClick={() => { onSelect?.(word.index); onSeek?.(word.start) }}><bdi>{word.word}</bdi></button>
          : labels && <bdi>{word.word}</bdi>}
      </span>
    })}
  </div>
}

/** Tick spacing: the smallest step that keeps the visible axis to about eight labels. */
export function tickStep(span: number): number {
  return [0.25, 0.5, 1, 2, 5, 10].find(step => span / step <= 8) ?? 30
}

/** The time axis under a set of plots. `visibleSpan` is how much of `span` is
 * on screen at once, so a zoomed plot gets finer ticks. */
export function TimeAxis({ span, visibleSpan = span }: { span: number; visibleSpan?: number }) {
  const tr = useI18n()
  const seconds = useSeconds()
  const step = tickStep(visibleSpan)
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => index * step)
  return <div className="time-axis" role="img" aria-label={tr("Shared time axis, 0 to {value0}", { value0: seconds(span) })}>
    {ticks.map(tick => <span key={tick} style={{ left: `${tick / span * 100}%` }}><bdi>{seconds(tick)}</bdi></span>)}
  </div>
}

/** A recording's stored amplitude envelope: one vertical stroke per analysis bin. */
export function StoredWaveform({ waveform, duration }: { waveform: InspectionWaveform; duration: number }) {
  const tr = useI18n()
  const x = (time: number) => Math.max(0, Math.min(1000, time / duration * 1000))
  const clamp = (value: number) => Math.max(-1, Math.min(1, value))
  const path = waveform.min.map((low, index) => {
    const high = waveform.max[index]
    if (high === undefined) throw new Error(`Waveform bin ${index} has a minimum but no maximum.`)
    return `M${x((index + 0.5) * waveform.binSeconds)},${40 - clamp(high) * 36}V${40 - clamp(low) * 36}`
  }).join(' ')
  return <svg className="inspection-wave" viewBox="0 0 1000 80" preserveAspectRatio="none" role="img" aria-label={tr("Recorded audio amplitude")}>
    <path d={path} vectorEffect="non-scaling-stroke" />
  </svg>
}

/** Why there are no word timings, in the recognizer's own words when it gave a
 * reason. A surface shows this instead of a track, never a fabricated one. */
export function WordTimingNote({ wordTiming }: { wordTiming: InspectionWordTiming }) {
  const tr = useI18n()
  if (wordTiming.status !== 'unavailable') return null
  return <p role="status">{tr("Word timings unavailable")}{wordTiming.reason ? `: ${wordTiming.reason}` : '.'}</p>
}

/** How the recording was analysed: the thresholds, windows and scales behind
 * every picture above it. `children` carries whatever the surface must add
 * about how long its audio is kept. */
export function DetectionDetails({ activity, spectrogram, children }: {
  activity: InspectionActivity
  spectrogram: InspectionSpectrogram
  children?: ReactNode
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  const dbfs = (value: number) => tr.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return <details>
    <summary>{tr("Detection details")}</summary>
    <p>{tr("Gaps between sampled spectral windows are unsampled intervals, not detected silence. Detected audio activity is not a guarantee of speech. This inspection describes the recording, not later text edits.")}</p>
    <dl>
      <dt>{tr("Algorithm")}</dt><dd>{activity.algorithm}</dd>
      <dt>{tr("Noise floor")}</dt><dd>{dbfs(activity.noiseFloorDbfs)}{tr(" dBFS")}</dd>
      <dt>{tr("Activity threshold")}</dt><dd>{dbfs(activity.thresholdDbfs)}{tr(" dBFS")}</dd>
      <dt>{tr("Sampled spectral windows")}</dt>
      <dd>{seconds(spectrogram.windowSeconds)}{tr(" window · ")}{seconds(spectrogram.frameSeconds)}{tr(" hop")}</dd>
      <dt>{tr("Frequency bands")}</dt>
      <dd>{spectrogram.bands.length}{tr(" mel bands · ")}{Math.round(spectrogram.minFrequencyHz)}–{Math.round(spectrogram.maxFrequencyHz)}{tr(" Hz")}
        {spectrogram.measuredMaxFrequencyHz < spectrogram.maxFrequencyHz
          && tr(" · measured to {value0} Hz at this sample rate", { value0: String(Math.round(spectrogram.measuredMaxFrequencyHz)) })}</dd>
      <dt>{tr("Mel scale")}</dt><dd>{spectrogram.melScale}</dd>
      <dt>{tr("Filter normalization")}</dt><dd>{spectrogram.normalization}</dd>
      <dt>{tr("Decibel reference")}</dt><dd>{spectrogram.dbReference}</dd>
    </dl>
    {activity.limitations.map(item => <p key={item}>{item}</p>)}
    {children}
  </details>
}
