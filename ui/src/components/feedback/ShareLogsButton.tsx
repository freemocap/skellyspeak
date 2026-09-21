import { errorDetails, errorMessage } from '../../platform/diagnostics/error-details'
import { ResponseDetails } from './ResponseDetails'
import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { shareDiagnosticLogs, supportsLogSharing } from '../../platform/ipc/diagnostic-sharing'

/** Native sharing stays reachable from both normal navigation and failure UI. */
export function ShareLogsButton() {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  if (!supportsLogSharing()) return null
  return <>
    <button className="btn" disabled={busy} onClick={async () => {
      setBusy(true); setFailure(null)
      try { await shareDiagnosticLogs() }
      catch (error) { setFailure(error) }
      finally { setBusy(false) }
    }}>{tr(busy ? 'Preparing logs…' : 'Share logs')}</button>
    {failure != null && <><p role="alert">{errorMessage(failure)}</p><ResponseDetails value={errorDetails(failure)} /></>}
  </>
}
