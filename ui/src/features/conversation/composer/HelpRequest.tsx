import { useRef, useState } from 'react'
import type { HelpLane } from '../../../domain/conversation/reply-help'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ResponseDetails } from '../../../components/feedback/ResponseDetails'
import { useI18n } from '../../../components/localization/i18n'
import { nativeError } from '../../../platform/ipc/workspace'

/** The local latch covers command acceptance until the durable snapshot arrives. */
export function useHelpRequest(lane: HelpLane, run?: () => Promise<void>, initial = false) {
  const [shown, setShown] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const [commandFailure, setFailure] = useState<{ error: unknown; revision: string | null } | null>(null)
  const locked = useRef(false)
  const submittedRevision = useRef<string | null>(null)
  const revision = lane.revision ?? lane.state
  // A newer durable snapshot supersedes a lost/failed command response.
  const failure = commandFailure?.revision === revision ? commandFailure.error : null
  const submit = (action?: () => Promise<void>) => {
    if (!action || locked.current) return
    locked.current = true; submittedRevision.current = revision; setSubmitted(true); setFailure(null)
    void action().catch((error: unknown) => { setFailure({ error, revision }); setSubmitted(false) }).finally(() => { locked.current = false })
  }
  const pending = ['ready', 'running', 'waiting_dependencies'].includes(lane.state ?? '') || (submitted && !failure && submittedRevision.current === revision)
  return { shown, pending, failure, submit, toggle: () => {
    setShown(!shown)
    if (!shown && lane.state === null && !submitted && !failure) submit(run)
  } }
}

export function HelpStatus({ lane, pending, failure, label, onRetry, onInspect }: {
  lane: HelpLane; pending?: boolean; failure?: unknown; label: string
  onRetry?: () => void; onInspect?: () => void
}) {
  const tr = useI18n()
  const error = failure ?? lane.error
  const failed = ['failed', 'unknown'].includes(lane.state ?? '')
  return <>
    {pending && <ActivityIndicator label={label} />}
    {lane.state === 'held' && <p role="status">{tr('AI work is paused or held.')}</p>}
    {['cancelled', 'invalidated'].includes(lane.state ?? '') && <p role="status">{tr('Reply help is unavailable for this message.')}</p>}
    {(error != null || failed) && <ErrorDetails label={tr('Reply help')} errorKey={JSON.stringify(error ?? lane.state)} explanation={error != null ? nativeError(error) : undefined}>
      {lane.state === 'unknown' && <p>{tr('The outcome is unknown. This request may have incurred usage.')}</p>}
      <ResponseDetails value={failure ?? lane.details} />
    </ErrorDetails>}
    {onRetry && (failed || failure != null) && <button type="button" className="btn" disabled={pending} onClick={onRetry}>{tr('Retry')}</button>}
    {onInspect && (failed || lane.state === 'held' || error != null) && <button type="button" className="btn" onClick={onInspect}>{tr('AI activity & tools')}</button>}
  </>
}
