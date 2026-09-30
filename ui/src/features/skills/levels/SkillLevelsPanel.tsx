import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { SkillRadar } from '../../../components/learning/SkillRadar'
import { skillColors } from '../../../domain/learning/catalog/skill-domains'
import { levelThreshold, skillLevels } from '../../../domain/learning/statistics/skill-levels'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

/** A language's skill level: the badge and the band toward the next level, the
 * radar, what the pointed or pinned skill covers, and every skill's own level.
 * Pressing an arm (or a row) pins that skill and filters the list to it; pressing
 * it again, or Show all, clears the pin. `conversation`, when given, is one
 * conversation's evidence, overlaid on the radar as its own shape. */
export function SkillLevelsPanel({ snapshot, conversation }: { snapshot: SkillSnapshot; conversation: SkillSnapshot | null }) {
  const tr = useI18n()
  const [pinned, setPinned] = useState<string | null>(null)
  const [pointed, setPointed] = useState<string | null>(null)
  const levels = skillLevels(snapshot)
  const conversationPoints = conversation ? skillLevels(conversation).skills.map(skill => skill.points) : null
  const conversationTotal = conversationPoints?.reduce((sum, value) => sum + value, 0) ?? 0
  const shown = pinned ? levels.skills.filter(skill => skill.id === pinned) : levels.skills
  const pinnedSkill = levels.skills.find(skill => skill.id === pinned)
  const focused = levels.skills.find(skill => skill.id === (pointed ?? pinned))
  return <section className="skill-levels" aria-label={tr('Skill levels')}>
    <header className="skill-levels-head">
      <span className="skill-level-badge" aria-hidden="true"><small>{tr('Lv')}</small>{tr.number(levels.level)}</span>
      <div className="skill-levels-summary">
        <strong>{tr('Skill level {value0}', { value0: levels.level })}</strong>
        <span><progress className="skill-levels-band" value={levels.progress} max={1} aria-label={tr('Progress to the next skill level')} />
          {levels.level === 0 && levels.ready === 0
            ? tr('Get a skill point in each skill to reach level 1.')
            : tr('{value0} of {value1} skills at {value2} points for level {value3}', { value0: levels.ready, value1: levels.skills.length, value2: levels.target, value3: levels.level + 1 })}</span>
      </div>
      <strong className="skill-levels-xp">{tr('{value0} XP', { value0: levels.xp })}</strong>
    </header>
    <SkillRadar levels={levels} pinned={pinned} onPin={setPinned} pointed={pointed} onPoint={setPointed} conversation={conversationTotal > 0 ? conversationPoints : null} />
    {conversationPoints && <p className="skill-levels-legend">
      <span className="skill-levels-legend-mark" aria-hidden="true" />
      {conversationTotal > 0
        ? tr('This conversation: {value0} skill points, scaled so its busiest skill reaches the gold ring', { value0: conversationTotal })
        : tr('No skill points in this conversation yet')}
    </p>}
    <div className="skill-levels-focus" style={focused ? { color: skillColors(focused.id).ink } : undefined}>
      {focused
        ? <><strong>{tr(focused.label)}</strong><span>{tr(focused.description)}</span></>
        : <span>{tr('Point at a skill to see what it covers. Press it to show only that skill below.')}</span>}
    </div>
    <div className="skill-levels-list-head">
      <h3>{tr('Skills')}</h3>
      {pinnedSkill
        ? <button type="button" className="skill-levels-filter" onClick={() => setPinned(null)}>{tr('Showing {value0}', { value0: tr(pinnedSkill.label) })}<span>{tr('Show all')}</span></button>
        : <span className="skill-levels-hint">{tr('Press an arm to filter')}</span>}
    </div>
    <ol className="skill-levels-list">{shown.map(skill => {
      const low = levelThreshold(skill.level)
      const colours = skillColors(skill.id)
      return <li key={skill.id}>
        <button type="button" className="skill-levels-row" aria-pressed={pinned === skill.id} onClick={() => setPinned(pinned === skill.id ? null : skill.id)}
          onPointerEnter={() => setPointed(skill.id)} onPointerLeave={() => setPointed(current => current === skill.id ? null : current)} style={{ color: colours.mark }}>
          <span className="skill-levels-dot" aria-hidden="true" />
          <span className="skill-levels-name" style={{ color: colours.ink }}>{tr(skill.label)}</span>
          <span className="skill-levels-level">{tr('Lv {value0}', { value0: skill.level })}</span>
          <progress value={skill.points - low} max={skill.nextThreshold - low} aria-label={tr('{value0} of {value1} points', { value0: skill.points, value1: skill.nextThreshold })} />
          <span className="skill-levels-points">{tr.number(skill.points)}/{tr.number(skill.nextThreshold)}</span>
          <span className="skill-levels-row-xp">{tr('{value0} XP', { value0: skill.xp })}</span>
        </button>
      </li>
    })}</ol>
  </section>
}
