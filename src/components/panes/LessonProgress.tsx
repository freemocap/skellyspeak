import { ActivityIndicator } from '../ActivityIndicator'
import { useContext } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { SkillPracticeBoard } from './SkillPracticeBoard'
import { SkillEvidenceRecord } from './SkillEvidenceRecord'
import { ProgressRules } from './ProgressRules'
export function LessonProgress({ chatId, busy, level }: { chatId: string; busy: boolean; level: string }) {
  const { snapshot, error } = useContext(SkillEvidenceContext)
  if (error) return <section className="lesson-progress" role="alert">Progress unavailable: {error}</section>
  if (!snapshot) return <section className="lesson-progress" role="status">Loading practice progress…</section>
  const records = snapshot.records.filter((record) => record.chat_id === chatId && record.status !== 'superseded')
  const recent = records.slice(0, 3)
  const pending = records.some((record) => record.status === 'pending')
  return <section className="lesson-progress" aria-label="Practice progress">
    {(pending || busy) && <ActivityIndicator label={pending ? 'Reviewing your words…' : 'Reply in progress…'} />}
    {records.filter(record => record.status === 'failed').map(record => <p key={record.attempt_id} role="alert">Review failed: {record.error}</p>)}
    <SkillPracticeBoard key={`${chatId}:${snapshot.target}`} snapshot={snapshot} chatId={chatId} level={level} busy={busy} />
    <details className="practice-reviews"><summary>Recent message reviews</summary>
    {recent.map(record => <article className="practice-turn" key={record.attempt_id}>
      <blockquote dir="auto">{record.source}</blockquote>
      {!record.assessment && <><p>{record.status}{record.error ? `: ${record.error}` : ''}</p></>}
      {record.assessment?.judgments.map(judgment => <SkillEvidenceRecord key={judgment.skill_id} record={record} judgment={judgment} snapshot={snapshot}>{null}</SkillEvidenceRecord>)}
      {record.status === 'complete' && !record.assessment?.judgments.length && <p>No skill evidence identified in this message yet.</p>}
    </article>)}
    </details>
    <ProgressRules />
  </section>
}
