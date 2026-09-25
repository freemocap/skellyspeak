import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
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
    {source && <p className="coach-entry-said"><TargetPhrase text={source} /></p>}
    {error && <ErrorNotice as="p" error={error} className="turn-errors">{error}</ErrorNotice>}
    {decision?.repairStatus === 'uncertain' && <p role="status">{tr("The coach could not confirm this revision yet.")}</p>}
    {decision?.fixed && <p className="coach-fixed" role="status"><span dir="auto">{decision.fixed}</span></p>}
    {corrections.map((shown, index) => <section key={index} className="coach-card coach-card-help" aria-label={tr("Coaching suggestion")}>
      {shown.move === 'explicit' ? <>
        <p className="cor-line"><s><TargetPhrase text={shown.quote} /></s><span aria-hidden="true"> → </span><strong><TargetPhrase text={shown.text} /></strong></p>
        {shown.explanation && <p className="cor-why" dir="auto">{shown.explanation}</p>}
      </> : <>
        <blockquote><TargetPhrase text={shown.quote} /></blockquote>
        <p className="coach-remark" dir="auto">{shown.text}</p>
      </>}
    </section>)}
    {feedback && !corrections.length && !explanations.length && !error && !decision?.fixed && !decision?.keptGoing && <p className="coach-remark">{tr(feedback.meaningRecovered === 'none' ? 'The meaning could not be determined. Add context to clarify what you intended.' : feedback.meaningRecovered === 'partial' ? 'Only part of the meaning was clear. Add context to clarify what you intended.' : 'No correction identified.')}</p>}
    {explanations.map((explanation, index) => <section key={index} className="coach-card coach-card-explanation" aria-label={tr("Language explanation")}>
      <blockquote><TargetPhrase text={explanation.quote} /></blockquote>
      <p className="coach-remark" dir="auto">{explanation.rationale}</p>
    </section>)}
    {!!feedback?.notes.length && <details><summary>{tr("Details")}</summary>{feedback.notes.map(note => <p key={note}>{note}</p>)}</details>}
  </div>
}
