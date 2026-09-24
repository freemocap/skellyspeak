import { TargetText } from '../../../components/reading/TargetText'
import { useI18n } from '../../../components/localization/i18n'
import { domainColors } from '../../../domain/learning/catalog/skill-domains'

/** Static evidence badge used by the reward design-review preview. */
export function RewardBadge({ domainId, label, xp, quote, creditKind, interactive = false }: { interactive?: boolean; domainId: string; label: string; xp: number; quote: string; creditKind: 'earned' | 'stored' }) {
  const tr = useI18n()
  return <div className="reward-badge" style={{ borderColor: domainColors(domainId).bright }}>
    <div className="reward-badge-heading"><span className="reward-domain-dot" style={{ background: domainColors(domainId).bright }} /><span>{tr(label)}</span><strong style={{ background: domainColors(domainId).ink }}>{creditKind === 'earned' ? '+' : ''}{tr.number(xp)} {tr(" XP")}</strong></div>
    <blockquote dir="auto"><TargetText text={quote} interactive={interactive} /></blockquote>
  </div>
}
