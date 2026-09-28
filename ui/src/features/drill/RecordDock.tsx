import { useRef, useSyncExternalStore, type ReactNode } from 'react'
import { SegmentedChoice } from '../../components/controls/SegmentedChoice'
import { useI18n } from '../../components/localization/i18n'
import { LiveRecording } from '../../components/media/LiveRecording'
import { VoicePanel } from '../../components/media/VoicePanel'
import type { RecorderLayout } from '../../components/media/useRecorderLayout'
import { CONTINUOUS_RECORDING_POLICY } from '../../generated/contracts'
import type { ListeningSettings, ListeningStatus } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'
import { noSpectrum, type SpectrumFeed } from '../../domain/audio/spectrum-feed'

/** Which of the four things the microphone is doing right now. */
export type DockPhase = 'preparing' | 'ready' | 'recording' | 'working'

/** How an attempt begins and ends: one press each, held down, or cut at each
 * pause. `live` is the continuous listening session, shown as Auto. */
export type RecordMode = 'tap' | 'hold' | 'live'

export function dockPhase({ ready, recording, transcribing }: {
  ready: boolean; recording: boolean; transcribing: boolean
}): DockPhase {
  if (recording) return 'recording'
  if (transcribing) return 'working'
  return ready ? 'ready' : 'preparing'
}

/** The meter's range: quieter than this is drawn as empty. */
const METER_FLOOR_DB = -80
const meterPercent = (db: number) => Math.max(0, Math.min(100, (db - METER_FLOOR_DB) / -METER_FLOOR_DB * 100))

/** Practice's voice panel: the same recorder as Chat, recording attempts.
 *
 * The stream shows the live waveform and spectrogram once the microphone has
 * been on; Auto adds the level meter and Detect attempts to the control row, and
 * each pause cuts an attempt, marked in the stream. The phase is announced to
 * screen readers; its longer explanation is the stream's tooltip. Capture and
 * playback share one authority, so playback waits while this records. */
