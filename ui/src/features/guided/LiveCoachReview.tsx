import { useI18n } from '../../ui/i18n'
import { useEffect, useRef, useState } from 'react'
import type { CoachControl } from '../../contracts'
import type { StoredTurn } from '../../types'
import { CoachEntry } from './CoachEntry'
import { AnalysisContent } from './AnalysisContent'
import { nativeError } from '../../platform/ipc/workspace'

export function LiveCoachReview({ turn, visible, onControl, nativeLanguageName, rtl }: {
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
  if (!turn) return <p className="lesson-meta">{tr("Your coach will follow the conversation here.")}</p>
  return <section ref={review} className="live-coach-review" aria-label={tr("Conversation coaching")}>
    <h3>{tr("Your coach")}</h3>
    <CoachEntry source={null} decision={decision} feedback={turn.coach} error={turn.coachError} />
    {error && <p role="alert">{error}</p>}
    {decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && <button type="button" className="lesson-action" onClick={() => { void onControl('show_answer').catch(reason => setError(nativeError(reason))) }}>{tr("Show answer")}</button>}
    <AnalysisContent turn={turn} inspect={null} nativeLanguageName={nativeLanguageName} showRomanization rtl={rtl} />
  </section>
}
