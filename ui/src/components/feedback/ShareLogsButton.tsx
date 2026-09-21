import { errorDetails, errorMessage } from '../../platform/diagnostics/error-details'
import { ResponseDetails } from './ResponseDetails'
import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { saveDiagnosticLogs, supportsLogSaving, shareDiagnosticLogs, supportsLogSharing } from '../../platform/ipc/diagnostic-sharing'

/** Native sharing stays reachable from both normal navigation and failure UI. */
export function ShareLogsButton() {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [saved, setSaved] = useState<string | null>(null)
  if (!supportsLogSharing() && !supportsLogSaving()) return null
  return <>
    {supportsLogSaving() && <button className="btn" disabled={busy} onClick={async () => {
      setBusy(true); setFailure(null); setSaved(null)
      try { setSaved(await saveDiagnosticLogs()) }
      catch (error) { setFailure(error) }
      finally { setBusy(false) }
    }}>{tr(busy ? 'Preparing logs…' : 'Save logs')}</button>}
    {supportsLogSharing() && <button className="btn" disabled={busy} onClick={async () => {
      setBusy(true); setFailure(null)
      try { await shareDiagnosticLogs() }
      catch (error) { setFailure(error) }
      finally { setBusy(false) }
    }}>{tr(busy ? 'Preparing logs…' : 'Share logs')}</button>}
    {saved && <p role="status">{tr('Saved to ')}{saved}</p>}
    {failure != null && <><p role="alert">{errorMessage(failure)}</p><ResponseDetails value={errorDetails(failure)} /></>}
  </>
}
