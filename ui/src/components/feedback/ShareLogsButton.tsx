import { ErrorNotice } from './ErrorNotice'
import { errorDetails, errorMessage } from '../../platform/diagnostics/error-details'
import { ResponseDetails } from './ResponseDetails'
import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { saveDiagnosticLogs, supportsLogSaving, shareDiagnosticLogs, supportsLogSharing } from '../../platform/ipc/diagnostic-sharing'

/** Native sharing stays reachable from both normal navigation and failure UI. */
export function ShareLogsButton({ compact = false }: { compact?: boolean }) {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const sharing = supportsLogSharing()
  if (!sharing && !supportsLogSaving()) return null
  const label = tr(busy ? 'Preparing logs…' : sharing ? 'Share logs' : 'Save logs')
  return <>
    <button type="button" className={compact ? 'log-export-compact' : 'btn'} disabled={busy}
      aria-label={label} title={label} onClick={async () => {
        setBusy(true); setFailure(null); setSaved(null)
        try {
          if (sharing) await shareDiagnosticLogs()
          else setSaved(await saveDiagnosticLogs())
        } catch (error) { setFailure(error) }
        finally { setBusy(false) }
      }}>{compact ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8" /></svg> : label}</button>
    {saved && <p role="status">{tr('Saved to ')}{saved}</p>}
    {failure != null && <ErrorNotice error={failure}>{errorMessage(failure)}<ResponseDetails value={errorDetails(failure)} /></ErrorNotice>}
  </>
}
