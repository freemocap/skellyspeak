import { useEffect, useState } from 'react'
import type { AttemptDetail, AttemptView } from '../../generated/contracts'
import { useI18n } from '../../components/localization/i18n'
import { nativeError, readAttemptDetail } from '../../platform/ipc/workspace'
import { useAttemptStream } from '../../state/session/attempt-streams'

/// An attempt's recorded bodies. Re-read whenever the attempt's state changes,
/// so a finishing attempt swaps its live preview for the recorded response.
export function useAttemptDetail(attempt: AttemptView | null): { detail: AttemptDetail | null; error: string | null } {
  const [result, setResult] = useState<{ key: string; detail: AttemptDetail | null; error: string | null } | null>(null)
  const key = attempt ? `${attempt.id}:${attempt.state}` : ''
  const retained = attempt?.unpublishedText
  useEffect(() => {
    if (!attempt) return
    let cancelled = false
    readAttemptDetail(attempt.id)
      .then(detail => { if (!cancelled) setResult({ key, detail, error: null }) })
      .catch(failure => { if (!cancelled) setResult({ key, detail: null, error: nativeError(failure) }) })
    return () => { cancelled = true }
    // The key captures identity and state; the object itself changes every snapshot.
  }, [key, retained])
  return result?.key === key ? { detail: result.detail, error: result.error } : { detail: null, error: null }
}

/// What the attempt returned: live while streaming, recorded afterwards.
export function AttemptResponse({ attempt, detail }: { attempt: AttemptView; detail: AttemptDetail | null }) {
  const tr = useI18n()
  const live = useAttemptStream(attempt.id)
  const running = attempt.state === 'running'
  const recorded = attempt.unpublishedText ?? detail?.responseText ?? detail?.previewText ?? null
  const awaitingRetention = attempt.state !== 'succeeded' && live?.text && !recorded?.startsWith(live.text)
  const text = running || awaitingRetention ? live?.text || recorded : recorded
  return <div className="ai-response-block">
    <h4 className="ai-section-title">{running && live ? tr('Response · streaming') : tr('Response')}</h4>
    {text ? <pre className={running ? 'ai-response is-hydrating' : 'ai-response'}>{text}{running && <span className="stream-caret" aria-hidden="true" />}</pre>
      : <p className="ai-muted">{running ? tr('Awaiting response…') : tr('No response text recorded.')}</p>}
  </div>
}

/// The request and response recorded for one attempt.
export function AttemptBodies({ attempt }: { attempt: AttemptView }) {
  const tr = useI18n()
  const { detail, error } = useAttemptDetail(attempt)
  return <>
    {error && <p className="ai-error" role="alert">{error}</p>}
    <h4 className="ai-section-title">{tr('Request')}</h4>
    {detail?.requestMessages?.length ? detail.requestMessages.map((message, index) => <div key={index} className="ai-message">
      <div className="ai-message-role">{message.role}</div>
      <pre>{message.content}</pre>
    </div>) : <p className="ai-muted">{detail ? tr('No request recorded for this attempt.') : tr('Loading…')}</p>}
    <AttemptResponse attempt={attempt} detail={detail} />
  </>
}
