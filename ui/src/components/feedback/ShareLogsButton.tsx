import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { shareDiagnosticLogs, supportsLogSharing } from '../../platform/ipc/diagnostic-sharing'

/** Native sharing stays reachable from both normal navigation and failure UI. */
export function ShareLogsButton() {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!supportsLogSharing()) return null
  return <>
    <button className="btn" disabled={busy} onClick={async () => {
      setBusy(true); setFailed(false)
      try { await shareDiagnosticLogs() }
      catch { setFailed(true) }
      finally { setBusy(false) }
    }}>{tr(busy ? 'Preparing logs…' : 'Share logs')}</button>
    {failed && <p role="alert">{tr('Could not share logs. Please try again.')}</p>}
  </>
}
