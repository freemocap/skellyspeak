import { retryMessageWork } from '../../../platform/ipc/retry-ai'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { evidenceLabelKey } from '../../../domain/learning/catalog/evidence-labels'
import { useI18n } from '../../../components/localization/i18n'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import type { ReactNode } from 'react'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { skillIndex } from '../../../domain/learning/catalog/skill-index'


export function SkillEvidenceRecord({ languageTag, record, judgment, snapshot, children }: { languageTag?: string; record: SkillRecord; judgment: SkillJudgment; snapshot: SkillSnapshot; children: ReactNode }) {
  const tr = useI18n()
  const entry = skillIndex(snapshot).entries.get(`${record.attempt_id}:${judgment.skill_id}`)
  if (!entry) throw new Error('Evidence is not in the current snapshot')
  const { xp, state } = entry
  const assistance = [record.input.suggestion && tr('Suggested wording'), record.input.scaffold && tr('Scaffold used'), record.input.revision && tr('Revision')].filter(Boolean).join(' · ') || tr('No in-app assistance recorded')
  return <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}><article className="skill-evidence-record"><header><strong>{tr(skillIndex(snapshot).catalog.node(judgment.skill_id).label)}</strong><span>{tr.number(xp)} {tr(" XP credited")}</span></header><p>{tr(evidenceLabelKey(state === 'complete' ? (judgment.presence ?? judgment.outcome ?? 'unclear') : state))}</p>
    {judgment.evidence_kind === 'whole_message' && <>
      <p className="detail-meta">{tr('Whole message')}</p>
      <blockquote lang={languageTag}><TargetPhrase text={record.source} /></blockquote>
      {judgment.scores && <dl><dt>{tr('Probability of some evidence')}</dt><dd>{tr.number(judgment.scores.evidence, { style: 'percent', maximumFractionDigits: 1 })}</dd><dt>{tr('Probability of full demonstration')}</dt><dd>{tr.number(judgment.scores.full, { style: 'percent', maximumFractionDigits: 1 })}</dd></dl>}
    </>}
    {record.attribution_error && <ErrorNotice onRetry={() => retryMessageWork(record.chat_id, record.message_id)} error={record.attribution_error}>{record.attribution_error}</ErrorNotice>}
    <details><summary>{tr('Decision scores and policy')}</summary><pre>{JSON.stringify({ answer: judgment.answer, policy: record.decision_policy, attribution: { state: record.attribution_state, reason: judgment.attribution_reason, attempt: record.attribution_attempt } }, null, 2)}</pre></details>
    {judgment.quotes.map((quote, i) => <blockquote key={i} lang={languageTag}><TargetPhrase text={quote} /></blockquote>)}<p>{judgment.rationale}</p><p className="detail-meta">{assistance} {tr(" · external assistance unknown")}</p>
    {state === 'complete' && ['direct', 'contextual'].includes(judgment.presence ?? '') && xp === 0 && <p className="detail-meta">{tr("No current credit. An unchanged retry does not add credit; excluded attempts do not contribute to totals.")}</p>}
    <details><summary>{tr("Source record")}</summary><dl><dt>{tr("Message")}</dt><dd><TargetPhrase text={record.source} /></dd><dt>{tr("Conversation / message")}</dt><dd>{record.chat_id} / {record.message_id}</dd><dt>{tr("Attempt")}</dt><dd>{record.attempt_id}</dd><dt>{tr("Trace turn / session")}</dt><dd>{record.turn_id} / {record.session_id}</dd><dt>{tr("Model / routing")}</dt><dd>{record.model} / {record.provider_mode}</dd><dt>{tr("Catalog / prompt")}</dt><dd>{record.catalog_version} / {record.prompt_version}</dd><dt>{tr("Captured / modality")}</dt><dd>{new Date(record.at_secs * 1000).toLocaleString(tr.browserLocale)} / {record.input.modality === 'text' ? tr('Text') : tr('Speech transcript')}</dd></dl></details>{children}
  </article></ReadingLanguageScope>
}
