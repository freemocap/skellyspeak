import { useI18n } from '../../../components/localization/i18n'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import type { TreeNode } from '../../../domain/learning/catalog/skillTree'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'

export function SkillOverview({ node, snapshot }: { node: TreeNode; snapshot: SkillSnapshot }) {
  const tr = useI18n()
  const domain = node.kind === 'root' ? null : skillDomain(snapshot, node)
  const progress = snapshot.profile.skills.find(item => item.skill_id === node.id)
  return <header className="skill-overview" style={domain ? { borderColor: domainColors(domain.id).bright } : undefined}>
    {domain && <small>{tr(domain.label)}</small>}<h2>{tr(node.label)}</h2><p>{tr(node.criterion || node.description)}</p>
    {progress && <div className="skill-overview-progress"><strong>{tr.number(progress.xp)} {tr(" XP")}</strong><span>{tr('Next milestone: {value0} XP', { value0: (Math.floor(progress.xp / 50) + 1) * 50 })}</span>{progress.assisted > 0 && <span>{tr.number(progress.assisted)} {tr(" assisted")}</span>}</div>}
  </header>
}
