import { useIsMobile } from '../../hooks/useIsMobile'
import { useContext, useState, type CSSProperties } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { PracticeContext } from '../panes/PracticeContext'
import { domainColors, skillDomain } from '../../lib/skill-domains'

export function ConversationMap() {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(() => !isMobile)
  if (!snapshot || !practice) return null
  const selected = snapshot.catalog.find(node => node.id === practice.selected && node.kind !== 'root') ?? snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!selected) throw new Error('Missing selected practice skill')
  const active = skillDomain(snapshot, selected)
  const branches = snapshot.catalog.filter(node => node.kind === 'domain')
  return <aside className={`conversation-map ${open ? 'is-open' : ''}`} aria-label="Conversation skill map">
    <button className="conversation-map-toggle" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={open ? 'Collapse skill map' : 'Expand skill map'}>
      {open && <svg viewBox="0 0 180 180" aria-hidden="true">{branches.map((branch, i) => {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / branches.length
        const x = 90 + 65 * Math.cos(angle), y = 90 + 65 * Math.sin(angle)
        const skills = snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === branch.id)
        const successes = skills.reduce((sum, node) => sum + Math.min(3, snapshot.profile.skills.find(item => item.skill_id === node.id)!.successes), 0)
        const fill = successes / (skills.length * 3)
        return <g key={branch.id} style={{ color: domainColors(branch.id).bright }}>
          <line x1="90" y1="90" x2={x} y2={y} stroke="currentColor" strokeWidth="7" opacity=".23" />
          <line x1="90" y1="90" x2={90 + (x - 90) * fill} y2={90 + (y - 90) * fill} stroke="currentColor" strokeWidth="7" />
          {active.id === branch.id && <line x1="90" y1="90" x2={x} y2={y} stroke="#f4f6f8" strokeWidth="3" />}
          <circle data-reward-domain={branch.id} cx={x} cy={y} r={active.id === branch.id ? 11 : 6} fill="currentColor" stroke={active.id === branch.id ? '#f4f6f8' : 'none'} strokeWidth="4" />
        </g>
      })}<circle data-reward-total="xp" cx="90" cy="90" r="22" fill="#14202e" /><text x="90" y="94" textAnchor="middle" fill="#e8eef7" fontSize="14">★</text></svg>}
      <span>{open ? 'Collapse map ▴' : 'Skill map ▾'}</span>
    </button>
    {open && <div className="conversation-map-branches">{branches.map(branch => {
      const skills = snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === branch.id)
      const stars = skills.filter(node => snapshot.profile.skills.find(item => item.skill_id === node.id)!.star).length
      return <button key={branch.id} data-reward-domain={branch.id} style={{ '--domain-color': domainColors(branch.id).bright } as CSSProperties} aria-pressed={active.id === branch.id} onClick={() => practice.select((skills.find(node => node.id === snapshot.profile.active_focus) ?? skills[0]).id)}>{branch.label}<small>{stars}/{skills.length} stars</small><progress aria-label={`${branch.label} stars`} value={stars} max={skills.length} /></button>
    })}</div>}

  </aside>
}
