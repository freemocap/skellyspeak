import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '../localization/i18n'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { DetailDialog } from '../dialogs/DetailDialog'

/** How a recording begins and ends: one press each, held down, or cut at each pause. */
export type VoiceMode = 'tap' | 'hold' | 'auto'
/** What the microphone is doing: getting ready, ready, recording, or finishing work. */
export type VoicePhase = 'preparing' | 'ready' | 'recording' | 'working'

/** The pad answers a press (Tap, Auto) or a hold (Hold). */
export type PadAction = { kind: 'press'; onPress: () => void } | { kind: 'hold'; onHoldStart: () => void; onHoldEnd: () => void }

const MODES: readonly VoiceMode[] = ['tap', 'hold', 'auto']

/** The one recorder, identical in Chat and Practice.
 *
 * A two-by-two grid: the face (the stream, a draft, or one arrow pointing at the
 * pad) with the microphone pad at its inline end, then one row of controls under
 * the face and the Tap / Hold / Auto toggle under the pad. The pad is only ever
 * the microphone: calm blue when ready, red with a red outline and a glow while
 * recording, faded while it waits. There is no standing instruction; the phase is
 * announced to screen readers instead. Recording logic stays with the caller. */
export function VoicePanel({ label, phase, face, mode, onMode, laterModes = [], modesDisabled = false, pad, controls, settings, status, faceTitle, onDiscard, direction, className }: {
  label: string
  phase: VoicePhase
  /** The stream or a draft; null shows the prompt while the pad can start a recording. */
  face: ReactNode | null
  mode: VoiceMode
  onMode: (mode: VoiceMode) => void
  /** Shown in the toggle but not available here yet: pressing one says “Coming soon”. */
  laterModes?: readonly VoiceMode[]
  modesDisabled?: boolean
  pad: { label: string; title?: string; disabled: boolean; action: PadAction }
  /** One row under the face, after the settings button: the meter, Type, Auto-send or Detect attempts. */
  controls?: ReactNode
  /** The recording settings dialog's content; the button that opens it leads the control row. */
  settings?: ReactNode
  /** Announced when the phase changes, without drawing a standing instruction. */
  status?: string
  faceTitle?: string
  /** Offered in the face while recording: throw the recording away. */
  onDiscard?: () => void
  direction?: 'ltr' | 'rtl'
  className?: string
}) {
  const tr = useI18n()
  const recording = phase === 'recording'
  const [soon, setSoon] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const elapsed = useElapsed(recording)
  useEffect(() => {
    if (!soon) return
    const timer = setTimeout(() => setSoon(false), 1800)
    return () => clearTimeout(timer)
  }, [soon])

  const action = pad.action
  const padEvents = action.kind === 'press' ? { onClick: action.onPress } : {
    onKeyDown: (event: KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); action.onHoldStart() }
    },
    onKeyUp: (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); action.onHoldEnd() }
    },
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId); action.onHoldStart()
    },
    onPointerUp: action.onHoldEnd,
    onPointerCancel: action.onHoldEnd,
    onLostPointerCapture: action.onHoldEnd,
    onBlur: action.onHoldEnd,
  }
  const modeName = { tap: tr('Tap to record'), hold: tr('Hold to talk'), auto: tr('Auto') }
  const modeShort = { tap: tr('Tap'), hold: tr('Hold'), auto: tr('Auto') }
  const seconds = Math.floor(elapsed)

  return <section className={['voice-panel', className].filter(Boolean).join(' ')} data-phase={phase} data-mode={mode} dir={direction} aria-label={label}>
    <div className="voice-grid">
      <div className="voice-face" title={faceTitle}>
        {face ?? (phase === 'ready' && !pad.disabled && <div className="voice-prompt" aria-hidden="true">
          <span className="voice-prompt-text">{tr('Press the microphone to start')}</span>
          <ToolbarIcon name="chevron" size={18} />
        </div>)}
        {recording && <span className="voice-chip"><span className="voice-dot" aria-hidden="true" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>}
        {recording && onDiscard && <button type="button" className="voice-discard-recording" onClick={onDiscard}
          aria-label={tr('Discard recording')} title={tr('Discard recording without transcribing')}><ToolbarIcon name="trash" size={15} /></button>}
      </div>
      <button type="button" className="voice-pad" data-live={recording} aria-pressed={recording} aria-label={pad.label} title={pad.title ?? pad.label}
        disabled={pad.disabled} {...padEvents}>
        <ToolbarIcon name="mic" size={30} />
      </button>
      <div className="voice-controls">
        <button type="button" className="voice-mini voice-mini-icon" aria-label={tr('Recording settings')} title={tr('Recording settings')}
          aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><ToolbarIcon name="settings" size={15} /></button>
        {controls}
      </div>
      <div className="voice-modes" role="radiogroup" aria-label={tr('Recording mode')}>
        {MODES.map(option => {
          const later = laterModes.includes(option)
          return <button key={option} type="button" role="radio" aria-checked={mode === option} aria-label={modeName[option]} title={modeName[option]}
            aria-disabled={later || undefined} data-later={later || undefined} disabled={modesDisabled}
            onClick={() => { if (later) setSoon(true); else onMode(option) }}>{modeShort[option]}</button>
        })}
        {soon && <span className="voice-soon" role="status">{tr('Coming soon')}</span>}
      </div>
    </div>
    <p className="voice-status" role="status" aria-live="polite">{status}</p>
    {settingsOpen && <DetailDialog title={tr('Recording settings')} capture="preserve" onClose={() => setSettingsOpen(false)}>
      <div className="voice-settings">
        <h2>{tr('Recording settings')}</h2>
        {settings}
      </div>
    </DetailDialog>}
  </section>
}

/** Seconds since recording began, for the chip in the stream. */
function useElapsed(running: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const began = useRef(0)
  useEffect(() => {
    if (!running) return
    began.current = performance.now()
    setElapsed(0)
    const timer = setInterval(() => setElapsed((performance.now() - began.current) / 1000), 250)
    return () => clearInterval(timer)
  }, [running])
  return elapsed
}
