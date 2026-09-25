import { useState } from 'react'
import catalog from '../../generated/skill-catalogs/catalog.json'
import { useI18n } from '../localization/i18n'

/** Definitions remain browsable even when the separate practice ledger cannot be read. */
export function SkillCatalogBrowser() {
  const tr = useI18n()
  const skills = catalog.filter(node => node.kind === 'skill')
  const [selected, select] = useState<string | null>(null)
  const skill = skills.find(node => node.id === selected)
  return <section>
    <h2>{tr('Skills')}</h2>
    <div className="scene-grid">{skills.map(node => <button type="button" className="scene-card" key={node.id} aria-pressed={selected === node.id} onClick={() => select(node.id)}>
      <span className="scene-label">{tr(node.label)}</span><span>{'—'}{tr(' XP')}</span>
    </button>)}</div>
    {skill && <section className="skill-overview"><h2>{tr(skill.label)}</h2><p>{tr(skill.description)}</p><p>{tr(skill.criterion)}</p></section>}
  </section>
}
