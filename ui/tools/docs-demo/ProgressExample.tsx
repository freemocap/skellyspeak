import { useState } from 'react'
import { SkillChart, type SkillChartView } from '../../src/components/learning/SkillChart'
import { ProgressCounters } from '../../src/components/learning/ProgressCounters'
import { effortDimensions } from '../../src/components/learning/effort-dimensions'
import { ToolbarIcon } from '../../src/components/controls/ToolbarIcon'
import { skillDemo } from '../../src/domain/learning/catalog/skillDemo'
import { languageSkillLevels } from '../../src/domain/learning/statistics/skill-levels'

// A deliberately empty level projection from the production fixture. No fabricated
// credits or copied thresholds: native owns earning and level calculations.
const levels = languageSkillLevels(skillDemo)
const exampleCounts = [12, 3, 8, 2, 5]

export function ProgressExample({ onSkills }: { onSkills: () => void }) {
  const [selected, setSelected] = useState(effortDimensions[0])
  const [tab, setTab] = useState('xp')
  const tabs = ['skills', 'xp', 'effort']
  return <>
    <h1>Read your progress</h1><p>These fixed activity counts demonstrate the icons. They do not measure proficiency or change when you try another example.</p>
    <div className="progress-tabs" role="tablist" aria-label="Progress tabs">{tabs.map((id, index) => <button key={id} type="button" role="tab" id={`demo-tab-${id}`} aria-controls={`demo-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      event.preventDefault()
      const next = tabs[(index + step + tabs.length) % tabs.length]
      setTab(next); document.getElementById(`demo-tab-${next}`)?.focus()
    }}>{id === 'xp' ? 'XP' : id === 'skills' ? 'Skills' : 'Effort'}</button>)}</div>
    <section role="tabpanel" id={`demo-panel-${tab}`} aria-labelledby={`demo-tab-${tab}`}>
    {tab === 'skills' ? <><p>Skills shows the language chart and its evidence. The language level follows its weakest skill; XP alone does not determine that level.</p><button type="button" className="btn primary" onClick={onSkills}>Explore the skill chart</button></> : tab === 'xp' ? <>
    <div className="docs-demo-progress"><ProgressCounters xp={0} scope="sample Spanish" effort={null} effects={false} code="ES" /><span>Sample Spanish · no skill credits</span></div>
    <p>XP combines skill and effort credit. The app’s XP report breaks the total down by skill and history. This sample has zero XP; the illustrative activity counts on Effort are a separate fixture.</p>
    <button type="button" className="btn" onClick={() => setTab('effort')}>Inspect sample effort counts</button>
    </> : <>
    <div className="docs-demo-counts">{effortDimensions.map((unit, index) => <button type="button" key={unit.field} aria-pressed={selected === unit} onClick={() => setSelected(unit)}><ToolbarIcon name={unit.icon} size={24} /><strong>{exampleCounts[index]}</strong><span>{unit.label}</span></button>)}</div>
    <p className="docs-demo-explanation" role="status"><strong>{selected.label}: </strong>{selected.description}</p>
    <p>Activity and skill credit are different records. Open Skills to see which language abilities have evidence and which still need practice.</p>
    </>}
    </section>
  </>
}

export function SkillsExample() {
  const [selected, setSelected] = useState(levels.skills[0].id)
  const [type, setType] = useState<SkillChartView['type']>('radial')
  const [scale, setScale] = useState<SkillChartView['scale']>('normalized')
  const skill = levels.skills.find(item => item.id === selected)!
  return <>
    <h1>Explore a language’s skills</h1><p>Choose an arm or a skill name. Use the controls above the chart to switch to bars, change scale, or zoom. This sample starts with no credited evidence.</p>
    <div className="docs-demo-skills-grid">
      <SkillChart levels={levels} conversation={null} view={{ type, scale, setType, setScale }} selected={selected} onSelect={setSelected}>
        <p>Sample language level {levels.level}. The goal is {levels.target} point in each skill. An empty chart means no credited evidence in this sample, not inability.</p>
      </SkillChart>
      <section className="docs-demo-skill-detail" aria-live="polite"><h2>{skill.label}</h2><p>{skill.description}</p><h3>Counts when</h3><p>{skill.criterion}</p><p>{skill.points} points · Level {skill.level}</p><p>In the app, inspect the underlying messages and assessments before interpreting a skill total.</p></section>
    </div>
    <div className="docs-demo-icon-list" aria-label="Select a skill">{levels.skills.map(item => <button type="button" className="btn" key={item.id} aria-pressed={item.id === selected} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div>
  </>
}
