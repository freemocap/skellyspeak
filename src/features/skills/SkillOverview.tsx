import type { SkillSnapshot } from '../../domain/skills/skills'
import type { TreeNode } from '../../domain/skills/skillTree'
import { domainColors, skillDomain } from '../../domain/skills/skill-domains'

export function SkillOverview({ node, snapshot }: { node: TreeNode; snapshot: SkillSnapshot }) {
  const domain = node.kind === 'root' ? null : skillDomain(snapshot, node)
  const progress = snapshot.profile.skills.find(item => item.skill_id === node.id)
  return <header className="skill-overview" style={domain ? { borderColor: domainColors(domain.id).bright } : undefined}>
    {domain && <small>{domain.label}</small>}<h2>{node.label}</h2><p>{node.criterion || node.description}</p>
    {progress && <div className="skill-overview-progress"><strong>{progress.xp} XP</strong><span>{progress.star ? '★ Star earned' : `${Math.min(progress.successes, 3)}/3 unassisted successes`}</span>{progress.assisted > 0 && <span>{progress.assisted} assisted</span>}</div>}
  </header>
}