export function RecordDock({ microphoneSelector, layout, starting = false, phase, mode, onMode, settings, onSettings, listeningStatus, waveSource, spectrum, onToggle, autoDetect = true, onAutoDetect, onHoldStart, onHoldEnd }: {
  microphoneSelector?: ReactNode
  /** The pad's side and the stream's direction, each set in the recording settings. */
  layout?: RecorderLayout
  starting?: boolean
  phase: DockPhase
  mode: RecordMode
  onMode: (mode: RecordMode) => void
  settings: ListeningSettings
  onSettings: (settings: ListeningSettings) => void
  listeningStatus: ListeningStatus | null
  waveSource: WaveSource | null
  /** The live spectrum; the stream subscribes to it, so this panel does not re-render per frame. */
  spectrum: SpectrumFeed | null
  onToggle: () => void
  autoDetect?: boolean
  onAutoDetect?: (enabled: boolean) => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const tr = useI18n()
  const seconds = (ms: number) => tr('{value0} s', { value0: tr.number(ms / 1000, { maximumFractionDigits: 1 }) })
  const decibels = (db: number) => tr('{value0} dB', { value0: tr.number(db, { maximumFractionDigits: 0 }) })
  const live = mode === 'live'
  const auto = live && autoDetect
  const busy = phase === 'working' || phase === 'preparing'

  const copy = {
    preparing: { headline: tr("Preparing the session"), detail: tr("Recording starts once the practice session is open.") },
    ready: {
      tap: { headline: tr("Ready to record"), detail: tr("Tap to start, tap again to stop.") },
      hold: { headline: tr("Hold to talk"), detail: tr("Hold the button, or focus it and hold Space. Letting go ends the attempt.") },
      live: { headline: tr("Ready to listen"), detail: auto ? tr("Say the card, pause, and say it again. Each pause ends an attempt.") : tr("Listening without making attempts.") },
    }[mode],
    recording: {
      tap: { headline: tr("Recording an attempt"), detail: tr("Tap to start, tap again to stop.") },
      hold: { headline: tr("Recording an attempt"), detail: tr("Let go when you finish.") },
      live: {
        headline: listeningStatus?.speaking ? tr("Recording an attempt") : tr("Listening"),
        detail: auto ? tr("Repeat the card with pauses. Stop finishes the current attempt; queued attempts keep processing.") : tr("Listening without making attempts."),
      },
    }[mode],
    working: { headline: tr("Transcribing"), detail: tr("You can leave this card; the attempt is stored by the app.") },
  }[phase]

  const feed = spectrum ?? noSpectrum
  const hasSpectrum = useSyncExternalStore(feed.subscribe, () => feed.get() !== null)
  const stream = phase === 'recording' || hasSpectrum
    ? <LiveRecording time={layout?.time} active={phase === 'recording'} source={waveSource} spectrum={spectrum} takes={listeningStatus?.takes ?? []} />
    : null
  const padLabel = mode === 'hold' ? tr("Hold to record") : phase === 'recording' ? tr("Stop recording") : tr("Start recording")

  return <VoicePanel label={tr("Record an attempt")} className="drill-voice" layout={layout} phase={phase} face={stream}
    faceTitle={copy.detail} status={copy.headline}
    mode={live ? 'auto' : mode} onMode={next => onMode(next === 'auto' ? 'live' : next)} modesDisabled={busy || starting || phase === 'recording'}
    pad={{ label: padLabel, disabled: busy || (starting && mode !== 'hold'),
      action: mode === 'hold' ? { kind: 'hold', onHoldStart, onHoldEnd } : { kind: 'press', onPress: onToggle } }}
    controls={live && <>
      <LevelMeter level={listeningStatus?.levelDb ?? null} noise={listeningStatus?.noiseFloorDb ?? null}
        threshold={settings.thresholdDb} decibels={decibels}
        onThreshold={thresholdDb => { if (thresholdDb !== settings.thresholdDb) onSettings({ ...settings, thresholdDb }) }} />
      <label className="voice-switch"><input type="checkbox" checked={auto} disabled={busy || starting}
        onChange={event => onAutoDetect?.(event.target.checked)} />{tr("Detect attempts")}</label>
    </>}
    settings={<>
      {microphoneSelector}
      {auto && <>
        <Choice label={tr("Stop listening after silence of")} value={settings.silenceTimeoutMs} options={CONTINUOUS_RECORDING_POLICY.silenceTimeoutOptionsMs}
          format={seconds} onChange={silenceTimeoutMs => onSettings({ ...settings, silenceTimeoutMs })} />
        <p className="voice-settings-note">{listeningStatus?.noiseFloorDb != null
          ? tr("Room noise {value0} · attempts start above {value1}", { value0: decibels(listeningStatus.noiseFloorDb), value1: decibels(settings.thresholdDb) })
          : tr("Attempts start above {value0}", { value0: decibels(settings.thresholdDb) })}</p>
        <Choice label={tr("End an attempt after silence of")} value={settings.pauseMs} options={CONTINUOUS_RECORDING_POLICY.pauseOptionsMs}
          format={seconds} onChange={pauseMs => onSettings({ ...settings, pauseMs })} />
      </>}
      <Choice label={tr("Ignore sounds shorter than")} value={settings.minTakeMs} options={CONTINUOUS_RECORDING_POLICY.minTakeOptionsMs}
        format={seconds} onChange={minTakeMs => onSettings({ ...settings, minTakeMs })} />
    </>} />
}

/** Attempt, queue and ignored counts of the listening session in progress, for
 * the line beside the attempt list. */
export function attemptCounts(status: ListeningStatus | null, tr: ReturnType<typeof useI18n>): string | null {
  if (!status) return null
  return tr("Attempt {value0} · {value1} queued · {value2} ignored", {
    value0: String(status.takes.length + (status.speaking ? 1 : 0)),
    value1: String(status.queued + (status.processing ? 1 : 0)),
    value2: String(status.ignoredTakes),
  })
}

/** The microphone level against the threshold an attempt must cross. The
 * threshold marker is a slider over the whole meter: drag it, or focus it and
 * use the arrow keys. It sets an absolute level, so it stays where it is put
 * while the measured room noise (the dashed mark) moves underneath it. */
function LevelMeter({ level, noise, threshold, decibels, onThreshold }: {
  level: number | null
  noise: number | null
  threshold: number
  decibels: (db: number) => string
  onThreshold: (threshold: number) => void
}) {
  const tr = useI18n()
  const track = useRef<HTMLDivElement>(null)
  const clamp = (value: number) => Math.round(Math.min(CONTINUOUS_RECORDING_POLICY.maxThresholdDb,
    Math.max(CONTINUOUS_RECORDING_POLICY.minThresholdDb, value)))
  const fromPointer = (clientX: number) => {
    const element = track.current
    if (!element) throw new Error('The level meter is not on the page.')
    const bounds = element.getBoundingClientRect()
    const rtl = getComputedStyle(element).direction === 'rtl'
    const fraction = Math.min(1, Math.max(0, (rtl ? bounds.right - clientX : clientX - bounds.left) / bounds.width))
    onThreshold(clamp(METER_FLOOR_DB + fraction * -METER_FLOOR_DB))
  }
  const summary = level === null
    ? tr("Attempts start above {value0}", { value0: decibels(threshold) })
    : tr("{value0}; attempts start above {value1}", { value0: decibels(level), value1: decibels(threshold) })
  return <div ref={track} className="drill-meter" data-above={level !== null && level > threshold} title={summary}
    onPointerDown={event => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      fromPointer(event.clientX)
    }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event.clientX) }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}>
    <span className="drill-meter-level" role="meter" aria-label={tr("Microphone level")}
      aria-valuemin={METER_FLOOR_DB} aria-valuemax={0} aria-valuenow={level === null ? undefined : Math.max(METER_FLOOR_DB, Math.min(0, level))}
      aria-valuetext={summary}>
      {level !== null && <span className="drill-meter-fill" style={{ width: `${meterPercent(level)}%` }} />}
    </span>
    {noise !== null && <span className="drill-meter-noise" style={{ width: `${meterPercent(noise)}%` }} aria-hidden="true" />}
    <span className="drill-meter-threshold" role="slider" tabIndex={0} aria-label={tr("Activity threshold")}
      aria-valuemin={CONTINUOUS_RECORDING_POLICY.minThresholdDb} aria-valuemax={CONTINUOUS_RECORDING_POLICY.maxThresholdDb}
      aria-valuenow={threshold} aria-valuetext={decibels(threshold)}
      style={{ insetInlineStart: `${meterPercent(threshold)}%` }}
      onKeyDown={event => {
        const next = { ArrowRight: threshold + 1, ArrowUp: threshold + 1, ArrowLeft: threshold - 1, ArrowDown: threshold - 1,
          PageUp: threshold + 10, PageDown: threshold - 10,
          Home: CONTINUOUS_RECORDING_POLICY.minThresholdDb, End: CONTINUOUS_RECORDING_POLICY.maxThresholdDb }[event.key]
        if (next === undefined) return
        event.preventDefault()
        onThreshold(clamp(next))
      }} />
  </div>
}

/** A short run of mutually exclusive values, all visible at once. */
function Choice({ label, value, options, format, onChange }: {
  label: string; value: number; options: readonly number[]; format: (value: number) => string; onChange: (value: number) => void
}) {
  return <div className="drill-choice">
    <span>{label}</span>
    <SegmentedChoice label={label} value={String(value)} options={options.map(option => [String(option), format(option)] as const)}
      onChange={chosen => onChange(Number(chosen))} />
  </div>
}
