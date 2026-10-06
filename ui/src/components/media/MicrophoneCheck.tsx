import { createContext, useContext, useEffect, useRef } from 'react'
import { useI18n } from '../localization/i18n'
import { ActivityIndicator } from '../feedback/ActivityIndicator'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { useMicrophoneTest } from '../../platform/audio/useMicrophoneTest'

/** True inside a surface the learner opened in order to run the check at once,
 * such as Recording settings opened from the silent-recording card. */
export const MicrophoneCheckStart = createContext(false)

/** A local microphone check in one row: the button, a thin level bar and a few
 * words with the seconds left and the input that opened. It sits under the
 * device picker in Settings, onboarding and Recording settings, never in the
 * recorder itself. Nothing is transcribed, saved or sent; the hook stops it
 * after its time, when the device changes or when the surface closes. */
export function MicrophoneCheck({ device, disabled = false }: { device: string | null; disabled?: boolean }) {
  const tr = useI18n()
  const test = useMicrophoneTest(device)
  const startAtOnce = useContext(MicrophoneCheckStart)
  const started = useRef(false)
  useEffect(() => {
    if (!startAtOnce || disabled || started.current) return
    started.current = true
    void test.start()
  }, [startAtOnce, disabled, test])
  const busy = test.phase !== 'idle'
  const transitional = test.phase === 'starting' || test.phase === 'stopping'
  const health = test.health
  const stalled = tr('The microphone stopped sending audio. Check its connection.')
  const word = test.phase === 'starting' ? tr('Starting…')
    : busy
      ? health?.signal === 'stalled' ? stalled : health?.signal === 'quiet' ? tr('No sound. Check mute or move closer.')
        : health?.detected ? tr('Hearing you') : tr('Say something')
      : health === null ? null
        : health.signal === 'stalled' ? stalled : health.detected ? tr('Heard you') : tr('No sound heard')
  return <div className="microphone-check" data-phase={test.phase}>
    <div className="microphone-check-row">
      <button type="button" className="btn" disabled={(!busy && disabled) || test.phase === 'stopping'} aria-busy={transitional}
        onClick={() => { void (busy ? test.stop() : test.start()) }}>
        {transitional && <ActivityIndicator label={tr('Loading…')} compact />}
        {busy ? tr('Stop') : tr('Check microphone')}
      </button>
      <MicrophoneMeter level={busy ? health?.level ?? 0 : 0} />
    </div>
    <p className="microphone-check-status" role="status">
      {word && <span>{word}</span>}
      {busy && test.remaining !== null && <span>{tr('{value0} s', { value0: tr.number(test.remaining) })}</span>}
      {test.label && <span className="microphone-check-device">{test.label}</span>}
    </p>
    {busy && <p className="field-note">{tr('Local check. Nothing is saved or uploaded.')}</p>}
    {test.error !== null && <ErrorNotice error={test.error}>{errorMessage(test.error)}</ErrorNotice>}
  </div>
}

/** The level as a thin bar, from the monitor's 0–1 scale. */
function MicrophoneMeter({ level }: { level: number }) {
  const tr = useI18n()
  const percent = Math.round(Math.max(0, Math.min(1, level)) * 100)
  return <span className="microphone-meter" role="meter" aria-label={tr('Microphone level')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
    <span className="microphone-meter-fill" style={{ width: `${percent}%` }} />
  </span>
}
