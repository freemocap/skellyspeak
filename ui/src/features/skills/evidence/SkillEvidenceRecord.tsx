import { retryMessageWork } from '../../../platform/ipc/retry-ai'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { evidenceLabelKey } from '../../../domain/learning/catalog/evidence-labels'
import { useI18n } from '../../../components/localization/i18n'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import type { ReactNode } from 'react'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { skillIndex } from '../../../domain/learning/catalog/skill-index'

/** One reviewed reply: the learner's message as their own bubble, how it counted
 * and why, with scores, the source record and the owner's controls folded under
 * Review details. */
export function SkillEvidenceRecord({ languageTag, record, judgment, snapshot, children }: { languageTag?: string; record: SkillRecord; judgment: SkillJudgment; snapshot: SkillSnapshot; children: ReactNode }) {
  const tr = useI18n()
  const entry = skillIndex(snapshot).entries.get(`${record.attempt_id}:${judgment.skill_id}`)
  if (!entry) throw new Error('Evidence is not in the current snapshot')
  const { xp, state } = entry
  // Experience: the skill's first credit in a revision chain. Effort: a changed revision credited for it again.
  const credit = snapshot.profile.credits.find(item => item.attempt_id === record.attempt_id && item.skill_id === judgment.skill_id)
  const creditKind = credit?.effort ? tr('Effort') : credit?.experience ? tr('Experience') : null
  const assistance = [record.input.suggestion && tr('Suggested wording'), record.input.scaffold && tr('Scaffold used'), record.input.revision && tr('Revision')].filter(Boolean).join(' · ') || tr('No in-app assistance recorded')
  const label = tr(evidenceLabelKey(state === 'complete' ? (judgment.presence ?? judgment.outcome ?? 'unclear') : state))
  const wholeMessage = judgment.evidence_kind === 'whole_message'
  return <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}><article className="skill-evidence-record">
    <header className="skill-evidence-head">
      <strong>{tr(skillIndex(snapshot).catalog.node(judgment.skill_id).label)}</strong>
      <span className="skill-evidence-xp">{tr.number(xp)} {tr(" XP credited")}{creditKind && <> · {creditKind}</>}</span>
    </header>
    <blockquote className="skill-evidence-message" lang={languageTag}><TargetPhrase text={record.source} /></blockquote>
    <p className="skill-evidence-tags">
      <span className="skill-evidence-tag">{label}</span>
      {wholeMessage && <span className="skill-evidence-tag">{tr('Whole message')}</span>}
      <span className="detail-meta">{assistance} {tr(" · external assistance unknown")}</span>
    </p>
    {!wholeMessage && judgment.quotes.length > 0 && <ul className="skill-evidence-quotes">{judgment.quotes.map((quote, i) => <li key={i} lang={languageTag}><TargetPhrase text={quote} /></li>)}</ul>}
    {judgment.rationale && <p className="skill-evidence-rationale">{judgment.rationale}</p>}
    {state === 'complete' && ['direct', 'contextual'].includes(judgment.presence ?? '') && xp === 0 && <p className="detail-meta">{tr("No current credit. An unchanged retry does not add credit; excluded assessments do not contribute to totals.")}</p>}
    {record.attribution_error && <ErrorNotice onRetry={() => retryMessageWork(record.chat_id, record.message_id)} error={record.attribution_error}>{record.attribution_error}</ErrorNotice>}
    <details className="skill-evidence-details"><summary>{tr('Review details')}</summary>
      {wholeMessage && judgment.scores && <dl><dt>{tr('Probability of some evidence')}</dt><dd>{tr.number(judgment.scores.evidence, { style: 'percent', maximumFractionDigits: 1 })}</dd><dt>{tr('Probability of full demonstration')}</dt><dd>{tr.number(judgment.scores.full, { style: 'percent', maximumFractionDigits: 1 })}</dd></dl>}
      <details><summary>{tr('Decision scores and policy')}</summary><pre>{JSON.stringify({ answer: judgment.answer, policy: record.decision_policy, attribution: { state: record.attribution_state, reason: judgment.attribution_reason, attempt: record.attribution_attempt } }, null, 2)}</pre></details>
      <details><summary>{tr("Source record")}</summary><dl><dt>{tr("Message")}</dt><dd><TargetPhrase text={record.source} /></dd><dt>{tr("Conversation / message")}</dt><dd>{record.chat_id} / {record.message_id}</dd><dt>{tr("Attempt")}</dt><dd>{record.attempt_id}</dd><dt>{tr("Trace turn / session")}</dt><dd>{record.turn_id} / {record.session_id}</dd><dt>{tr("Model / routing")}</dt><dd>{record.model} / {record.provider_mode}</dd><dt>{tr("Catalog / prompt")}</dt><dd>{record.catalog_version} / {record.prompt_version}</dd><dt>{tr("Captured / modality")}</dt><dd>{new Date(record.at_secs * 1000).toLocaleString(tr.browserLocale)} / {record.input.modality === 'text' ? tr('Text') : tr('Speech transcript')}</dd></dl></details>
      {children && <div className="skill-evidence-controls">{children}</div>}
    </details>
  </article></ReadingLanguageScope>
}
