import { useI18n } from '../../../components/localization/i18n'
import { Markdown } from '../../../components/reading/Markdown'
import { TargetText } from '../../../components/reading/TargetText'
import type { ConversationFeedback } from '../../../generated/contracts'

/** Saved message judgments are separate from skill evidence and rewards. */
export function ConversationFeedbackCard({ feedback, onAsk }: { feedback: ConversationFeedback; onAsk?: (question: string) => void }) {
  const tr = useI18n()
  const onTerm = onAsk ? (term: string) => onAsk(`Explain [[${term}]] in this saved feedback: ${JSON.stringify(feedback)}`) : undefined
  return <div className="coach-entry">
    <Markdown text={feedback.remark} onTerm={onTerm} />
    {feedback.corrections.map(correction => <section className="coach-card coach-card-help" key={correction.said}>
      <p className="cor-line"><s><TargetText text={correction.said} /></s><span aria-hidden="true"> → </span><strong><TargetText text={correction.corrected} /></strong></p>
      <Markdown text={correction.explanation} onTerm={onTerm} />
    </section>)}
    <details><summary>{tr("Message assessment")}</summary>
      <p>{tr("Grammar: {value0}/5", { value0: String(feedback.grammar) })} · {tr("Conversation fit: {value0}/5", { value0: String(feedback.conversation) })}</p>
      <p>{tr("Model judgments about this message, not proficiency measurements. No skill XP is awarded.")}</p>
      {feedback.usedTarget.length > 0 && <p>{tr("Target-language wording")}: <span dir="auto">{feedback.usedTarget.join(' · ')}</span></p>}
      {feedback.usedNative.length > 0 && <p>{tr("Native-language wording")}: <span dir="auto">{feedback.usedNative.join(' · ')}</span></p>}
    </details>
  </div>
}
