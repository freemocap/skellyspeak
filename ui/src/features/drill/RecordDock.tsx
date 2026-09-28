import { useIsMobile } from '../../components/layout/useIsMobile'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useState, useRef, type ReactNode, type KeyboardEvent, type PointerEvent } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { LiveRecording } from '../../components/media/LiveRecording'
import { CONTINUOUS_RECORDING_POLICY } from '../../generated/contracts'
import type { ListeningSettings, ListeningStatus, LiveSpectrogram } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'

/** Which of the four things the microphone is doing right now. */
export type DockPhase = 'preparing' | 'ready' | 'recording' | 'working'

/** How a take begins and ends: one press each, held down, or cut at silence. */
export type RecordMode = 'tap' | 'hold' | 'live'
const RECORD_MODES: readonly RecordMode[] = ['tap', 'hold', 'live']

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

/** The control that records takes, the way it records them, and what it is doing.
 *
 * Capture and playback share one authority, so the dock says when playback is
 * held rather than letting a disabled button explain itself. */
export function RecordDock({ microphoneSelector, direction = 'ltr', starting = false, phase, mode, onMode, settings, onSettings, listeningStatus, waveSource, liveSpectrum, onToggle, autoDetect = true, onAutoDetect, onHoldStart, onHoldEnd }: {
  microphoneSelector?: ReactNode
  direction?: 'ltr' | 'rtl'
  starting?: boolean
  phase: DockPhase
  mode: RecordMode
  onMode: (mode: RecordMode) => void
  settings: ListeningSettings
  onSettings: (settings: ListeningSettings) => void
  listeningStatus: ListeningStatus | null
  waveSource: WaveSource | null
  liveSpectrum: LiveSpectrogram | null
  onToggle: () => void
  autoDetect?: boolean
  onAutoDetect?: (enabled: boolean) => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const tr = useI18n()
  const mobile = useIsMobile()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const seconds = (ms: number) => tr('{value0} s', { value0: tr.number(ms / 1000, { maximumFractionDigits: 1 }) })
  const decibels = (db: number) => tr('{value0} dB', { value0: tr.number(db, { maximumFractionDigits: 0 }) })
  const auto = mode === 'live' && autoDetect
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

  const holdKeys = {
    onKeyDown: (event: KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); onHoldStart() }
    },
    onKeyUp: (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onHoldEnd() }
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId); onHoldStart()
    },
    onPointerUp: onHoldEnd,
    onPointerCancel: onHoldEnd,
    onLostPointerCapture: onHoldEnd,
    onBlur: onHoldEnd,
  }

  const meter = <LevelMeter level={listeningStatus?.levelDb ?? null} noise={listeningStatus?.noiseFloorDb ?? null}
          threshold={settings.thresholdDb} decibels={decibels}
          onThreshold={thresholdDb => { if (thresholdDb !== settings.thresholdDb) onSettings({ ...settings, thresholdDb }) }} />
  const detection = <label className="drill-auto-detect"><input type="checkbox" checked={auto}
            disabled={busy || starting || mode !== 'live'} onChange={event => onAutoDetect?.(event.target.checked)} />{tr("Detect attempts")}</label>

  return (
    <section className="drill-dock" dir={direction} data-phase={phase} data-mode={mode} aria-label={tr("Record an attempt")}>
      <div className="drill-dock-side" dir={direction}>
        <button type="button" className="drill-dock-button" aria-label={mode === 'hold' ? tr("Hold to record") : phase === 'recording' ? tr("Stop recording") : tr("Start recording")}
          aria-pressed={phase === 'recording'} disabled={busy || (starting && mode !== 'hold')} {...(mode === 'hold' ? holdKeys : { onClick: onToggle })}>
          <ToolbarIcon name={phase === 'recording' ? 'stop' : 'mic'} size={20} />
          <span aria-hidden="true">{tr(mode === "hold" ? "Hold to record" : phase === "recording" ? "Stop" : "Record")}</span>
        </button>
        {/* The phase changes without the learner acting — a transcription
            finishing, a session opening — so it is announced, not just drawn.
            The longer instruction sits in the settings panel and the tooltip. */}
        <div className="drill-dock-copy" role="status" aria-live="polite" title={copy.detail}>
          <p className="drill-dock-headline">{copy.headline}</p>
          <p className="drill-dock-counts">{tr("Attempt {value0} · {value1} queued · {value2} ignored", {
            value0: String((listeningStatus?.takes.length ?? 0) + (listeningStatus?.speaking ? 1 : 0)),
            value1: String((listeningStatus?.queued ?? 0) + (listeningStatus?.processing ? 1 : 0)),
            value2: String(listeningStatus?.ignoredTakes ?? 0),
          })}</p>
        </div>
        {!mobile && meter}
        <div className="drill-recording-controls">
          {!mobile && detection}
          <button type="button" className="btn drill-dock-settings" aria-label={tr("Recording settings")}
            title={tr("Recording settings")} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><ToolbarIcon name="settings" size={17} /></button>
        </div>
        {settingsOpen && <DetailDialog title={tr("Recording settings")} capture="preserve" onClose={() => setSettingsOpen(false)}>
          <div className="drill-dock-panel">
            <h2>{tr("Recording settings")}</h2>
            {microphoneSelector}
            {mobile && <>{detection}{meter}</>}
            <div className="drill-dock-modes"><div className="drill-segmented" role="radiogroup" aria-label={tr("Recording mode")}>
          {RECORD_MODES.map(option => {
            const name = { tap: tr("Tap to record"), hold: tr("Hold to talk"), live: tr("Auto") }[option]
            return <button key={option} type="button" role="radio" aria-checked={mode === option} aria-label={name} title={name}
              disabled={busy || starting || phase === 'recording'} onClick={() => onMode(option)}>
              {{ tap: tr("Tap"), hold: tr("Hold"), live: tr("Auto") }[option]}
            </button>
          })}
        </div>

        </div>
            <p className="drill-dock-detail">{tr("“Detect attempts” applies to Auto mode.")}</p>
            <p className="drill-dock-detail">{copy.detail}</p>
            {auto && <>
              <Choice label={tr("Stop listening after silence of")} value={settings.silenceTimeoutMs} options={CONTINUOUS_RECORDING_POLICY.silenceTimeoutOptionsMs}
                format={seconds} onChange={silenceTimeoutMs => onSettings({ ...settings, silenceTimeoutMs })} />
              <p className="drill-dock-detail">{listeningStatus?.noiseFloorDb != null
                ? tr("Room noise {value0} · attempts start above {value1}", { value0: decibels(listeningStatus.noiseFloorDb), value1: decibels(settings.thresholdDb) })
                : tr("Attempts start above {value0}", { value0: decibels(settings.thresholdDb) })}</p>
              <Choice label={tr("End an attempt after silence of")} value={settings.pauseMs} options={CONTINUOUS_RECORDING_POLICY.pauseOptionsMs}
                format={seconds} onChange={pauseMs => onSettings({ ...settings, pauseMs })} />
            </>}
            <Choice label={tr("Ignore sounds shorter than")} value={settings.minTakeMs} options={CONTINUOUS_RECORDING_POLICY.minTakeOptionsMs}
              format={seconds} onChange={minTakeMs => onSettings({ ...settings, minTakeMs })} />
          </div>
        </DetailDialog>}
      </div>

      <div className="drill-recording-container"><LiveRecording direction={direction} active={phase === 'recording'} source={waveSource} spectrum={liveSpectrum} takes={listeningStatus?.takes ?? []} />
      </div>
    </section>
  )
}

/** The microphone level against the threshold a take must cross. The
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
    <div className="drill-segmented" role="radiogroup" aria-label={label}>
      {options.map(option => <button key={option} type="button" role="radio" aria-checked={option === value}
        onClick={() => onChange(option)}>{format(option)}</button>)}
    </div>
  </div>
}
