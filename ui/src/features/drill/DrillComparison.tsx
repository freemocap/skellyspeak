import { PlaybackProgress } from './PlaybackProgress'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { PlaybackCursor } from './PlaybackCursor'
import { useAnimatedAlignment } from './useAnimatedAlignment'
import { useClipArrival } from './useClipArrival'
import type { ClipPreview } from './useClipPreview'
import { WordOverlay } from './WordOverlay'
import { matchTimedWords, wordAlignment } from '../../domain/audio/word-alignment'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useMemo, useState, type ReactNode } from 'react'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { Spectrogram, SpectrogramFrequencyScale, sharedScale } from '../../components/media/Spectrogram'
import { DetectionDetails, useSeconds } from '../../components/media/InspectionTracks'
import type { AudioInspection } from '../../generated/contracts'

/** Which way time runs across the spectrograms. Right-to-left puts the first
 * sound on the right, where a right-to-left script puts its first word. */
export type TimeDirection = 'ltr' | 'rtl'

/** `fit` stretches each recording across the width; `shared` puts both on one
 * time axis, so their lengths can be compared directly. `words` maps the take's
 * word boundaries to the reference for visual comparison only. */
export type TimeScale = 'fit' | 'shared' | 'words'

/** Tick spacing: the smallest step that keeps the axis to about eight labels. */
function tickStep(span: number) {
  return [0.25, 0.5, 1, 2, 5, 10].find(step => span / step <= 8) ?? 30
}

/** The phrase and how it should sound, above the selected take: one surface,
 * one time scale choice and one colour scale, so length, rhythm and loudness
 * can be read against each other. Each recording has its own play control
 * beside its own timeline, the way a media player does. */
