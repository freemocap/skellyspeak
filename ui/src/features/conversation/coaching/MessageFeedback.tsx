import { FeedbackContextForm } from './FeedbackContextForm'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { AskCoachButton, AskCoachContext } from '../../../components/learning/AskCoachButton'
import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import type { ConversationFeedback } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'
import { CoachEntry } from './CoachEntry'
import { coachFlags } from '../../../domain/conversation/coach-marks'
import { nativeError } from '../../../platform/ipc/workspace'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import type { MessageTool } from '../../../components/reading/MessageTools'
import { useUiDirection } from '../../../components/localization/useUiDirection'

/** The coach's feedback on one of the learner's messages. `bubble` draws the
 * message with its tools and receives the Analysis tool, which opens this
 * feedback; under the bubble, one quiet line holds the verdict (how many
 * errors the coach flagged, or Good job), Fix it and `reward` (the message's
 * XP). The verdict opens the same feedback. */
export function MessageFeedback({ id, text, conversationFeedback, feedback, decision, error, reviewing, onEdit, onAsk, onControl, bubble, reward, analysis, skills, onRetry, feedbackContext, onAddContext }: {
  feedbackContext?: string
  onAddContext?: (note: string) => Promise<void>
  conversationFeedback?: ConversationFeedback
  onRetry?: () => Promise<void>
  skills?: ReactNode
  analysis?: ReactNode
  bubble: (analysisTool: MessageTool) => ReactNode
  reward: ReactNode
  id: number; text: string; feedback: CoachObservationView | undefined; decision?: CoachDecision; error: string | undefined
  reviewing: boolean
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
  onControl?: (control: CoachControl) => Promise<void>
}) {
  const tr = useI18n()
  const uiDirection = useUiDirection()
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
  // The badge counts the phrases the coach flagged; with none, and a message it fully understood, it says so.
  const flags = coachFlags(feedback, decision)
  const judged = Boolean(conversationFeedback || (decision && feedback))
  const clear = flags.length === 0 && decision?.repairStatus !== 'uncertain' && (feedback?.meaningRecovered ?? 'full') === 'full'
  const verdict = flags.length ? 'errors' : clear ? 'clear' : 'open'
  return <>
    {bubble({ key: 'analysis', label: tr("Analysis"), ariaLabel: tr("Analyze your message"), opensDialog: true, disabled: busy, onSelect: () => void openCard() })}
    <div className="message-feedback-line" dir={uiDirection} onDoubleClick={event => event.stopPropagation()}>
    {decision?.fixed && <span className="message-fixed" role="status"><span dir="auto">{decision.fixed}</span></span>}
    <button type="button" data-feedback-state={error ? 'failed' : judged ? 'complete' : reviewing ? 'pending' : 'unavailable'} className={`feedback-badge${error ? ' feedback-error' : ''}`} data-verdict={judged && !error ? verdict : undefined} aria-haspopup="dialog" aria-label={tr("Coach feedback for message {value0}", { value0: String(id) })} disabled={busy} onClick={() => void openCard()}>
        {error ? tr("Feedback failed") : judged ? <>
          {verdict !== 'open' && <ToolbarIcon name={verdict === 'errors' ? 'idea' : 'thumbs-up'} size={14} />}
          <span className="feedback-verdict">{verdict === 'errors' ? tr("Errors found", { count: flags.length }) : verdict === 'clear' ? tr("Good job") : tr("Feedback")}</span>
        </> : label ?? (reviewing ? <ActivityIndicator label={tr("Analyzing…")} /> : tr("Feedback unavailable"))}<ToolbarIcon name="chevron" size={14} />
      </button>
    {flags.length > 0 && onEdit && <button type="button" className="feedback-fix" disabled={busy} onClick={onEdit}><ToolbarIcon name="edit" size={13} />{tr("Fix it")}</button>}
    {reward}
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
        {onEdit && <button type="button" disabled={busy} className="detail-action" onClick={() => { close(); onEdit() }}><ToolbarIcon name="edit" size={15} /> {tr("Edit and resend message")}</button>}
        {onControl && decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && !decision.keptGoing && <button type="button" disabled={busy} className="detail-action" onClick={() => void control('show_answer')}>{tr("Show answer")}</button>}
        {onControl && decision && !decision.keptGoing && <button type="button" disabled={busy} className="detail-action" onClick={() => void control('keep_going')}>{tr("Keep going")}</button>}
        <AskCoachButton question={`Help me understand the feedback on my message: “${text}”. Saved feedback: ${JSON.stringify({ feedback, correction: shown })}`} />
      </div>
      {onAddContext && <FeedbackContextForm saved={feedbackContext} reviewing={reviewing} onSubmit={onAddContext} />}
      {failure && <ErrorNotice as="p" error={failure}>{failure}</ErrorNotice>}
    </DetailDialog></AskCoachContext>}
  </>
}
