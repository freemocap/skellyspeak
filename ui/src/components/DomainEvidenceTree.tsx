import { useMemo, type CSSProperties } from 'react'
import type { SkillSnapshot } from '../domain/skills/skills'
import { skillIndex } from '../domain/skills/skill-index'
import { useI18n } from './i18n'

/** A second view of credited observations. Geometry is presentation, never a level. */
export function DomainEvidenceTree({ snapshot, onSelect }: { snapshot: SkillSnapshot; onSelect: (id: string) => void }) {
  const tr = useI18n()
  const domains = useMemo(() => {
    const catalog = skillIndex(snapshot).catalog
    return catalog.nodes.filter(node => node.kind === 'domain').map(domain => {
      const skills = new Set(catalog.descendants(domain.id))
      const attempts = new Set(snapshot.profile.credits.filter(credit => credit.xp > 0 && skills.has(credit.skill_id)).map(credit => credit.attempt_id))
      return { ...domain, count: attempts.size }
    })
  }, [snapshot])
  const maximum = Math.max(1, ...domains.map(domain => domain.count))
  return <section className="domain-evidence-tree" aria-label={tr('Evidence')}>
    <svg viewBox="0 0 600 220" role="img" aria-label={tr('Language skill tree')}>
      {domains.map((domain, index) => {
        const angle = Math.PI * (0.12 + index / Math.max(1, domains.length - 1) * 0.76)
        const x = 300 - Math.cos(angle) * 220
        const y = 200 - Math.sin(angle) * 170
        const depth = domain.count >= 12 ? 3 : domain.count >= 6 ? 2 : domain.count ? 1 : 0
        return <g key={domain.id} style={{ '--node-color': domain.color } as CSSProperties}>
          <path className={domain.count ? '' : 'unobserved'} d={`M300 205 Q300 ${y + 50} ${x} ${y}`} />
          {Array.from({ length: depth }, (_, level) => <path key={level} d={`M${300 + (x - 300) * (level + 1) / 4} ${205 + (y - 205) * (level + 1) / 4} l-18 -24 m18 24 l18 -24`} />)}
          <circle cx={x} cy={y} r={4} />
        </g>
      })}
    </svg>
    {domains.map(domain => <button type="button" key={domain.id} className="domain-evidence-row" onClick={() => onSelect(domain.id)} style={{ '--node-color': domain.color } as CSSProperties}>
      <span>{domain.label}</span><small>{domain.count ? tr('{count} credited observations', { count: domain.count }) : tr('Not enough evidence to estimate')}</small>
      {domain.count > 0 && <meter min={0} max={maximum} value={domain.count} aria-label={domain.label} />}
    </button>)}
  </section>
}
