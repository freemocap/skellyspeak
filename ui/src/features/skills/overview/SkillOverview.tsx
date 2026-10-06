import type { ReactNode } from 'react'
import { experienceProfile } from '../../../domain/learning/statistics/experience-profile'
import { useI18n } from '../../../components/localization/i18n'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import type { TreeNode } from '../../../domain/learning/catalog/skillTree'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'

/** A skill's header: name, what it covers, what counts, its XP and level, and the owner's actions (`children`). */
export function SkillOverview({ node, snapshot, variety, children }: { node: TreeNode; snapshot: SkillSnapshot; variety?: string; children: ReactNode }) {
  const tr = useI18n()
  const domain = node.kind === 'root' ? null : skillDomain(snapshot, node)
  // Variety-filtered evidence has no native level projection. Keep every value in scope.
  const level = variety === undefined ? snapshot.profile.levels?.skills.find(item => item.skillId === node.id) : undefined
  const progress = variety === undefined ? snapshot.profile.skills.find(item => item.skill_id === node.id) : experienceProfile(snapshot, variety).skills.find(item => item.id === node.id)
  return <header className="skill-overview" style={domain ? { borderColor: domainColors(domain.id).bright } : undefined}>
    {domain && domain.id !== node.id && <small>{tr(domain.label)}</small>}<h2>{tr(node.label)}</h2>
    {node.description && <p className="skill-overview-lead">{tr(node.description)}</p>}
    {node.criterion && <p className="skill-overview-criterion"><strong>{tr('Counts when')}</strong> {tr(node.criterion)}</p>}
    {progress && <div className="skill-overview-progress"><strong>{tr.number(progress.xp)} {tr(" XP")}</strong>{level && <span>{tr('Skill level {value0} · {value1} of {value2} points', { value0: level.level, value1: level.points, value2: level.nextThreshold })}</span>}<span>{tr('Experience')}: {tr.number(progress.experience)}</span>{progress.effort > 0 && <span>{tr.number(progress.effort)} {tr(" effort")}</span>}</div>}
  {children && <div className="skill-overview-actions">{children}</div>}
  </header>
}
