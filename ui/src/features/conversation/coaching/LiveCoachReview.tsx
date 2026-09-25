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

export function LiveCoachReview({ turn, visible, onControl }: {
  turn: StoredTurn | undefined; visible: boolean; onControl: (control: CoachControl) => Promise<void>; nativeLanguageName: string; rtl: boolean
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
    if (!visible || !turn || !decision?.shown || decision.keptGoing || decision.exposedMove === decision.shown.move) return
    const key = `${turn.id}:${decision.shown.move}:${decision.shown.text}`
    if (attempted.current === key) return
    attempted.current = key
    setError(null)
    void onControl('open_card').catch(reason => setError(nativeError(reason)))
  }, [visible, turn, decision, onControl])
  if (!turn) return null
  if (!turn.conversationFeedback && !turn.coachError && !error && !decision?.shown && !decision?.fixed && decision?.repairStatus !== 'uncertain' && !turn.coach?.items.some(item => item.rationale.trim())) return null
  return <AiRetryContext value={turn.turnId ? () => retryTurn(turn.turnId!) : null}><section ref={review} className="live-coach-review" aria-label={tr("Conversation coaching")}>
    <h3>{tr("On your message")}</h3>
    <CoachEntry source={null} decision={decision} feedback={turn.coach} error={turn.coachError} />
    {turn.conversationFeedback && <ConversationFeedbackCard feedback={turn.conversationFeedback} />}
    {error && <ErrorNotice as="p" onRetry={() => onControl('open_card')} error={error}>{error}</ErrorNotice>}
    {decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && <button type="button" className="detail-action" onClick={() => { void onControl('show_answer').catch(reason => setError(nativeError(reason))) }}>{tr("Show answer")}</button>}
  </section></AiRetryContext>
}
