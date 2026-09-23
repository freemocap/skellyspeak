import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useState, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { LiveRecording } from '../../components/media/LiveRecording'
import { WaveformStrip } from '../../components/media/WaveformStrip'
import { CONTINUOUS_RECORDING_POLICY } from '../../generated/contracts'
import type { ListeningSettings, ListeningStatus, LiveSpectrogram } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'

/** Which of the four things the microphone is doing right now. */
export type DockPhase = 'preparing' | 'ready' | 'recording' | 'working'

/** How a take begins and ends: one press each, held down, or cut at silence. */
export type RecordMode = 'tap' | 'hold' | 'auto'
const RECORD_MODES: readonly RecordMode[] = ['tap', 'hold', 'auto']

export function dockPhase({ ready, recording, transcribing }: {
  ready: boolean; recording: boolean; transcribing: boolean
}): DockPhase {
  if (recording) return 'recording'
  if (transcribing) return 'working'
  return ready ? 'ready' : 'preparing'
}

/** The meter's range: quieter than this is drawn as empty. */
const METER_FLOOR_DB = -80
/** The room noise native assumes until it has measured a quiet frame. */
const UNMEASURED_NOISE_DB = -60
const meterPercent = (db: number) => Math.max(0, Math.min(100, (db - METER_FLOOR_DB) / -METER_FLOOR_DB * 100))

/** The control that records takes, the way it records them, and what it is doing.
 *
 * Capture and playback share one authority, so the dock says when playback is
 * held rather than letting a disabled button explain itself. */
