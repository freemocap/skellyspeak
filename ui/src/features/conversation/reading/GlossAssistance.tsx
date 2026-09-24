import { errorMessage } from '../../../platform/diagnostics/error-details'
import { useI18n } from '../../../components/localization/i18n'
import { useRef, useState } from 'react'
import type { GuidedTurnResult } from '../../../types'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'

/** Saved-assistance status; only an explicit retry delegates work to the caller. */
export function GlossAssistance({ assistant, onRetryGloss }: {
  assistant: Pick<GuidedTurnResult, 'savedGloss' | 'glossState' | 'glossOperationId' | 'glossError'>
  onRetryGloss?: (operationId: string) => Promise<void>
}) {
  const tr = useI18n()
  const [glossRetryPending, setGlossRetryPending] = useState(false)
  const [glossRetryError, setGlossRetryError] = useState<string | null>(null)
  const glossRetryLock = useRef(false)
  const retryGloss = async () => {
    const operationId = assistant.glossOperationId
    if (!operationId || !onRetryGloss || glossRetryLock.current) return
    glossRetryLock.current = true
    setGlossRetryPending(true)
    setGlossRetryError(null)
    try { await onRetryGloss(operationId) }
    catch (error) { setGlossRetryError(errorMessage(error)) }
    finally { glossRetryLock.current = false; setGlossRetryPending(false) }
  }
  const pending = ['ready', 'running', 'waiting_dependencies'].includes(assistant.glossState ?? '')
  const pendingLabel = tr(assistant.savedGloss ? "Finishing word meanings…" : "Word meanings pending")
  // Work in progress is carried by the Word by word control; a line appears
  // only for a result that needs attention: partial, held, failed or empty.
  const showGlossHelp = (assistant.savedGloss?.coverage === 'partial' || ['held', 'failed', 'unknown'].includes(assistant.glossState ?? '') || glossRetryError || (assistant.glossState === 'succeeded' && assistant.savedGloss && !assistant.savedGloss.segments.some(segment => segment.kind === 'gloss')))
  if (pending && !showGlossHelp) return <span className="hydrating-announce" role="status">{pendingLabel}</span>
  return (
    <>          {showGlossHelp && <div className="trans" dir="auto" aria-label={tr("Word meanings")} onDoubleClick={event => event.stopPropagation()}>
          {assistant.savedGloss?.coverage === 'partial' && <span>{tr("Partial · ")}</span>}
          {assistant.glossState === 'running' && <ActivityIndicator compact label={pendingLabel} />}
          {['ready', 'waiting_dependencies'].includes(assistant.glossState ?? '') && <span className="hydrating-waiting">{pendingLabel}</span>}
          {assistant.glossState === 'held' && <span className="hydrating-waiting">{tr("Word meanings held")}</span>}
          {['failed', 'unknown'].includes(assistant.glossState ?? '') && <ErrorDetails label={tr("Word meanings")} errorKey={`${assistant.glossOperationId}:${assistant.glossState}:${assistant.glossError}`}>{assistant.glossError ?? tr("Word meanings unavailable")}</ErrorDetails>}
          {(['failed', 'unknown'].includes(assistant.glossState ?? '') || (assistant.glossState === 'succeeded' && assistant.savedGloss && (assistant.savedGloss.coverage === 'partial' || !assistant.savedGloss.segments.some(segment => segment.kind === 'gloss')))) && assistant.glossOperationId && onRetryGloss && <button type="button" className="message-translate" disabled={glossRetryPending} onClick={event => { event.stopPropagation(); void retryGloss() }}>{tr("Retry word meanings")}</button>}
          {glossRetryError && <ErrorDetails label={tr("Retry failed")} errorKey={glossRetryError}>{glossRetryError}</ErrorDetails>}
          </div>}</>
  )
}
