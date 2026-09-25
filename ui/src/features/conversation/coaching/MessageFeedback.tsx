import { FeedbackContextForm } from './FeedbackContextForm'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { AskCoachButton, AskCoachContext } from '../../../components/learning/AskCoachButton'
import { ConversationFeedbackCard, scoreText } from './ConversationFeedbackCard'
import type { ConversationFeedback } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'
import { CoachEntry } from './CoachEntry'
import { nativeError } from '../../../platform/ipc/workspace'

export function MessageFeedback({ id, text, conversationFeedback, feedback, decision, error, reviewing, onEdit, onAsk, onControl, children, analysis, skills, onRetry, feedbackContext, onAddContext }: {
  feedbackContext?: string
  onAddContext?: (note: string) => Promise<void>
  conversationFeedback?: ConversationFeedback
  onRetry?: () => Promise<void>
  skills?: ReactNode
  analysis?: ReactNode
  children?: ReactNode
  id: number; text: string; feedback: CoachObservationView | undefined; decision?: CoachDecision; error: string | undefined
  reviewing: boolean
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
  onControl?: (control: CoachControl) => Promise<void>
}) {
  const tr = useI18n()
  const scoreId = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [failure, setFailure] = useState<string | null>(null)
  const close = (): void => setOpen(false)
  async function openCard() {
    if (pending.current) return
    setFailure(null); setOpen(true)
    if (!decision || decision.keptGoing || (decision.shown && decision.exposedMove === decision.shown.move) || (!decision.shown && !onControl)) { setOpen(true); return }
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
  const disclosed = useRef('')
  useEffect(() => {
    if (!decision?.shown) { disclosed.current = ''; return }
    if (!open || decision.keptGoing || decision.exposedMove === decision.shown.move || pending.current || !onControl) return
    const key = `${id}:${decision.shown.move}:${decision.shown.text}`
    if (disclosed.current === key) return
    disclosed.current = key
    void openCard()
  }, [open, id, decision, onControl])
  const askCoach = (question: string) => { close(); onAsk(question) }
  const shown = decision?.shown && decision.exposedMove === decision.shown.move ? decision.shown : null
  const label = decision ? tr("Feedback") : null
  return <>
    {decision?.fixed && <span className="message-fixed" role="status"><span dir="auto">{decision.fixed}</span></span>}
    <div className="message-actions" onDoubleClick={event => event.stopPropagation()}>{children}<button type="button" className="message-translate" aria-label={tr("Analyze your message")} aria-haspopup="dialog" disabled={busy} onClick={() => void openCard()}>{tr("Analysis")}</button>
    <button type="button" data-feedback-state={error ? 'failed' : (conversationFeedback || (decision && feedback)) ? 'complete' : reviewing ? 'pending' : 'unavailable'} className={`feedback-badge${conversationFeedback ? ' has-scores' : ''}${error ? ' feedback-error' : ''}`} aria-describedby={conversationFeedback ? `${scoreId}-grammar ${scoreId}-conversation` : undefined} aria-haspopup="dialog" aria-label={tr("Coach feedback for message {value0}", { value0: String(id) })} disabled={busy} onClick={() => void openCard()}>
        {conversationFeedback ? <><span title={tr("Grammar")}><span aria-hidden="true">✍️ {scoreText(conversationFeedback.grammar)}</span><span hidden id={`${scoreId}-grammar`}>{tr("Grammar: {value0}", { value0: conversationFeedback.grammar === null ? tr("Insufficient evidence") : scoreText(conversationFeedback.grammar) })}</span></span><span title={tr("Conversation fit")}><span aria-hidden="true">🗣️ {scoreText(conversationFeedback.conversation)}</span><span hidden id={`${scoreId}-conversation`}>{tr("Conversation fit: {value0}", { value0: conversationFeedback.conversation === null ? tr("Insufficient evidence") : scoreText(conversationFeedback.conversation) })}</span></span></> : error ? tr("Feedback failed") : label ?? (reviewing ? <ActivityIndicator label={tr("Analyzing…")} /> : tr("Feedback unavailable"))} <span aria-hidden="true">↗</span>
      </button>
    </div>
    {!open && failure && <ErrorNotice as="p" error={failure}>{failure}</ErrorNotice>}
    {open && <AskCoachContext value={askCoach}><DetailDialog title={tr("Feedback on your message")} onClose={close}>
      {analysis}
      <CoachEntry feedback={feedback} decision={decision} source={analysis ? null : text} error={error} />
      {conversationFeedback && <ConversationFeedbackCard feedback={conversationFeedback} />}
      {!decision && !error && <p role="status">{reviewing ? tr("The coach is reviewing this message.") : feedback ? tr("Coaching decision is unavailable.") : tr("No feedback was saved for this message.")}</p>}
      {skills}
      <div className="detail-actions">
        {error && onRetry && <button type="button" className="detail-action" disabled={busy} onClick={async () => { setBusy(true); setFailure(null); try { await onRetry() } catch (reason) { setFailure(nativeError(reason)) } finally { setBusy(false) } }}>{tr("Retry failed help")}</button>}
        {decision?.shown && decision.exposedMove !== decision.shown.move && <button type="button" disabled={busy} className="detail-action" onClick={() => void openCard()}>{tr("View coaching help")}</button>}
        {onEdit && <button type="button" disabled={busy} className="detail-action" onClick={() => { close(); onEdit() }}><span aria-hidden="true">✏️</span> {tr("Edit and resend message")}</button>}
        {onControl && decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && !decision.keptGoing && <button type="button" disabled={busy} className="detail-action" onClick={() => void control('show_answer')}>{tr("Show answer")}</button>}
        {onControl && decision && !decision.keptGoing && <button type="button" disabled={busy} className="detail-action" onClick={() => void control('keep_going')}>{tr("Keep going")}</button>}
        <AskCoachButton question={`Help me understand the feedback on my message: “${text}”. Saved feedback: ${JSON.stringify({ feedback, correction: shown })}`} />
      </div>
      {onAddContext && <FeedbackContextForm saved={feedbackContext} reviewing={reviewing} onSubmit={onAddContext} />}
      {failure && <ErrorNotice as="p" error={failure}>{failure}</ErrorNotice>}
    </DetailDialog></AskCoachContext>}
  </>
}
