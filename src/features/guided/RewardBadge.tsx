import { useSkillNavigationStore } from '../../state/skill-navigation'
import { useContext, useRef, type RefObject } from 'react'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { domainColors } from '../../domain/skills/skill-domains'
import type { MessageEvidence } from '../../domain/skills/message-evidence'
import { useOverlayLayer } from '../../ui/useOverlayLayer'

export function RewardBadge({ domainId, label, xp, quote, creditKind }: { domainId: string; label: string; xp: number; quote: string; creditKind: 'earned' | 'stored' }) {
  return <div className="reward-badge" style={{ borderColor: domainColors(domainId).bright }}>
    <div className="reward-badge-heading"><span className="reward-domain-dot" style={{ background: domainColors(domainId).bright }} /><span>{label}</span><strong style={{ background: domainColors(domainId).ink }}>{creditKind === 'earned' ? '+' : ''}{xp} XP</strong></div>
    <blockquote dir="auto">{quote}</blockquote>
  </div>
}

function InspectionLayer({ host, onClose }: { host: RefObject<HTMLElement | null>; onClose: () => void }) {
  useOverlayLayer(host, onClose, true)
  return null
}

export function RewardDetail({ evidence, onClose, interactive, automatic }: { automatic: boolean; evidence: MessageEvidence[]; onClose: () => void; interactive: boolean }) {
  const host = useRef<HTMLElement>(null)
  const explore = useSkillNavigationStore((state) => state.explore)
  const { snapshot } = useContext(SkillEvidenceContext)
  const groups = new Map<string, MessageEvidence[]>()
  for (const item of evidence) {
    const group = groups.get(item.id) ?? []
    if (!group.some(existing => existing.quote === item.quote)) group.push(item)
    groups.set(item.id, group)
  }
  return <section ref={host} className="reward-inspection-card" role="dialog" aria-label="XP details" inert={!interactive}>{!automatic && interactive && <InspectionLayer host={host} onClose={onClose} />}<button className="reward-inspection-close" aria-label="Close XP details" onClick={onClose}>×</button>
    {[...groups.values()].map(group => {
      const item = group[0]
      return <section key={item.id}><RewardBadge {...item} creditKind="stored" />
      {group.slice(1).map(quote => <blockquote key={quote.quote} dir="auto">{quote.quote}</blockquote>)}
      {group.some(quote => quote.ambiguous) && <p className="reward-credit-note">This wording appears more than once. The review identifies the phrase, but does not specify which occurrence.</p>}<p className="reward-rationale">{item.rationale}</p><small className="reward-credit-note">Total credited for this skill in this message. The animation shows only newly added XP.</small>{snapshot && <button className="lesson-action" onClick={() => { onClose(); explore({ target: snapshot.target, skillId: item.skillId }) }}>Explore this skill</button>}</section>})}
  </section>
}
