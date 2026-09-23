import type { ReactNode } from 'react'
import { useI18n } from '../localization/i18n'
import type { InspectionActivity, InspectionSpectrogram, InspectionWordTiming } from '../../generated/contracts'

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
export function SegmentMarkers({ activity, duration }: { activity: InspectionActivity; duration: number }) {
  const tr = useI18n()
  if (activity.regions.length < 2) return null
  return <>{activity.regions.slice(1).map((region, index) => {
    const previous = activity.regions[index]
    const at = (previous.end + region.start) / 2 / duration * 100
    return <span key={index} className="inspection-segment-mark" style={{ left: `${at}%` }}>
      <span>{tr("segment {value0}", { value0: String(index + 2) })}</span>
    </span>
  })}</>
}

/** Every word the recognizer placed in time, as a track under the plots.
 *
 * Chat lets the learner select and seek by word; a read-only surface passes no
 * handlers and gets plain labels instead of controls. */
export function TimedWordTrack({ wordTiming, duration, currentTime, selected, onSelect, onSeek }: {
  wordTiming: InspectionWordTiming
  duration: number
  currentTime?: number
  selected?: number | null
  onSelect?: (index: number) => void
  onSeek?: (start: number) => void
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  const interactive = onSelect !== undefined || onSeek !== undefined
  const place = (word: { start: number; end: number }) => ({
    left: `${word.start / duration * 100}%`,
    width: `${Math.max(0.2, (word.end - word.start) / duration * 100)}%`,
  })
  return <div className="inspection-token-track" aria-label={tr("Timed words")}>
    {wordTiming.words.map(word => interactive
      ? <button key={word.index} aria-pressed={selected === word.index}
        className={currentTime !== undefined && currentTime >= word.start && currentTime < word.end ? 'inspection-token-active' : undefined}
        style={place(word)} title={`${word.word}: ${seconds(word.start)}–${seconds(word.end)}`}
        onFocus={() => onSelect?.(word.index)} onClick={() => { onSelect?.(word.index); onSeek?.(word.start) }}>
        <bdi>{word.word}</bdi>
      </button>
      : <span key={word.index} className="inspection-token-label" style={place(word)}
        title={`${word.word}: ${seconds(word.start)}–${seconds(word.end)}`}><bdi>{word.word}</bdi></span>)}
  </div>
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
