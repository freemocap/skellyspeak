import { Disclosure } from '../Disclosure'
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { PracticeContext } from '../panes/PracticeContext'
import { domainColors, skillDomain } from '../../lib/skill-domains'
import { TopicExplanation } from '../panes/TopicExplanation'

export function ConversationMap() {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => { if (!host.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [open])
  if (!snapshot || !practice) return null
  const selected = snapshot.catalog.find(node => node.id === practice.selected && node.kind !== 'root') ?? snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!selected) throw new Error('Missing selected practice skill')
  const active = skillDomain(snapshot, selected)
  const branches = snapshot.catalog.filter(node => node.kind === 'domain')
  return <aside ref={host} className={`conversation-map ${open ? 'is-open' : ''}`} aria-label="Conversation skill map">
    <button className="conversation-map-toggle" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={open ? 'Collapse skill map' : 'Expand skill map'}>
      <svg viewBox="0 0 180 180" aria-hidden="true">{branches.map((branch, i) => {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / branches.length
        const x = 90 + 65 * Math.cos(angle), y = 90 + 65 * Math.sin(angle)
        const skills = snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === branch.id)
        const successes = skills.reduce((sum, node) => sum + Math.min(3, snapshot.profile.skills.find(item => item.skill_id === node.id)!.successes), 0)
        const fill = successes / (skills.length * 3)
        return <g key={branch.id} data-reward-domain={branch.id} style={{ color: domainColors(branch.id).bright }}>
          <line x1="90" y1="90" x2={x} y2={y} stroke="currentColor" strokeWidth="7" opacity=".23" />
          <line x1="90" y1="90" x2={90 + (x - 90) * fill} y2={90 + (y - 90) * fill} stroke="currentColor" strokeWidth="7" />
          {active.id === branch.id && <line x1="90" y1="90" x2={x} y2={y} stroke="#f4f6f8" strokeWidth="3" />}
          <circle cx={x} cy={y} r={active.id === branch.id ? 11 : 6} fill="currentColor" stroke={active.id === branch.id ? '#f4f6f8' : 'none'} strokeWidth="4" />
        </g>
      })}<circle cx="90" cy="90" r="22" fill="#14202e" /><text x="90" y="94" textAnchor="middle" fill="#e8eef7" fontSize="14">{snapshot.profile.xp}</text></svg>
      <span>{open ? 'Close map ▴' : 'Skill map ▾'}</span>
    </button>
    {open && <div className="conversation-map-branches">{branches.map(branch => {
      const skills = snapshot.catalog.filter(node => node.kind === 'skill' && skillDomain(snapshot, node).id === branch.id)
      const stars = skills.filter(node => snapshot.profile.skills.find(item => item.skill_id === node.id)!.star).length
      return <button key={branch.id} style={{ '--domain-color': domainColors(branch.id).bright } as CSSProperties} aria-pressed={active.id === branch.id} onClick={() => practice.select((skills.find(node => node.id === snapshot.profile.active_focus) ?? skills[0]).id)}>{branch.label}<small>{stars}/{skills.length} stars</small></button>
    })}<p>Arms fill as skills reach three unassisted successes. XP also includes assisted practice.</p></div>}

  </aside>
}

export function PracticeHint({ level, busy }: { level: string; busy: boolean }) {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  if (!snapshot || !practice?.chatId) return null
  const selected = snapshot.catalog.find(node => node.id === practice.selected && node.kind !== 'root') ?? snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!selected) throw new Error('Missing selected practice skill')
  return <Disclosure className="mobile-practice-hint" key={selected.id} label={`${selected.label} · Hint`}><p>{selected.criterion}</p><TopicExplanation chatId={practice.chatId} level={level} topic={`${selected.label}: ${selected.criterion}`} busy={busy} /></Disclosure>
}
