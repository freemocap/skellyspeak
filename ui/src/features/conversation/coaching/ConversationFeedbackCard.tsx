import { useI18n } from '../../../components/localization/i18n'
import { Markdown } from '../../../components/reading/Markdown'
import { TargetText } from '../../../components/reading/TargetText'
import type { ConversationFeedback } from '../../../generated/contracts'

/** A 1–5 judgment drawn as five segments; the level colours it (low, partial, strong). */
function ScoreMeter({ label, value, text }: { label: string; value: number; text: string }) {
  const level = value <= 2 ? 'low' : value === 3 ? 'partial' : 'strong'
  return <div className="coach-score" data-level={level}>
    <span className="coach-score-label">{label}</span>
    <span className="coach-score-row">
      <span className="coach-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={5} aria-valuenow={value} aria-valuetext={text}>
        {[1, 2, 3, 4, 5].map(step => <span key={step} data-on={step <= value} />)}
      </span>
      <strong aria-hidden="true">{value}/5</strong>
    </span>
  </div>
}

/** Saved message judgments are separate from skill evidence and rewards. */
export function ConversationFeedbackCard({ feedback, onAsk }: { feedback: ConversationFeedback; onAsk?: (question: string) => void }) {
  const tr = useI18n()
  const onTerm = onAsk ? (term: string) => onAsk(`Explain [[${term}]] in this saved feedback: ${JSON.stringify(feedback)}`) : undefined
  return <div className="coach-entry">
    <div className="coach-verdict"><Markdown text={feedback.remark} onTerm={onTerm} /></div>
    {feedback.corrections.map(correction => <section className="coach-card coach-card-help" key={correction.said}>
      <p className="cor-line"><s><TargetText text={correction.said} /></s><span aria-hidden="true"> → </span><strong><TargetText text={correction.corrected} /></strong></p>
      <Markdown text={correction.explanation} onTerm={onTerm} />
    </section>)}
    <section className="coach-assessment" aria-label={tr("Message assessment")}>
      <div className="coach-scores">
        <ScoreMeter label={tr("Grammar")} value={feedback.grammar} text={tr("Grammar: {value0}/5", { value0: String(feedback.grammar) })} />
        <ScoreMeter label={tr("Conversation fit")} value={feedback.conversation} text={tr("Conversation fit: {value0}/5", { value0: String(feedback.conversation) })} />
      </div>
      {feedback.usedTarget.length > 0 && <div className="coach-wording" data-kind="target"><span>{tr("Target-language wording")}</span>
        <ul>{feedback.usedTarget.map(text => <li key={text} dir="auto">{text}</li>)}</ul></div>}
      {feedback.usedNative.length > 0 && <div className="coach-wording" data-kind="native"><span>{tr("Native-language wording")}</span>
        <ul>{feedback.usedNative.map(text => <li key={text} dir="auto">{text}</li>)}</ul></div>}
    </section>
  </div>
}
