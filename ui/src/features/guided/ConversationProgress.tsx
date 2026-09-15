import { RewardsLedger } from './RewardsLedger'
import { useI18n } from '../../components/i18n'
import { EvidenceMappingNotice } from '../../components/EvidenceMappingNotice'
import { useContext, useState, type ReactNode } from 'react'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { conversationEvidence } from '../../domain/skills/skills'
import { skillDomain } from '../../domain/skills/skill-domains'
import { PracticeContext } from './PracticeContext'
import { ConversationMap } from './ConversationMap'
import { ProgressSummary } from './ProgressSummary'
import { InlineXpBadge } from './InlineXpBadge'
import { RewardInspectionContext } from './RewardInspectionContext'
import { messageEvidence } from '../../domain/skills/message-evidence'
import { InfoTip } from '../../components/InfoTip'

export function ConversationProgress({ chatId, children }: { chatId: string; children?: ReactNode }) {
  const tr = useI18n()
  const evidence = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const inspection = useContext(RewardInspectionContext)
  const [global, setGlobal] = useState(false)
  if (!evidence.snapshot || !practice) return null
  const snapshot = conversationEvidence(evidence.snapshot, chatId)
  const selected = snapshot.catalog.find(node => node.id === (practice.selected ?? snapshot.profile.active_focus))
  const domain = selected && skillDomain(snapshot, selected)
  const skills = new Set(snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === domain?.id).map(node => node.id))
  const records = snapshot.records.filter(record => record.assessment?.judgments.some(item => skills.has(item.skill_id)))
  return <>
    <EvidenceMappingNotice snapshot={snapshot} />
    <SkillEvidenceContext value={{ snapshot, error: evidence.error }}><ConversationMap /></SkillEvidenceContext>
    <div className="analysis-scroll conversation-evidence">
      {children}
      <RewardsLedger snapshot={snapshot} />
      <details><summary>{tr("Conversation XP")}</summary>
      <div className="lesson-actions"><strong>{domain?.label ?? tr("Conversation XP")}</strong><InfoTip>{tr("XP attributed to saved learner messages in this conversation. Repeated wording already credited elsewhere does not earn additional XP.")}</InfoTip><button className="lesson-action" onClick={() => setGlobal(true)}>{tr("Show language progression")}</button></div>
      <p>{tr("Lesson quiz XP")}: {snapshot.profile.quiz_credits.reduce((sum, credit) => sum + credit.xp, 0)}</p>
      {records.length === 0 && <p className="lesson-meta">{tr("No evidence yet.")}</p>}
      {records.map(record => <article className="practice-credit" key={record.attempt_id}><time>{new Date(record.at_secs * 1000).toLocaleString(tr.locale)}</time>
        <div className="study-credit-badges">{messageEvidence(snapshot, chatId, record.turn_id, record.source).map(item => <InlineXpBadge key={item.id} item={item} generation={0} onOpen={() => { if (!inspection) throw new Error('XP inspection provider is missing'); inspection.open([item], record.turn_id, record.source) }} />)}</div>{record.assessment?.judgments.filter(item => skills.has(item.skill_id)).map(item => <div key={item.skill_id}><strong>{snapshot.catalog.find(node => node.id === item.skill_id)?.label} · {snapshot.profile.credits.find(credit => credit.attempt_id === record.attempt_id && credit.skill_id === item.skill_id)?.xp ?? 0} {tr(" XP")}</strong><blockquote dir="auto">{item.quotes.join(' · ')}</blockquote><p>{item.rationale}</p></div>)}</article>)}
      </details>
    </div>
    {global && <ProgressSummary snapshot={evidence.snapshot} onClose={() => setGlobal(false)} />}
  </>
}
