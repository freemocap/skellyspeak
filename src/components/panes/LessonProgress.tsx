import { useContext } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { evidenceLabel } from '../../pages/skillTree'
import type { SkillOutcome } from '../../lib/skills'

const outcomes: Record<SkillOutcome, string> = {
  demonstrated: 'Demonstrated', partial: 'Developing', not_demonstrated: 'Keep practising',
  not_observed: 'Not observed', uncertain: 'Needs more evidence',
}

export function LessonProgress({ chatId, busy }: { chatId: string; busy: boolean }) {
  const { snapshot, error } = useContext(SkillEvidenceContext)
  if (error) return <section className="lesson-progress" role="alert">Progress unavailable: {error}</section>
  if (!snapshot) return <section className="lesson-progress" role="status">Loading practice progress…</section>
  const { profile } = snapshot
  const records = snapshot.records.filter((record) => record.chat_id === chatId && record.status !== 'superseded')
  const recent = records.slice(0, 3)
  const pending = records.some((record) => record.status === 'pending')
  return <section className="lesson-progress" aria-label="Practice progress">
    <header><div><span className="lesson-meta">YOUR PRACTICE</span><h2>Words into progress</h2></div>
      <strong className="lesson-xp" key={`${snapshot.target}:${profile.xp}`}>{profile.xp}<small>XP · {snapshot.target}</small></strong></header>
    <p role="status" aria-live="polite">{pending ? 'Reviewing your words for skill progress…' : busy ? 'Conversation in progress…' : recent.length ? 'Your latest practice, with the evidence behind it.' : 'Send a message to start building your skills.'}</p>
    {recent.map((record) => {
      const excluded = profile.choices.excluded_attempts.includes(record.attempt_id)
      const historical = record.catalog_version !== snapshot.catalog_version
      const credits = profile.credits.filter((credit) => credit.attempt_id === record.attempt_id)
      const xp = credits.reduce((sum, credit) => sum + credit.xp, 0)
      const assistance = [record.input.suggestion && 'Suggested wording', record.input.scaffold && 'Scaffold used', record.input.revision && 'Revised message'].filter(Boolean).join(' · ')
      return <article className="practice-turn" key={`${record.attempt_id}:${record.status}:${xp}`}>
        <div className="practice-turn-heading"><strong>Your message</strong><span className="practice-credit">{record.status === 'pending' ? 'Reviewing…' : record.status === 'failed' ? 'Review failed' : `${xp} XP credited`}</span></div>
        <blockquote dir="auto">{record.source}</blockquote>
        <p className="lesson-meta">{assistance || 'No in-app assistance recorded'}</p>
        {record.status === 'failed' && <p role="alert">{record.error}</p>}
        {excluded && <p>Excluded from progress.</p>}
        {historical && <p>Earlier skill criteria · no current XP.</p>}
        {record.assessment?.judgments.map((judgment) => {
          const credit = credits.find((item) => item.skill_id === judgment.skill_id)
          const progress = profile.skills.find((item) => item.skill_id === judgment.skill_id)
          return <div className="practice-skill" key={judgment.skill_id}>
            <div className="practice-turn-heading"><strong>{evidenceLabel(judgment.skill_id, record.catalog_version)}</strong><span>{credit ? `+${credit.xp} XP` : outcomes[judgment.outcome]}</span></div>
            {judgment.quotes.map((quote, index) => <q dir="auto" key={index}>{quote}</q>)}
            <p>{judgment.rationale}</p>
            {!credit && !excluded && !historical && judgment.outcome === 'demonstrated' && <p className="lesson-meta">This wording is already credited for this skill on another message.</p>}
            {progress && !historical && <div className="practice-milestone"><progress aria-label={`${evidenceLabel(judgment.skill_id, record.catalog_version)} successes toward a star`} value={Math.min(progress.successes, 3)} max={3} /><span>{progress.star ? '★ Star earned' : `${progress.successes}/3 successes to a star`}</span></div>}
          </div>
        })}
        {record.status === 'complete' && !record.assessment?.judgments.length && <p>No skill evidence identified in this message yet.</p>}
      </article>
    })}
    <details className="practice-rules"><summary>How XP works</summary><p>Distinct wording earns 10 XP per demonstrated skill, or 2 XP with suggestions, scaffolds, or revisions. Repeated wording counts once per skill. Unassisted evidence takes precedence over assisted wording. Three unassisted successes earn a star. These are practice milestones, not proficiency grades.</p><p>Credits reflect your current saved evidence and can change when messages are edited or excluded. Your language total includes other conversations.</p></details>
  </section>
}
