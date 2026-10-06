import { errorMessage } from '../../../platform/diagnostics/error-details'
import { useEffect, useRef, useState } from 'react'
import { MicrophoneSelector } from '../../../components/media/MicrophoneSelector'
import { MicrophoneCheck } from '../../../components/media/MicrophoneCheck'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { invoke } from '../../../platform/ipc/native'

/** Optional local setup: the device picker with the check row under it.
 * Completing onboarding never depends on microphone access. */
export function OnboardingMicrophone() {
  const tr = useI18n()
  const [device, setDevice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const saving = useRef(false)
  useEffect(() => {
    let alive = true
    invoke<string | null>('get_microphone').then(value => { if (alive) { setDevice(value); setLoaded(true) } }, reason => { if (alive) setError(reason) })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [])
  const change = async (value: string | null) => {
    if (saving.current) return
    saving.current = true; setBusy(true); setError(null)
    try { await invoke('save_microphone', { device: value }); setDevice(value) }
    catch (reason) { setError(reason) }
    finally { saving.current = false; setBusy(false) }
  }
  return <section className="onboarding-microphone" aria-label={tr('Microphone')}>
    <p className="field-note">{tr('Optional: check your microphone before your first conversation.')}</p>
    <MicrophoneSelector value={device} disabled={busy || !loaded} onChange={value => { void change(value) }} />
    <MicrophoneCheck device={device} disabled={busy || !loaded} />
    {error !== null && <ErrorNotice error={error}>{errorMessage(error)}</ErrorNotice>}
  </section>
}
