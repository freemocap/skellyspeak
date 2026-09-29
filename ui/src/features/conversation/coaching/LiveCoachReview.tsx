import { AiRetryContext } from '../../../components/feedback/AiRetry'
import { retryTurn } from '../../../platform/ipc/retry-ai'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import { useI18n } from '../../../components/localization/i18n'
import { useEffect, useRef, useState } from 'react'
import type { CoachControl } from '../../../generated/contracts'
import type { StoredTurn } from '../../../types'
import { CoachEntry } from './CoachEntry'
import { nativeError } from '../../../platform/ipc/workspace'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'

export function LiveCoachReview({ turn, visible, onControl, onEdit, revealOnView = true }: {
  revealOnView?: boolean
  turn: StoredTurn | undefined; visible: boolean; onControl: (control: CoachControl) => Promise<void>; nativeLanguageName: string; rtl: boolean
  /** Opens this message in the composer to fix and resend it; absent while editing is unavailable. */
  onEdit: (() => void) | undefined
}) {
  const tr = useI18n()
  const review = useRef<HTMLElement>(null)
  const attempted = useRef('')
  useEffect(() => {
    if (visible) { const panel = review.current?.closest('.study-coaching-scroll'); if (panel) panel.scrollTop = 0 }
  }, [turn?.id, visible])
  const [error, setError] = useState<string | null>(null)
  const decision = turn?.coachDecision
  useEffect(() => {
    if (!revealOnView || !visible || !turn || !decision?.shown || decision.keptGoing || decision.exposedMove === decision.shown.move) return
    const key = `${turn.id}:${decision.shown.move}:${decision.shown.text}`
    if (attempted.current === key) return
    attempted.current = key
    setError(null)
    void onControl('open_card').catch(reason => setError(nativeError(reason)))
  }, [revealOnView, visible, turn, decision, onControl])
  if (!turn) return null
  if (!turn.conversationFeedback && !turn.coachError && !error && !decision?.shown && !decision?.fixed && decision?.repairStatus !== 'uncertain' && !turn.coach?.items.some(item => item.rationale.trim())) return null
  return <AiRetryContext value={turn.turnId ? () => retryTurn(turn.turnId!) : null}><section ref={review} className="live-coach-review" aria-label={tr("Conversation coaching")}>
    <h3>{tr("On your message")}</h3>
    <CoachEntry source={null} decision={decision} feedback={turn.coach} error={turn.coachError} />
    {turn.conversationFeedback && <ConversationFeedbackCard feedback={turn.conversationFeedback} />}
    {error && <ErrorNotice as="p" onRetry={() => onControl('open_card')} error={error}>{error}</ErrorNotice>}
    {!revealOnView && decision?.shown && decision.exposedMove !== decision.shown.move && <button type="button" className="detail-action" onClick={() => { void onControl('open_card').catch(reason => setError(nativeError(reason))) }}>{tr("View coaching help")}</button>}
    {decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && <button type="button" className="detail-action" onClick={() => { void onControl('show_answer').catch(reason => setError(nativeError(reason))) }}>{tr("Show answer")}</button>}
    {onEdit && decision?.shown && decision.exposedMove === decision.shown.move && !decision.keptGoing && <button type="button" className="btn primary live-coach-fix" onClick={onEdit}><ToolbarIcon name="edit" size={15} />{tr("Fix and resend")}</button>}
  </section></AiRetryContext>
}
