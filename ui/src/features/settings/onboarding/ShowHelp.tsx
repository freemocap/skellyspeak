import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { nativeError } from '../../../platform/ipc/workspace'

export function ShowHelp({ onShown }: { onShown: () => void }) {
  const tr = useI18n()
  const busy = useOnboardingStore(state => state.busy)
  const [error, setError] = useState('')
  return <div className="form-row"><button className="btn" disabled={busy} onClick={() => {
    setError('')
    void useOnboardingStore.getState().showHelp(true).then(onShown).catch(reason => setError(nativeError(reason)))
  }}>{tr('Show app tour')}</button>
    <button className="btn" disabled={busy} onClick={() => {
      setError('')
      void useOnboardingStore.getState().reviewSetup().then(onShown).catch(reason => setError(nativeError(reason)))
    }}>{tr('Restart onboarding')}</button>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}</div>
}