export function RecordDock({ phase, mode, onMode, settings, onSettings, listeningStatus, waveSource, liveSpectrum, onToggle, onCancel, onHoldStart, onHoldEnd }: {
  phase: DockPhase
  mode: RecordMode
  onMode: (mode: RecordMode) => void
  settings: ListeningSettings
  onSettings: (settings: ListeningSettings) => void
  listeningStatus: ListeningStatus | null
  waveSource: WaveSource | null
  liveSpectrum: LiveSpectrogram | null
  onToggle: () => void
  onCancel: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const tr = useI18n()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const seconds = (ms: number) => tr('{value0} s', { value0: tr.number(ms / 1000, { maximumFractionDigits: 1 }) })
  const decibels = (db: number) => tr('{value0} dB', { value0: tr.number(db, { maximumFractionDigits: 0 }) })
  const auto = mode === 'auto'
  const busy = phase === 'recording' || phase === 'working'

  const copy = {
    preparing: { headline: tr("Preparing the session"), detail: tr("Recording starts once the practice session is open.") },
    ready: {
      tap: { headline: tr("Ready to record"), detail: tr("Tap to start, tap again to stop.") },
      hold: { headline: tr("Hold to talk"), detail: tr("Hold the button, or focus it and hold Space. Letting go ends the take.") },
      auto: { headline: tr("Ready to listen"), detail: tr("Say the phrase, pause, and say it again. Each pause ends a take.") },
    }[mode],
    recording: {
      tap: { headline: tr("Recording"), detail: tr("Stop when you finish. Discard throws this attempt away.") },
      hold: { headline: tr("Recording"), detail: tr("Let go when you finish.") },
      auto: {
        headline: listeningStatus?.speaking ? tr("Recording a take") : tr("Listening"),
        detail: tr("Repeat the phrase with pauses. Stop finishes the current take; queued takes keep processing."),
      },
    }[mode],
    working: { headline: tr("Transcribing"), detail: tr("You can leave this phrase; the attempt is stored by the app.") },
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
  }

  return (
    <section className="drill-dock" data-phase={phase} data-mode={mode} aria-label={tr("Record an attempt")}>
      <div className="drill-dock-row">
        {mode === 'hold'
          ? <button type="button" className="drill-dock-button" aria-label={tr("Hold to record")} aria-pressed={phase === 'recording'}
            disabled={phase === 'preparing' || phase === 'working'} {...holdKeys}>
            <ToolbarIcon name="mic" size={20} /><span aria-hidden="true">{tr("Hold")}</span>
          </button>
          : <button type="button" className="drill-dock-button" aria-label={phase === 'recording' ? tr("Stop recording") : tr("Start recording")}
            aria-pressed={phase === 'recording'} disabled={phase === 'preparing' || phase === 'working'} onClick={onToggle}>
            <ToolbarIcon name={phase === 'recording' ? 'stop' : 'mic'} size={20} />
            <span aria-hidden="true">{phase === 'recording' ? tr("Stop") : auto ? tr("Listen") : tr("Record")}</span>
          </button>}
        {/* The phase changes without the learner acting — a transcription
            finishing, a session opening — so it is announced, not just drawn.
            The longer instruction sits in the settings panel and the tooltip. */}
        <div className="drill-dock-copy" role="status" aria-live="polite" title={copy.detail}>
          <p className="drill-dock-headline">{copy.headline}</p>
          {auto && listeningStatus && <p className="drill-dock-counts">{tr("Take {value0} · {value1} queued · {value2} ignored", {
            value0: String(listeningStatus.takes.length + (listeningStatus.speaking ? 1 : 0)),
            value1: String(listeningStatus.queued + (listeningStatus.processing ? 1 : 0)),
            value2: String(listeningStatus.ignoredTakes),
          })}</p>}
        </div>
        {auto && <LevelMeter level={listeningStatus?.levelDb ?? null} noise={listeningStatus?.noiseFloorDb ?? null}
          offset={settings.thresholdOffsetDb} decibels={decibels}
          onOffset={thresholdOffsetDb => onSettings({ ...settings, thresholdOffsetDb })} />}
        {phase === 'recording' && mode !== 'hold' && <button type="button" className="btn drill-dock-discard" onClick={onCancel}
          aria-label={auto ? tr("Discard current take") : tr("Discard")} title={auto ? tr("Discard current take") : tr("Discard")}>
          <ToolbarIcon name="trash" size={16} />
        </button>}
        <div className="drill-segmented" role="radiogroup" aria-label={tr("Recording mode")}>
          {RECORD_MODES.map(option => {
            const name = { tap: tr("Tap to record"), hold: tr("Hold to talk"), auto: tr("Auto-detect") }[option]
            return <button key={option} type="button" role="radio" aria-checked={mode === option} aria-label={name} title={name}
              disabled={busy} onClick={() => onMode(option)}>
              {{ tap: tr("Tap"), hold: tr("Hold"), auto: tr("Auto") }[option]}
            </button>
          })}
        </div>
        {mode !== 'tap' && <button type="button" className="btn drill-dock-settings" aria-label={tr("Recording settings")}
          title={tr("Recording settings")} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><ToolbarIcon name="settings" size={17} /></button>}
        {settingsOpen && <DetailDialog title={tr("Recording settings")} capture="preserve" onClose={() => setSettingsOpen(false)}>
          <div className="drill-dock-panel">
            <h2>{tr("Recording settings")}</h2>
            <p className="drill-dock-detail">{copy.detail}</p>
            {auto && <>
              <Choice label={tr("Stop listening after silence of")} value={settings.silenceTimeoutMs} options={CONTINUOUS_RECORDING_POLICY.silenceTimeoutOptionsMs}
                format={seconds} onChange={silenceTimeoutMs => onSettings({ ...settings, silenceTimeoutMs })} />
              <p className="drill-dock-detail">{listeningStatus
                ? tr("Room noise {value0} · takes start above {value1}", { value0: decibels(listeningStatus.noiseFloorDb), value1: decibels(listeningStatus.thresholdDb) })
                : tr("The room noise is measured once listening starts; the threshold sits above it.")}</p>
              <Choice label={tr("End a take after silence of")} value={settings.pauseMs} options={CONTINUOUS_RECORDING_POLICY.pauseOptionsMs}
                format={seconds} onChange={pauseMs => onSettings({ ...settings, pauseMs })} />
            </>}
            <Choice label={tr("Ignore sounds shorter than")} value={settings.minTakeMs} options={CONTINUOUS_RECORDING_POLICY.minTakeOptionsMs}
              format={seconds} onChange={minTakeMs => onSettings({ ...settings, minTakeMs })} />
          </div>
        </DetailDialog>}
      </div>

      {auto && (waveSource || liveSpectrum)
        ? <LiveRecording active={phase === 'recording'} source={waveSource} spectrum={liveSpectrum} takes={listeningStatus?.takes ?? []} />
        : waveSource && <WaveformStrip source={waveSource} height={32} />}
    </section>
  )
}

/** The microphone level against the threshold a take must cross. The
 * threshold marker is a slider: drag it, or focus it and use the arrow keys,
 * to move how far above the room noise a take starts. Until listening has
 * measured the room, the marker sits above the noise level native assumes. */
function LevelMeter({ level, noise, offset, decibels, onOffset }: {
  level: number | null
  noise: number | null
  offset: number
  decibels: (db: number) => string
  onOffset: (offset: number) => void
}) {
  const tr = useI18n()
  const track = useRef<HTMLDivElement>(null)
  const floor = noise ?? UNMEASURED_NOISE_DB
  const threshold = Math.min(-10, Math.max(-70, floor + offset))
  const clampOffset = (value: number) => Math.round(Math.min(CONTINUOUS_RECORDING_POLICY.maxThresholdOffsetDb,
    Math.max(CONTINUOUS_RECORDING_POLICY.minThresholdOffsetDb, value)))
  const fromPointer = (clientX: number) => {
    const element = track.current
    if (!element) throw new Error('The level meter is not on the page.')
    const bounds = element.getBoundingClientRect()
    const rtl = getComputedStyle(element).direction === 'rtl'
    const fraction = Math.min(1, Math.max(0, (rtl ? bounds.right - clientX : clientX - bounds.left) / bounds.width))
    onOffset(clampOffset(METER_FLOOR_DB + fraction * -METER_FLOOR_DB - floor))
  }
  const summary = level === null
    ? tr("Takes start above {value0}", { value0: decibels(threshold) })
    : tr("{value0}; takes start above {value1}", { value0: decibels(level), value1: decibels(threshold) })
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
    <span className="drill-meter-threshold" role="slider" tabIndex={0} aria-label={tr("Start a take this far above the room noise")}
      aria-valuemin={CONTINUOUS_RECORDING_POLICY.minThresholdOffsetDb} aria-valuemax={CONTINUOUS_RECORDING_POLICY.maxThresholdOffsetDb}
      aria-valuenow={offset} aria-valuetext={decibels(offset)}
      style={{ insetInlineStart: `${meterPercent(threshold)}%` }}
      onKeyDown={event => {
        const next = { ArrowRight: offset + 1, ArrowUp: offset + 1, ArrowLeft: offset - 1, ArrowDown: offset - 1,
          Home: CONTINUOUS_RECORDING_POLICY.minThresholdOffsetDb, End: CONTINUOUS_RECORDING_POLICY.maxThresholdOffsetDb }[event.key]
        if (next === undefined) return
        event.preventDefault()
        onOffset(clampOffset(next))
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
