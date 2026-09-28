import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { TargetPassage } from '../../../components/reading/TargetPassage'
import type { CoachDecision, CoachObservationView } from '../../../generated/contracts'

/** Learner-facing explanations only. Native diagnostics never substitute for help. */
export function CoachEntry({ decision, feedback, source, error }: {
  decision?: CoachDecision; feedback?: CoachObservationView; source: string | null; error?: string
}) {
  const tr = useI18n()
  const shown = decision?.shown && decision.exposedMove === decision.shown.move ? decision.shown : null
  const corrections = [...(shown ? [shown] : []), ...(decision?.exposedMove === 'explicit' && !decision.keptGoing ? feedback?.corrections ?? [] : [])].filter((item, index, all) => all.findIndex(other => other.quote === item.quote && other.text === item.text) === index)
  const explanations = !decision?.keptGoing ? (feedback?.items ?? []).filter(item => item.rationale.trim() && item.outcome !== 'not_observed').filter((item, index, all) => all.findIndex(other => other.quote === item.quote && other.rationale === item.rationale) === index) : []
  return <div className="coach-entry">
    {source && <div className="coach-entry-said"><TargetPassage side="me" text={source} /></div>}
    {error && <ErrorNotice as="p" error={error} className="turn-errors">{error}</ErrorNotice>}
    {decision?.repairStatus === 'uncertain' && <p role="status">{tr("The coach could not confirm this revision yet.")}</p>}
    {decision?.fixed && <p className="coach-fixed" role="status"><span dir="auto">{decision.fixed}</span></p>}
    {corrections.map((shown, index) => <section key={index} className="coach-card coach-card-help" aria-label={tr("Coaching suggestion")}>
      {shown.move === 'explicit' ? <>
        <div className="cor-line"><div className="cor-original"><div className="detail-meta">{tr("Original")}</div><TargetPassage side="me" text={shown.quote} /></div><div className="cor-replacement"><div className="detail-meta">{tr("Coaching suggestion")}</div><TargetPassage text={shown.text} /></div></div>
        {shown.explanation && <p className="cor-why" dir="auto">{shown.explanation}</p>}
      </> : <>
        <blockquote><TargetPassage side="me" text={shown.quote} /></blockquote>
        <p className="coach-remark" dir="auto">{shown.text}</p>
      </>}
    </section>)}
    {feedback && !corrections.length && !explanations.length && !error && !decision?.fixed && !decision?.keptGoing && <p className="coach-remark">{tr(feedback.meaningRecovered === 'none' ? 'The meaning could not be determined. Add context to clarify what you intended.' : feedback.meaningRecovered === 'partial' ? 'Only part of the meaning was clear. Add context to clarify what you intended.' : 'No correction identified.')}</p>}
    {explanations.map((explanation, index) => <section key={index} className="coach-card coach-card-explanation" aria-label={tr("Language explanation")}>
      <blockquote><TargetPassage side="me" text={explanation.quote} /></blockquote>
      <p className="coach-remark" dir="auto">{explanation.rationale}</p>
    </section>)}
    {!!feedback?.notes.length && <details><summary>{tr("Details")}</summary>{feedback.notes.map(note => <p key={note}>{note}</p>)}</details>}
  </div>
}
