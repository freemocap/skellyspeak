import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../localization/i18n'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
import { skillDomain, domainColors } from '../../domain/learning/catalog/skill-domains'

/** Categories are labels, never unlocks. Stable IDs preserve focus across sorting. */
export function SkillList({ snapshot, selected, onSelect, presenting = false }: {
  snapshot: SkillSnapshot; selected?: string; onSelect: (id: string) => void; presenting?: boolean
}) {
  const tr = useI18n()
  const [category, setCategory] = useState('')
  const rows = useMemo(() => snapshot.catalog.filter(n => n.kind === 'skill').map((node, order) => {
    const progress = snapshot.profile.skills.find(s => s.skill_id === node.id)
    if (!progress) throw new Error(`Missing skill progress: ${node.id}`)
    return { node, order, xp: progress.xp, domain: skillDomain(snapshot, node) }
  }).sort((a, b) => b.xp - a.xp || a.order - b.order), [snapshot])
  const [displayed, setDisplayed] = useState(rows)
  useEffect(() => {
    if (presenting) return
    // Let new reward receipts enter the presentation queue before moving rows.
    const timer = window.setTimeout(() => setDisplayed(rows), 250)
    return () => window.clearTimeout(timer)
  }, [rows, presenting])
  return <section aria-label={tr('Skills')}>
    <label>{tr('Category')} <select value={category} onChange={e => setCategory(e.target.value)}>
      <option value="">{tr('All categories')}</option>
      {snapshot.catalog.filter(n => n.kind === 'domain').map(n => <option key={n.id} value={n.id}>{tr(n.label)}</option>)}
    </select></label>
    <ol className="skill-list">{displayed.filter(r => !category || r.domain.id === category).map(({ node, xp, domain }) => <li key={node.id}>
      <button type="button" className="skill-list-row" data-reward-skill={node.id} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)} style={{ color: domainColors(domain.id).ink }}>
        <strong>{tr(node.label)}</strong><span>{tr.number(xp)} XP</span><small>{tr(domain.label)}</small>
        <progress aria-label={tr('{value0} practice XP', {value0:tr(node.label)})} value={xp % 50} max={50} aria-valuetext={tr('{value0} XP; next milestone {value1}', {value0:xp,value1:(Math.floor(xp / 50) + 1) * 50})} />
        <small>{tr('Next milestone: {value0} XP', {value0:(Math.floor(xp / 50) + 1) * 50})}</small>
      </button>
    </li>)}</ol>
  </section>
}
