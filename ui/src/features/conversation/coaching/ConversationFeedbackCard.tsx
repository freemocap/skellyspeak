import { useI18n } from '../../../components/localization/i18n'
import type { ConversationFeedback } from '../../../generated/contracts'

export function scoreText(value: number | null) { return value === null ? '—' : `${value}/10` }
/** How a 0–10 score reads: low, partial or strong. */
export function scoreLevel(value: number): 'low' | 'partial' | 'strong' {
  return value <= 4 ? 'low' : value <= 7 ? 'partial' : 'strong'
}
/** The detailed feedback card's ten-step score bar, coloured by its level. */
export function ScoreBar({ label, value }: { label: string; value: number }) {
  return <span className="coach-meter" data-level={scoreLevel(value)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={`${label}: ${value}/10`}>
    {Array.from({length:10},(_,i)=>i+1).map(step => <span key={step} data-on={step <= value} />)}
  </span>
}
function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  const tr = useI18n()
  if (value === null) return <div className="coach-score"><span>{label}</span><strong>{tr('Insufficient evidence')}</strong></div>
  return <div className="coach-score">
    <span className="coach-score-label">{label}</span>
    <span className="coach-score-row"><ScoreBar label={label} value={value} /><strong aria-hidden="true">{scoreText(value)}</strong></span>
  </div>
}
export function ConversationFeedbackCard({ feedback }: { feedback: ConversationFeedback }) {
  const tr = useI18n()
  return <section className="coach-assessment" aria-label={tr('Message assessment')}>
    <div className="coach-scores"><ScoreMeter label={tr('Grammar')} value={feedback.grammar}/><ScoreMeter label={tr('Conversation fit')} value={feedback.conversation}/></div>

  </section>
}
