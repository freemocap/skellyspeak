import { useSkillNavigation } from '../../hooks/useSkillNavigation'
import { useContext } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'
import { DetailDialog } from '../DetailDialog'

export function RewardBadge({ domainId, label, xp, quote }: { domainId: string; label: string; xp: number; quote: string }) {
  return <div className="reward-badge" style={{ borderColor: domainColors(domainId).bright }}>
    <div className="reward-badge-heading"><span className="reward-domain-dot" style={{ background: domainColors(domainId).bright }} /><span>{label}</span><strong style={{ background: domainColors(domainId).ink }}>+{xp} XP</strong></div>
    <blockquote dir="auto">{quote}</blockquote>
  </div>
}

export function RewardDetail({ evidence, onClose }: { evidence: MessageEvidence[]; onClose: () => void }) {
  const navigation = useSkillNavigation()
  const { snapshot } = useContext(SkillEvidenceContext)
  const unique = [...new Map(evidence.map(item => [item.id, item])).values()]
  return <DetailDialog title="XP details" onClose={onClose}>
    {unique.map(item => <section key={item.id}><RewardBadge {...item} /><p className="reward-rationale">{item.rationale}</p><small className="reward-credit-note">Credited for this message · viewing adds no XP</small>{snapshot && <button className="lesson-action" onClick={() => { onClose(); navigation.explore({ target: snapshot.target, skillId: item.skillId }) }}>Explore this skill</button>}</section>)}
  </DetailDialog>
}
