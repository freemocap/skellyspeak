import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import type { ConversationFeedback } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useRef, useState, type ReactNode } from 'react'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'
import { CoachEntry } from './CoachEntry'
import { nativeError } from '../../../platform/ipc/workspace'

export function MessageFeedback({ id, text, conversationFeedback, feedback, decision, error, reviewing, onEdit, onAsk, onControl, children, analysis, onRetry, onOpenCoach }: {
  conversationFeedback?: ConversationFeedback
  onOpenCoach?: () => void
  onRetry?: () => Promise<void>
  analysis?: ReactNode
  children?: ReactNode
  id: number; text: string; feedback: CoachObservationView | undefined; decision?: CoachDecision; error: string | undefined
  reviewing: boolean
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
  onControl?: (control: CoachControl) => Promise<void>
}) {
  const tr = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [failure, setFailure] = useState<string | null>(null)
  const close = (): void => setOpen(false)
  async function openCard() {
    if (pending.current) return
    setFailure(null); setOpen(true)
    if (!decision || decision.fixed || decision.keptGoing || (decision.shown && decision.exposedMove === decision.shown.move) || (!decision.shown && !onControl)) { setOpen(true); return }
    if (!onControl) { setFailure('Coaching disclosure is unavailable.'); return }
    pending.current = true; setBusy(true)
    try { await onControl('open_card'); setOpen(true) }
    catch (reason) { setFailure(nativeError(reason)) }
    finally { pending.current = false; setBusy(false) }
  }
  async function control(value: CoachControl) {
    if (!onControl || pending.current) return
    pending.current = true; setBusy(true); setFailure(null)
    try { await onControl(value); if (value === 'keep_going') close() }
    catch (reason) { setFailure(nativeError(reason)) }
    finally { pending.current = false; setBusy(false) }
  }
  const shown = decision?.shown && decision.exposedMove === decision.shown.move ? decision.shown : null
  const label = conversationFeedback || decision ? tr("Feedback") : null
  return <>
    <button type="button" data-feedback-state={error ? 'failed' : (conversationFeedback || (decision && feedback)) ? 'complete' : reviewing ? 'pending' : 'unavailable'} className={`feedback-badge${decision?.shown ? ' has-correction' : ''}${error ? ' feedback-error' : ''}`} aria-haspopup={onOpenCoach && decision?.shown ? undefined : "dialog"} aria-label={tr("Coach feedback for message {value0}", { value0: String(id) })} disabled={busy} onClick={() => onOpenCoach && decision?.shown ? onOpenCoach() : void openCard()}>
      {shown ? <><span dir="auto">{shown.text}</span> <span>{tr("Ask the coach")}</span></> : error ? tr("Feedback failed") : label ?? (reviewing ? <ActivityIndicator label={tr("Analyzing…")} /> : tr("Feedback unavailable"))} <span aria-hidden="true">↗</span>
    </button>
    {decision?.fixed && <span className="message-fixed" role="status"><span dir="auto">{decision.fixed}</span></span>}
    <div className="message-actions" onDoubleClick={event => event.stopPropagation()}>{children}<button type="button" className="message-translate" aria-label={tr("Analyze your message")} aria-haspopup="dialog" disabled={busy} onClick={() => void openCard()}>{tr("Analysis")}</button></div>
    {!open && failure && <p role="alert">{failure}</p>}
    {open && <DetailDialog title={tr("Feedback on your message")} onClose={close}>
      {analysis}
      {conversationFeedback ? <ConversationFeedbackCard feedback={conversationFeedback} onAsk={onAsk} /> : <CoachEntry feedback={feedback} decision={decision} source={analysis ? null : text} error={error} />}
      {!conversationFeedback && !decision && !error && <p role="status">{reviewing ? tr("The coach is reviewing this message.") : feedback ? tr("Coaching decision is unavailable.") : tr("No feedback was saved for this message.")}</p>}
      <div className="lesson-actions">
        {error && onRetry && <button type="button" className="lesson-action" disabled={busy} onClick={async () => { setBusy(true); setFailure(null); try { await onRetry() } catch (reason) { setFailure(nativeError(reason)) } finally { setBusy(false) } }}>{tr("Retry failed help")}</button>}
        {decision?.shown && decision.exposedMove !== decision.shown.move && <button type="button" disabled={busy} className="lesson-action" onClick={() => void openCard()}>{tr("View coaching help")}</button>}
        {onEdit && <button type="button" disabled={busy} className="lesson-action" onClick={() => { close(); onEdit() }}>{tr("Edit message")}</button>}
        {onControl && decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && !decision.keptGoing && <button type="button" disabled={busy} className="lesson-action" onClick={() => void control('show_answer')}>{tr("Show answer")}</button>}
        {onControl && decision && !decision.keptGoing && <button type="button" disabled={busy} className="lesson-action" onClick={() => void control('keep_going')}>{tr("Keep going")}</button>}
        <button type="button" className="lesson-action" onClick={() => { close(); onAsk(`Help me understand the feedback on my message: “${text}”. Saved feedback: ${JSON.stringify(conversationFeedback ?? feedback)}`) }}>{tr("Ask the coach")}</button>
      </div>
      {failure && <p role="alert">{failure}</p>}
    </DetailDialog>}
  </>
}
