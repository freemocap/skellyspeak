import { TargetText } from '../../../components/reading/TargetText'
import { RewardsLedger } from './RewardsLedger'
import { useI18n } from '../../../components/localization/i18n'
import { EvidenceMappingNotice } from '../../../components/learning/EvidenceMappingNotice'
import { useContext, useState, type ReactNode } from 'react'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { conversationEvidence } from '../../../domain/learning/evidence/skills'
import { skillDomain } from '../../../domain/learning/catalog/skill-domains'
import { PracticeContext } from '../session/PracticeContext'
import { ConversationMap } from './ConversationMap'
import { ProgressSummary } from './ProgressSummary'
import { MessageXpButton } from './MessageXpButton'
import { InfoTip } from '../../../components/controls/InfoTip'

export function ConversationProgress({ chatId, children }: { chatId: string; children?: ReactNode }) {
  const tr = useI18n()
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
    <div className="analysis-scroll conversation-evidence" role="region" aria-label={tr("Experience")} tabIndex={0}>
    <EvidenceMappingNotice snapshot={snapshot} />
    <SkillEvidenceContext value={{ snapshot, error: evidence.error }}><ConversationMap /></SkillEvidenceContext>
      {children}
      <RewardsLedger snapshot={snapshot} />
      <details><summary>{tr("Conversation XP")}</summary>
      <div className="detail-actions"><strong>{domain ? tr(domain.label) : tr("Conversation XP")}</strong><InfoTip>{tr("XP attributed to saved learner messages in this conversation. Repeated wording already credited elsewhere does not earn additional XP.")}</InfoTip><button className="detail-action" onClick={() => setGlobal(true)}>{tr("Show language progression")}</button></div>
      {records.length === 0 && <p className="detail-meta">{tr("No evidence yet.")}</p>}
      {records.map(record => <article className="practice-credit" key={record.attempt_id}><time>{new Date(record.at_secs * 1000).toLocaleString(tr.browserLocale)}</time>
        <MessageXpButton messageId={record.message_id} source={record.source} />{record.assessment?.judgments.filter(item => skills.has(item.skill_id)).map(item => {
          const skill = snapshot.catalog.find(node => node.id === item.skill_id)
          const xp = snapshot.profile.credits.find(credit => credit.attempt_id === record.attempt_id && credit.skill_id === item.skill_id)?.xp ?? 0
          return <div key={item.skill_id}><strong>{skill && tr(skill.label)} · {tr.number(xp)} {tr(" XP")}</strong><blockquote dir="auto"><TargetText text={item.quotes.length ? item.quotes.join(' · ') : record.source} /></blockquote><p>{item.rationale}</p></div>
        })}</article>)}
      </details>
    </div>
    {global && <ProgressSummary snapshot={evidence.snapshot} onClose={() => setGlobal(false)} />}
  </>
}
