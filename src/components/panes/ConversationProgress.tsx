import { useContext, useState } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { conversationEvidence } from '../../lib/skills'
import { skillDomain } from '../../lib/skill-domains'
import { PracticeContext } from './PracticeContext'
import { ConversationMap } from '../chat/ConversationMap'
import { ProgressSummary } from './ProgressSummary'
import { InfoTip } from '../InfoTip'

export function ConversationProgress({ chatId }: { chatId: string }) {
  const evidence = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [global, setGlobal] = useState(false)
  if (!evidence.snapshot || !practice) return null
  const snapshot = conversationEvidence(evidence.snapshot, chatId)
  const selected = snapshot.catalog.find(node => node.id === (practice.selected ?? snapshot.profile.active_focus))
  const domain = selected && skillDomain(snapshot, selected)
  const skills = new Set(snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === domain?.id).map(node => node.id))
  const records = snapshot.records.filter(record => record.assessment?.judgments.some(item => skills.has(item.skill_id)))
  return <>
    <SkillEvidenceContext value={{ snapshot, error: evidence.error }}><ConversationMap /></SkillEvidenceContext>
    <div className="analysis-scroll conversation-evidence">
      <div className="lesson-actions"><strong>{domain?.label ?? 'Conversation XP'}</strong><InfoTip>XP attributed to saved learner messages in this conversation. Repeated wording already credited elsewhere does not earn additional XP.</InfoTip><button className="lesson-action" onClick={() => setGlobal(true)}>Show language progression</button></div>
      {records.length === 0 && <p className="lesson-meta">No evidence yet.</p>}
      {records.map(record => <article className="practice-credit" key={record.attempt_id}><time>{new Date(record.at_secs * 1000).toLocaleString()}</time>{record.assessment?.judgments.filter(item => skills.has(item.skill_id)).map(item => <div key={item.skill_id}><strong>{snapshot.catalog.find(node => node.id === item.skill_id)?.label} · {snapshot.profile.credits.find(credit => credit.attempt_id === record.attempt_id && credit.skill_id === item.skill_id)?.xp ?? 0} XP</strong><blockquote dir="auto">{item.quotes.join(' · ')}</blockquote><p>{item.rationale}</p></div>)}</article>)}
    </div>
    {global && <ProgressSummary snapshot={evidence.snapshot} onClose={() => setGlobal(false)} />}
  </>
}
