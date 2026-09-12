import { TargetText } from '../../ui/TargetText'
import type { ReactNode } from 'react'
import type { SkillJudgment, SkillRecord, SkillSnapshot } from '../../domain/skills/skills'
import { skillIndex } from '../../domain/skills/skill-index'
import { evidenceLabel } from '../../domain/skills/skillTree'

export function SkillEvidenceRecord({ record, judgment, snapshot, children }: { record: SkillRecord; judgment: SkillJudgment; snapshot: SkillSnapshot; children: ReactNode }) {
  const entry = skillIndex(snapshot).entries.get(`${record.attempt_id}:${judgment.skill_id}`)
  if (!entry) throw new Error('Evidence is not in the current snapshot')
  const { xp, state } = entry
  const assistance = [record.input.suggestion && 'Suggested wording', record.input.scaffold && 'Scaffold used', record.input.revision && 'Revision'].filter(Boolean).join(' · ') || 'No in-app assistance recorded'
  return <article className="skill-evidence-record"><header><strong>{record.catalog_version === snapshot.catalog_version ? skillIndex(snapshot).catalog.node(judgment.skill_id).label : evidenceLabel(judgment.skill_id, record.catalog_version)}</strong><span>{xp} XP credited</span></header><p>{state === 'complete' ? judgment.outcome.replaceAll('_', ' ') : state}</p>
    {judgment.quotes.map((quote, i) => <blockquote key={i} lang={record.target}><TargetText text={quote} /></blockquote>)}<p>{judgment.rationale}</p><p className="lesson-meta">{assistance} · external assistance unknown</p>
    {state === 'complete' && judgment.outcome === 'demonstrated' && xp === 0 && <p className="lesson-meta">No current credit. Matching wording may already be credited on another message; only current saved sources count.</p>}
    <details><summary>Source record</summary><dl><dt>Message</dt><dd><TargetText text={record.source} /></dd><dt>Conversation / message</dt><dd>{record.chat_id} / {record.message_id}</dd><dt>Attempt</dt><dd>{record.attempt_id}</dd><dt>Trace turn / session</dt><dd>{record.turn_id} / {record.session_id}</dd><dt>Model / routing</dt><dd>{record.model} / {record.provider_mode}</dd><dt>Catalog / prompt</dt><dd>{record.catalog_version} / {record.prompt_version}</dd><dt>Captured / modality</dt><dd>{new Date(record.at_secs * 1000).toLocaleString()} / {record.input.modality}</dd></dl></details>{children}
  </article>
}
