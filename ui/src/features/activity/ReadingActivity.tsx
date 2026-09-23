import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { readingActivity } from '../../platform/ipc/reading'
import { nativeError } from '../../platform/ipc/workspace'

/** Reading requests have no conversation owner; inspect durable metadata only. */
export function ReadingActivity() {
  const tr = useI18n()
  const [receipts, setReceipts] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function refresh() {
    setPending(true); setError(null)
    try { setReceipts(await readingActivity()) } catch (error) { setError(nativeError(error)) } finally { setPending(false) }
  }
  return <details><summary>{tr('Reading request history')}</summary>
    <button className="btn" disabled={pending} onClick={() => void refresh()}>{tr('Refresh')}</button>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}<ResponseDetails value={receipts} />
  </details>
}
