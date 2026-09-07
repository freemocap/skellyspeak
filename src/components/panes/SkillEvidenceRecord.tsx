import type { ReactNode } from 'react'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from '../../lib/skills'
import { evidenceLabel } from '../../pages/skillTree'

export function SkillEvidenceRecord({ record, judgment, snapshot, children }: { record: SkillRecord; judgment: SkillJudgment; snapshot: SkillSnapshot; children: ReactNode }) {
  const excluded = snapshot.profile.choices.excluded_attempts.includes(record.attempt_id)
  const current = record.catalog_version === snapshot.catalog_version && record.status === 'complete' && !excluded
  const xp = current ? snapshot.profile.credits.filter(credit => credit.attempt_id === record.attempt_id && credit.skill_id === judgment.skill_id).reduce((sum, credit) => sum + credit.xp, 0) : 0
  const assistance = [record.input.suggestion && 'Suggested wording', record.input.scaffold && 'Scaffold used', record.input.revision && 'Revision'].filter(Boolean).join(' · ') || 'No in-app assistance recorded'
  return <article className="skill-evidence-record"><header><strong>{evidenceLabel(judgment.skill_id, record.catalog_version)}</strong><span>{xp} XP credited</span></header><p>{excluded ? 'Excluded' : record.status !== 'complete' ? record.status : judgment.outcome.replaceAll('_', ' ')}</p>
    {judgment.quotes.map((quote, i) => <blockquote key={i} lang={record.target}>{quote}</blockquote>)}<p>{judgment.rationale}</p><p className="lesson-meta">{assistance} · external assistance unknown</p>
    <details><summary>Source record</summary><dl><dt>Message</dt><dd>{record.source}</dd><dt>Conversation / message</dt><dd>{record.chat_id} / {record.message_id}</dd><dt>Attempt</dt><dd>{record.attempt_id}</dd><dt>Trace turn / session</dt><dd>{record.turn_id} / {record.session_id}</dd><dt>Model / routing</dt><dd>{record.model} / {record.provider_mode}</dd><dt>Catalog / prompt</dt><dd>{record.catalog_version} / {record.prompt_version}</dd><dt>Captured / modality</dt><dd>{new Date(record.at_secs * 1000).toLocaleString()} / {record.input.modality}</dd></dl></details>{children}
  </article>
}
