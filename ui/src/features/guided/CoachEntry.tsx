import { useI18n } from '../../components/i18n'
import { TargetText } from '../../components/TargetText'
import type { CoachDecision, CoachObservationView } from '../../generated/contracts'

/** Learner-facing explanations only. Native diagnostics never substitute for help. */
export function CoachEntry({ decision, feedback, source, error }: {
  decision?: CoachDecision; feedback?: CoachObservationView; source: string | null; error?: string
}) {
  const tr = useI18n()
  const shown = decision?.shown && decision.exposedMove === decision.shown.move ? decision.shown : null
  const explanations = (feedback?.items ?? []).filter(item => item.rationale.trim() && item.outcome !== 'not_observed' && item.construct !== shown?.construct)
  return <div className="coach-entry">
    {source && <p className="coach-entry-said"><TargetText text={source} /></p>}
    {error && <p className="turn-errors" role="alert">{error}</p>}
    {decision?.repairStatus === 'uncertain' && <p role="status">{tr("The coach could not confirm this revision yet.")}</p>}
    {decision?.fixed && <p className="coach-fixed" role="status"><span dir="auto">{decision.fixed}</span></p>}
    {shown && <section className="coach-card coach-card-help" aria-label={tr("Coaching suggestion")}>
      {shown.move === 'explicit' ? <>
        <p className="cor-line"><s><TargetText text={shown.quote} /></s><span aria-hidden="true"> → </span><strong><TargetText text={shown.text} /></strong></p>
        {shown.explanation && <p className="cor-why" dir="auto">{shown.explanation}</p>}
      </> : <>
        <blockquote><TargetText text={shown.quote} /></blockquote>
        <p className="coach-remark" dir="auto">{shown.text}</p>
      </>}
    </section>}
    {explanations.map((item, index) => <section className="coach-card coach-card-explanation" key={`${item.construct}:${index}`} aria-label={tr("Language explanation")}>
      <blockquote><TargetText text={item.quote} /></blockquote>
      <p className="coach-remark" dir="auto">{item.rationale}</p>
    </section>)}
  </div>
}
