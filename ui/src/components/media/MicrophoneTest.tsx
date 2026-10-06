import { errorMessage } from '../../platform/diagnostics/error-details'
import { useI18n } from '../localization/i18n'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { ActivityIndicator } from '../feedback/ActivityIndicator'
import { useMicrophoneTest } from '../../platform/audio/useMicrophoneTest'
import { MicrophoneSignal } from './MicrophoneSignal'

export function MicrophoneTest({ device, disabled = false }: { device: string | null; disabled?: boolean }) {
  const tr = useI18n()
  const test = useMicrophoneTest(device)
  const busy = test.phase !== 'idle'
  return <div>
    <button type="button" className="btn" disabled={!busy && disabled || test.phase === 'stopping'} aria-busy={test.phase === 'starting' || test.phase === 'stopping'}
      onClick={() => { void (busy ? test.stop() : test.start()) }}>
      {test.phase === 'starting' || test.phase === 'stopping' ? <ActivityIndicator label={tr('Loading…')} compact /> : null}
      {busy ? tr('Stop test') : tr('Test microphone')}
    </button>
    {(busy || test.health && test.health.signal !== 'waiting') && <>
      {test.label && <p className="field-note">{tr('Using: {name}', { name: test.label })}</p>}
      <MicrophoneSignal health={test.health} />
    </>}
    <p className="field-note">{tr('Local test only. No audio is saved or uploaded. Stops after 15 seconds.')}</p>
    {test.error !== null && <ErrorNotice error={test.error}>{errorMessage(test.error)}</ErrorNotice>}
  </div>
}
