import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { evidenceLabelKey } from '../../../domain/learning/catalog/evidence-labels'
import { useI18n } from '../../../components/localization/i18n'
import { TargetText } from '../../../components/reading/TargetText'
import type { ReactNode } from 'react'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { skillIndex } from '../../../domain/learning/catalog/skill-index'


export function SkillEvidenceRecord({ languageTag, record, judgment, snapshot, children }: { languageTag?: string; record: SkillRecord; judgment: SkillJudgment; snapshot: SkillSnapshot; children: ReactNode }) {
  const tr = useI18n()
  const entry = skillIndex(snapshot).entries.get(`${record.attempt_id}:${judgment.skill_id}`)
  if (!entry) throw new Error('Evidence is not in the current snapshot')
  const { xp, state } = entry
  const assistance = [record.input.suggestion && tr('Suggested wording'), record.input.scaffold && tr('Scaffold used'), record.input.revision && tr('Revision')].filter(Boolean).join(' · ') || tr('No in-app assistance recorded')
  return <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}><article className="skill-evidence-record"><header><strong>{tr(skillIndex(snapshot).catalog.node(judgment.skill_id).label)}</strong><span>{tr.number(xp)} {tr(" XP credited")}</span></header><p>{tr(evidenceLabelKey(state === 'complete' ? judgment.outcome : state))}</p>
    {judgment.quotes.map((quote, i) => <blockquote key={i} lang={languageTag}><TargetText text={quote} /></blockquote>)}<p>{judgment.rationale}</p><p className="detail-meta">{assistance} {tr(" · external assistance unknown")}</p>
    {state === 'complete' && judgment.outcome === 'demonstrated' && xp === 0 && <p className="detail-meta">{tr("No current credit. Matching wording may already be credited on another message; only current saved sources count.")}</p>}
    <details><summary>{tr("Source record")}</summary><dl><dt>{tr("Message")}</dt><dd><TargetText text={record.source} /></dd><dt>{tr("Conversation / message")}</dt><dd>{record.chat_id} / {record.message_id}</dd><dt>{tr("Attempt")}</dt><dd>{record.attempt_id}</dd><dt>{tr("Trace turn / session")}</dt><dd>{record.turn_id} / {record.session_id}</dd><dt>{tr("Model / routing")}</dt><dd>{record.model} / {record.provider_mode}</dd><dt>{tr("Catalog / prompt")}</dt><dd>{record.catalog_version} / {record.prompt_version}</dd><dt>{tr("Captured / modality")}</dt><dd>{new Date(record.at_secs * 1000).toLocaleString(tr.browserLocale)} / {record.input.modality === 'text' ? tr('Text') : tr('Speech transcript')}</dd></dl></details>{children}
  </article></ReadingLanguageScope>
}