export function DrillComparison({ target, reference, referenceTime, onSeekReference, onPlayReference, playingReference, referenceNote, referenceFailure,
  attempt, preview, comparisonAccepted = true, attemptTime = 0, attemptLabel, attemptFailure, onRetryAttempt, attemptUnavailable, direction, onDirection, timeScale, onTimeScale,
  holding, playingAttempt, onPlayAttempt, playbackSpeed, onSeekAttempt, referenceScrub, attemptScrub }: {
  /** The phrase itself, in its reading bubble. */
  target: ReactNode
  playbackSpeed?: ReactNode
  reference: AudioInspection | null
  referenceTime: number
  onSeekReference: (seconds: number) => void
  onPlayReference: () => void
  playingReference: boolean
  /** Why reference playback is the way it is, shown as the play control's tooltip. */
  referenceNote: string
  /** A failed reference request, drawn inside the reference frame. */
  referenceFailure?: ReactNode
  comparisonAccepted?: boolean
  attempt: AudioInspection | null
  preview?: ClipPreview | null
  /** Static previews start at zero; live playback supplies its observed position. */
  attemptTime?: number
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
  referenceScrub?: { start: (seconds: number, timestamp?: number) => void; move: (seconds: number, timestamp?: number) => void; end: () => void }
  attemptScrub?: { start: (seconds: number, timestamp?: number) => void; move: (seconds: number, timestamp?: number) => void; end: () => void }
  onSeekAttempt?: (seconds: number) => void
  onPlayAttempt: () => void
}) {
  const tr = useI18n()
  const mobile = useIsMobile()
  const [controlsOpen, setControlsOpen] = useState(false)
  const [showTiming, setShowTiming] = useState(true)
  const alignment = useMemo(() => comparisonAccepted && reference && attempt
    ? wordAlignment(reference.wordTiming, attempt.wordTiming, reference.duration, attempt.duration) : null,
  [comparisonAccepted, reference, attempt])
  const matches = useMemo(() => comparisonAccepted && reference && attempt
    ? matchTimedWords(reference.wordTiming, attempt.wordTiming, reference.duration, attempt.duration) : null, [comparisonAccepted, reference, attempt])
  const aligned = timeScale === 'words' && alignment !== null
  const effectiveScale = timeScale === 'words' && !aligned ? 'fit' : timeScale
  const rawDuration = attempt?.duration ?? preview?.spectrum.endSeconds ?? 1
  const mapTime = useAnimatedAlignment(aligned ? alignment : null, rawDuration, reference?.duration ?? 1, preview?.recordingId ?? attempt?.recordingId)
  const arrival = useClipArrival(preview?.recordingId)
  const attemptDuration = aligned ? reference!.duration : rawDuration
  const attemptSpectrum = attempt?.spectrogram ?? preview?.spectrum.data
  const seconds = useSeconds()
  const spectra = [reference?.spectrogram, attemptSpectrum].filter(entry => entry !== undefined)
  const scale = spectra.length ? sharedScale(spectra) : null
  const span = Math.max(reference?.duration ?? 0, attemptSpectrum ? rawDuration : 0, 0.001)
  const step = tickStep(span)
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, index) => index * step)
  const width = (duration: number) => `${effectiveScale === 'shared' ? duration / span * 100 : 100}%`
  // Mobile can hide labels while preserving the measured plot.
  const showWords = !mobile || showTiming

  const controls = <>
    {mobile && <label><input type="checkbox" checked={showTiming} onChange={event => setShowTiming(event.target.checked)} />{tr("Word timing overlays")}</label>}
        <div className="drill-timing-controls"><div className="drill-segmented" role="radiogroup" aria-label={tr("Time scale")}>
          {(['fit', 'shared', 'words'] as const).map(option => (
            <button key={option} type="button" role="radio" disabled={option === 'words' && !alignment} aria-checked={effectiveScale === option} onClick={() => onTimeScale(option)}
              title={option === 'words' ? tr("Requires matching word timestamps in both recordings") : option === 'fit' ? tr("Each recording fills the width") : tr("One time scale and one colour scale for both")}>
              {option === 'words' ? tr("Align words") : option === 'fit' ? tr("Fit") : tr("Same scale")}
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
        </div>
  </>

  return (
    <section className="drill-comparison-panel" aria-label={tr("Reference and your take")}>
      <div className="drill-reference">
      <div className="drill-target-card">{target}</div>

      <div className="drill-media" dir={direction}>
        <button type="button" className="btn drill-play" dir={direction} aria-label={tr(playingReference ? (mobile && reference ? "Pause" : "Stop") : "Hear it")} disabled={holding} onClick={onPlayReference} title={referenceNote}>
          <ToolbarIcon name={playingReference ? (mobile && reference ? "pause" : "stop") : "play"} size={14} />{tr("Target")}
        </button>
        {!mobile && playbackSpeed}
        <PlaybackProgress time={referenceTime} duration={reference?.duration ?? 0} displayDuration={effectiveScale === "shared" ? span : reference?.duration ?? 0} direction={direction} label={tr("Seek reference audio")}
          onSeek={holding || !reference ? undefined : onSeekReference} scrub={referenceScrub} />
        {mobile ? <button type="button" className="btn drill-media-options" aria-label={tr('Comparison settings')} aria-haspopup="dialog" aria-expanded={controlsOpen} onClick={() => setControlsOpen(true)}><ToolbarIcon name="settings" size={18} /></button> : controls}
        {controlsOpen && <DetailDialog title={tr("Comparison settings")} capture="preserve" onClose={() => setControlsOpen(false)}>
          <div className="drill-comparison-settings"><h2>{tr("Comparison settings")}</h2>{playbackSpeed}{controls}</div>
        </DetailDialog>}
      </div>

      <div className="drill-timelines" data-time={direction}>
        {reference && scale ? <div className="drill-track">
          <div className="inspection-plot" style={{ width: width(reference.duration) }}>
            <Spectrogram data={reference.spectrogram} duration={reference.duration} zoom={1} scale={scale} />
            <SpectrogramFrequencyScale data={reference.spectrogram} count={3} />
            {showWords && <WordOverlay timing={reference.wordTiming} duration={reference.duration} outcomes={matches?.reference} onSeek={holding ? undefined : onSeekReference} />}
            <PlaybackCursor time={referenceTime} duration={reference.duration} direction={direction} label={tr("Target")} onScrubStart={referenceScrub?.start} onScrub={referenceScrub?.move} onScrubEnd={referenceScrub?.end} onSeek={holding ? undefined : onSeekReference} />
          </div>
        </div> : <div className="drill-track">
          <div className="drill-plot-frame" data-state={referenceFailure ? 'failed' : playingReference ? 'loading' : 'empty'}>
            {referenceFailure ?? <p role="status">{playingReference ? tr("Loading reference…")
              : attemptLabel ? tr("Play the reference to compare it with this attempt.") : tr("Hear it once to draw the reference here.")}</p>}
          </div>
        </div>}

      </div>
      </div>
      <div className="drill-timelines" data-time={direction}>
        <>
          <div className="drill-media drill-media-take" dir={direction}>
            <button type="button" className="btn drill-play" dir={direction} aria-label={tr(playingAttempt ? (mobile ? "Pause" : "Stop") : "Play yours")} disabled={!attempt || holding} onClick={onPlayAttempt}>
              <ToolbarIcon name={playingAttempt ? (mobile ? "pause" : "stop") : "play"} size={14} />{tr("Attempt")}
            </button>
            <PlaybackProgress time={attemptTime} duration={attempt?.duration ?? 0} displayDuration={effectiveScale === "shared" ? span : attemptDuration} mapTime={mapTime} direction={direction}
              label={tr("Seek attempt audio")} onSeek={holding || !attempt ? undefined : onSeekAttempt} scrub={attemptScrub} />
          </div>
          {attemptSpectrum && scale
            ? <div className="drill-track">
              <div className="inspection-plot" data-attempt-spectrum="" ref={arrival} style={{ width: width(attemptDuration) }}>
                <Spectrogram data={attemptSpectrum} duration={attemptDuration} mapTime={mapTime} zoom={1} scale={scale} />
                <SpectrogramFrequencyScale data={attemptSpectrum} count={3} />
                {showWords && attempt && <WordOverlay timing={attempt.wordTiming} duration={attemptDuration} outcomes={matches?.take} mapTime={mapTime} />}
                <PlaybackCursor time={attemptTime} duration={rawDuration} displayDuration={attemptDuration} mapTime={mapTime} direction={direction} label={tr("Attempt")} onScrubStart={attemptScrub?.start} onScrub={attemptScrub?.move} onScrubEnd={attemptScrub?.end} onSeek={holding ? undefined : onSeekAttempt} />
              </div>
            </div>
            : <div className="drill-track">
              <div className="drill-plot-frame" data-state={attemptUnavailable ? 'empty' : 'loading'}><p role="status">{attemptUnavailable ?? tr(attemptLabel ? "Loading…" : "No attempts yet. Record one to compare.")}</p></div>
            </div>}
        </>

        {effectiveScale === 'shared' && spectra.length > 0 && <div className="drill-track drill-axis" aria-hidden="true">
          {ticks.map(tick => <span key={tick} style={{ left: `${tick / span * 100}%` }}><bdi>{seconds(tick)}</bdi></span>)}
        </div>}
      </div>

      {attemptFailure != null && <ErrorNotice as="p" error={attemptFailure}>{errorMessage(attemptFailure)}
        <button type="button" className="btn" onClick={onRetryAttempt}>{tr("Try again")}</button></ErrorNotice>}
      <div className="drill-comparison-foot" dir={direction}>{attempt && <details className="drill-info"><summary aria-label={tr("Detection details")}><span aria-hidden="true">i</span></summary><div dir="auto">
        {matches && <p>{aligned && <>{tr("Word-aligned display; playback uses original timing.")}{' '}</>}{tr("Alignment matching ignores case and punctuation.")}</p>}
        {attempt.activity.regions.length > 1 && <p>{tr(" · {value0} speech segments", { value0: String(attempt.activity.regions.length) })}</p>}
        <DetectionDetails activity={attempt.activity} spectrogram={attempt.spectrogram}>
          <p>{tr("This recording is kept until the storage limit removes it.")}</p>
        </DetectionDetails>
      </div></details>}</div>
    </section>
  )
}
