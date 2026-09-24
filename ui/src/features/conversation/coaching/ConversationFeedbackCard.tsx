import { useI18n } from '../../../components/localization/i18n'
import type { ConversationFeedback } from '../../../generated/contracts'

export function scoreText(value: number | null) { return value === null ? '—' : `${value}/10` }
function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  const tr = useI18n()
  if (value === null) return <div className="coach-score"><span>{label}</span><strong>{tr('Insufficient evidence')}</strong></div>
  const level = value <= 4 ? 'low' : value <= 7 ? 'partial' : 'strong'
  return <div className="coach-score" data-level={level}>
    <span className="coach-score-label">{label}</span>
    <span className="coach-score-row">
      <span className="coach-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={value} aria-valuetext={`${label}: ${value}/10`}>
        {Array.from({length:10},(_,i)=>i+1).map(step => <span key={step} data-on={step <= value} />)}
      </span><strong aria-hidden="true">{scoreText(value)}</strong>
    </span>
  </div>
}
export function ConversationFeedbackCard({ feedback, onAsk }: { feedback: ConversationFeedback; onAsk?: (question: string) => void }) {
  const tr = useI18n()
  return <section className="coach-assessment" aria-label={tr('Message assessment')}>
    <div className="coach-scores"><ScoreMeter label={tr('Grammar')} value={feedback.grammar}/><ScoreMeter label={tr('Conversation fit')} value={feedback.conversation}/></div>
    {onAsk && <button type="button" className="detail-action" onClick={()=>onAsk(`Explain these saved message ratings, including any uncertainty: ${JSON.stringify(feedback)}`)}>{tr('Explain scores')}</button>}
    <details><summary>{tr('Assessment details')}</summary><pre>{JSON.stringify(feedback.answers,null,2)}</pre></details>
  </section>
}
