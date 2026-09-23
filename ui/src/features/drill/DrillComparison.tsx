import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { ResizeHandle, useStoredSize } from '../../components/layout/ResizeHandle'
import { Spectrogram, SpectrogramFrequencyScale, sharedScale } from '../../components/media/Spectrogram'
import { DetectionDetails, SegmentMarkers, TimedWordTrack, WordTimingNote, useSeconds } from '../../components/media/InspectionTracks'
import type { AudioInspection } from '../../generated/contracts'

/** Which way time runs across the spectrograms. Right-to-left puts the first
 * sound on the right, where a right-to-left script puts its first word. */
export type TimeDirection = 'ltr' | 'rtl'

/** `fit` stretches each recording across the width; `shared` puts both on one
 * time axis, so their lengths can be compared directly. */
export type TimeScale = 'fit' | 'shared'

/** Tick spacing: the smallest step that keeps the axis to about eight labels. */
function tickStep(span: number) {
  return [0.25, 0.5, 1, 2, 5, 10].find(step => span / step <= 8) ?? 30
}

/** The phrase and how it should sound, above the selected take: one surface,
 * one time scale choice and one colour scale, so length, rhythm and loudness
 * can be read against each other. Each recording has its own play control
 * beside its own timeline, the way a media player does. */
export function DrillComparison({ target, reference, referenceTime, onSeekReference, onPlayReference, playingReference, referenceNote,
  attempt, attemptLabel, attemptFailure, onRetryAttempt, attemptUnavailable, direction, onDirection, timeScale, onTimeScale,
  holding, playingAttempt, onPlayAttempt }: {
  /** The phrase itself, in its reading bubble. */
  target: ReactNode
  reference: AudioInspection | null
  referenceTime: number
  onSeekReference: (seconds: number) => void
  onPlayReference: () => void
  playingReference: boolean
  /** Why reference playback is the way it is, shown as the play control's tooltip. */
  referenceNote: string
  attempt: AudioInspection | null
  /** The selected take's name, or null when there is no take yet. */
  attemptLabel: string | null
  attemptFailure: unknown
  onRetryAttempt: () => void
  /** Why the selected take has no audio to show, when it has none. */
  attemptUnavailable: string | null
  direction: TimeDirection
  onDirection: (direction: TimeDirection) => void
  timeScale: TimeScale
  onTimeScale: (scale: TimeScale) => void
  holding: boolean
  playingAttempt: boolean
  onPlayAttempt: () => void
}) {
  const tr = useI18n()
  const mobile = useIsMobile()
  const [showTiming, setShowTiming] = useState(false)
  const seconds = useSeconds()
  const shown = [reference, attempt].filter(entry => entry !== null)
  const scale = shown.length ? sharedScale(shown.map(entry => entry.spectrogram)) : null
  const span = Math.max(...shown.map(entry => entry.duration), 0.001)
  const step = tickStep(span)
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => index * step)
  // Both spectrograms share one height, set by the divider under the reference.
  const [plotHeight, setPlotHeight] = useStoredSize('drill-plot')
  const referencePlot = useRef<HTMLDivElement>(null)
  const measurePlot = () => {
    if (!referencePlot.current) throw new Error('The reference spectrogram is not on the page.')
    return referencePlot.current.getBoundingClientRect().height
  }
  const width = (duration: number) => `${timeScale === 'shared' ? duration / span * 100 : 100}%`

  const controls = <>
    {mobile && <label><input type="checkbox" checked={showTiming} onChange={event => setShowTiming(event.target.checked)} />{tr("Word timing overlays")}</label>}
        <div className="drill-segmented" role="radiogroup" aria-label={tr("Time scale")}>
          {(['fit', 'shared'] as const).map(option => (
            <button key={option} type="button" role="radio" aria-checked={timeScale === option} onClick={() => onTimeScale(option)}
              title={option === 'fit' ? tr("Each recording fills the width") : tr("One time scale and one colour scale for both")}>
              {option === 'fit' ? tr("Fit") : tr("Same scale")}
            </button>
          ))}
        </div>
        <div className="drill-segmented" role="radiogroup" aria-label={tr("Time direction")}>
          {(['ltr', 'rtl'] as const).map(option => (
            <button key={option} type="button" role="radio" aria-checked={direction === option} onClick={() => onDirection(option)}
              title={option === 'ltr' ? tr("Time runs left to right") : tr("Time runs right to left")}>
              {option === 'ltr' ? tr("Time →") : tr("← Time")}
            </button>
          ))}
        </div>
  </>

  return (
    <section className="drill-comparison-panel" aria-label={tr("Reference and your take")}>
      <div className="drill-reference">
      <div className="drill-target-card">{target}</div>

      <div className="drill-media">
        <button type="button" className="btn drill-play" disabled={playingReference || holding} onClick={onPlayReference} title={referenceNote}>
          <ToolbarIcon name="play" size={14} />{tr(playingReference ? "Playing…" : "Hear it")}
        </button>
        {reference
          ? <input className="drill-seek" type="range" dir={direction} aria-label={tr('Seek reference audio')} min={0} max={reference.duration} step={0.01}
            value={Math.min(referenceTime, reference.duration)} disabled={holding} onChange={event => onSeekReference(Number(event.target.value))} />
          : <span className="drill-media-empty">{tr("Hear it once to draw the reference here.")}</span>}
        <span className="drill-media-time">{reference
          ? tr("Reference · {value0}", { value0: `${seconds(Math.min(referenceTime, reference.duration))} / ${seconds(reference.duration)}` })
          : tr("Reference")}</span>
        {mobile ? <details className="drill-media-options"><summary aria-label={tr('Comparison settings')}>⋯</summary><div>{controls}</div></details> : controls}
      </div>

      <div className="drill-timelines" data-time={direction}
        style={{ '--drill-plot-height': plotHeight === null ? undefined : `${Math.round(plotHeight)}px` } as CSSProperties}>
        {reference && scale && <div className="drill-track">
          <div className="inspection-plot" ref={referencePlot} style={{ width: width(reference.duration) }}>
            <Spectrogram data={reference.spectrogram} duration={reference.duration} zoom={1} scale={scale} />
            <SpectrogramFrequencyScale data={reference.spectrogram} count={3} />
            <span className="audio-spectrum-cursor" style={{ left: `${Math.max(0, Math.min(1, referenceTime / reference.duration)) * 100}%` }} aria-hidden="true" />
          </div>
          {(!mobile || showTiming) && reference.wordTiming.words.length > 0 && <div style={{ width: width(reference.duration) }}>
            <TimedWordTrack wordTiming={reference.wordTiming} duration={reference.duration} currentTime={referenceTime} onSeek={holding ? undefined : onSeekReference} />
          </div>}
        </div>}
        {reference && <ResizeHandle label={tr("Resize the spectrograms")} axis="y" grow={1} size={plotHeight} min={40} max={640}
          measure={measurePlot} onResize={setPlotHeight} />}

      </div>
      </div>
      <div className="drill-timelines" data-time={direction}
        style={{ '--drill-plot-height': plotHeight === null ? undefined : `${Math.round(plotHeight)}px` } as CSSProperties}>
        {attemptLabel && <>
          <div className="drill-media drill-media-take">
            <button type="button" className="btn drill-play" disabled={!attempt || playingAttempt || holding} onClick={onPlayAttempt}>
              <ToolbarIcon name="play" size={14} />{tr(playingAttempt ? "Playing…" : "Play yours")}
            </button>
            <span className="drill-media-time">{attempt ? `${tr("You")} · ${attemptLabel} · ${seconds(attempt.duration)}${attempt.activity.regions.length > 1
              ? tr(" · {value0} speech segments", { value0: String(attempt.activity.regions.length) }) : ''}` : `${tr("You")} · ${attemptLabel}`}</span>
          </div>
          {attempt && scale
            ? <div className="drill-track">
              <div className="inspection-plot" style={{ width: width(attempt.duration) }}>
                <Spectrogram data={attempt.spectrogram} duration={attempt.duration} zoom={1} scale={scale} />
                <SpectrogramFrequencyScale data={attempt.spectrogram} count={3} />
                <SegmentMarkers activity={attempt.activity} duration={attempt.duration} />
              </div>
              {(!mobile || showTiming) && attempt.wordTiming.words.length > 0 && <div style={{ width: width(attempt.duration) }}>
                <TimedWordTrack wordTiming={attempt.wordTiming} duration={attempt.duration} />
              </div>}
            </div>
            : <p className="drill-timeline-empty">{attemptUnavailable ?? tr("Loading…")}</p>}
        </>}

        {timeScale === 'shared' && shown.length > 0 && <div className="drill-track drill-axis" aria-hidden="true">
          {ticks.map(tick => <span key={tick} style={{ left: `${tick / span * 100}%` }}><bdi>{seconds(tick)}</bdi></span>)}
        </div>}
      </div>

      {attemptFailure != null && <p role="alert">{errorMessage(attemptFailure)}
        <button type="button" className="btn" onClick={onRetryAttempt}>{tr("Try again")}</button></p>}
      {attemptLabel && !reference && <p role="status" className="drill-timeline-empty">{tr("Play the reference to compare it with this attempt.")}</p>}
      {attempt && <div className="drill-comparison-foot">
        {!mobile && <WordTimingNote wordTiming={attempt.wordTiming} />}
        <DetectionDetails activity={attempt.activity} spectrogram={attempt.spectrogram}>
          {mobile && <WordTimingNote wordTiming={attempt.wordTiming} />}
          <p>{tr("This recording is kept until the storage limit removes it.")}</p>
        </DetectionDetails>
      </div>}
    </section>
  )
}
