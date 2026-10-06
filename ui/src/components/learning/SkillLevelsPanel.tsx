import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { SkillChart, useSkillChartView } from './SkillChart'
import { skillColors } from '../../domain/learning/catalog/skill-domains'
import { holdingBack, languageSkillLevels, type ConversationSkillPoints, type SkillLevel } from '../../domain/learning/statistics/skill-levels'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'

/** Point counts above this draw as a bar instead of one pip per point. */
const MAX_PIPS = 21

/** A language's skill level: the badge and how many skills are ready for the
 * next level, the skill chart (radial or bars, normalized or to scale, with
 * every skill named), the selected skill's card, then
 * the skills still short of the next level and those already ready. Exactly one
 * skill is selected at a time; pressing an arm, row or chip selects it, and the
 * radar, row, chip and card all mark the same skill. Hover never changes the
 * selection, and the card keeps one size for every skill, so nothing moves
 * under the pointer. The first skill holding the level back starts selected.
 * `conversation`, when given, is one conversation's evidence, overlaid on the
 * chart as an outline. `languageName` names the language in the heading and the
 * selected skill's buttons, so the panel always says whose levels these are. */
export function SkillLevelsPanel({ snapshot, languageName, conversation, onInspect, onPractice, practiceSkill }: {
  snapshot: SkillSnapshot; languageName: string; conversation: ConversationSkillPoints | null; onInspect: ((id: string) => void) | null
  onPractice?: (id: string) => void; practiceSkill?: string
}) {
  const tr = useI18n()
  const levels = languageSkillLevels(snapshot)
  const behind = holdingBack(levels)
  const ready = levels.skills.filter(skill => skill.points >= levels.target)
  const [selected, setSelected] = useState<string>(behind[0]?.skill.id ?? levels.skills[0].id)
  const view = useSkillChartView()
  const bars = view.type === 'bars'
  const conversationPoints = conversation ? conversation.skills.map(skill => skill.points) : null
  const conversationTotal = conversationPoints?.reduce((sum, value) => sum + value, 0) ?? 0
  const focused = levels.skills.find(skill => skill.id === selected)
  if (!focused) throw new Error(`Selected skill is not in this language's levels: ${selected}`)
  const nextLevel = levels.level + 1
  return <section className="skill-levels" aria-label={tr('Skill levels')}>
    <header className="skill-levels-head">
      <span className="skill-level-badge" aria-hidden="true"><small>{tr('Lv')}</small>{tr.number(levels.level)}</span>
      <div className="skill-levels-summary">
        <div className="skill-levels-title">
          <strong>{tr('{value0} skill level {value1}', { value0: languageName, value1: levels.level })}</strong>
          <span className="skill-levels-xp">{tr('{value0} XP', { value0: levels.xp })}</span>
        </div>
        {/* Ready skills fill from the start, so the bar reads as progress toward the next level. */}
        <span className="skill-levels-readiness" aria-hidden="true">
          {levels.skills.map((skill, index) => <span key={skill.id} data-ready={index < levels.ready ? 'true' : undefined} />)}
        </span>
        <p>{levels.level === 0 && levels.ready === 0
          ? tr('Get a skill point in each skill to reach level 1.')
          : <>{tr('{value0} of {value1} skills at {value2} points for level {value3}', { value0: levels.ready, value1: levels.skills.length, value2: levels.target, value3: nextLevel })} {tr('Your level is your weakest skill’s level.')}</>}</p>
      </div>
    </header>

    <SkillChart levels={levels} conversation={conversationTotal > 0 ? conversationPoints : null} view={view} selected={selected} onSelect={setSelected}>
      <ul className="skill-levels-key" aria-label={tr('How to read the chart')}>
        <li><svg viewBox="0 0 16 16" aria-hidden="true">{bars ? <line className="skill-levels-key-goal" x1="8" y1="1" x2="8" y2="15" /> : <circle className="skill-levels-key-goal" cx="8" cy="8" r="6" />}</svg>{tr('Level {value0} goal', { value0: nextLevel })}</li>
        {levels.level > 0 && <li><svg viewBox="0 0 16 16" aria-hidden="true">{bars ? <line className="skill-levels-key-reached" x1="8" y1="1" x2="8" y2="15" /> : <circle className="skill-levels-key-reached" cx="8" cy="8" r="6" />}</svg>{tr('Levels reached')}</li>}
        <li><svg viewBox="0 0 16 16" aria-hidden="true">{bars ? <rect className="skill-levels-key-shape" x="1" y="5" width="14" height="6" rx="2" /> : <polygon className="skill-levels-key-shape" points="8,2 14,7 11,14 4,13 2,6" />}</svg>{tr('Your points')}</li>
      </ul>
      {conversationPoints && <p className="skill-levels-legend">
        <span className="skill-levels-legend-mark" aria-hidden="true" />
        {conversationTotal === 0
          ? tr('No skill points in this conversation yet')
          : view.scale === 'normalized'
            ? tr('This conversation: {value0} skill points, scaled so its busiest skill reaches the gold ring', { value0: conversationTotal })
            : tr('This conversation: {value0} skill points, drawn to the same scale as your totals', { value0: conversationTotal })}
      </p>}
      <p className="skill-levels-hint">{bars
        ? tr('Each bar is one skill. Press a bar, or a skill in the lists, to show it in the card.')
        : tr('Each arm of the chart is one skill. Press an arm, or a skill in the lists, to show it in the card.')}</p>
    </SkillChart>

    <div className="skill-levels-focus" aria-live="polite" style={{ borderColor: skillColors(focused.id).mark }}>
      {/* Keyed by skill, so each change of selection replays the card's entrance. */}
      <div className="skill-levels-focus-body" key={focused.id}>
        <SkillFocus skill={focused} languageName={languageName} target={levels.target} nextLevel={nextLevel}
          onInspect={onInspect} onPractice={onPractice} practicing={practiceSkill === focused.id} />
      </div>
    </div>

    {behind.length > 0 && <div className="skill-levels-next">
      <h3>{tr('To reach level {value0}', { value0: nextLevel })}</h3>
      <ul>{behind.map(({ skill, needed }) => {
        const colours = skillColors(skill.id)
        return <li key={skill.id}>
          <button type="button" className="skill-levels-row" aria-pressed={selected === skill.id}
            onClick={() => setSelected(skill.id)} style={{ color: colours.mark }}>
            <span className="skill-levels-dot" aria-hidden="true" />
            <span className="skill-levels-name" style={{ color: colours.ink }}>{tr(skill.label)}</span>
            <SkillPips points={skill.points} count={levels.target} goal={null} size="small" />
            <span className="skill-levels-needed">{tr('{value0} more', { value0: needed })}</span>
          </button>
        </li>
      })}</ul>
    </div>}

    {ready.length > 0 && <div className="skill-levels-next">
      <h3>{tr('Ready for level {value0}', { value0: nextLevel })}</h3>
      <ul className="skill-levels-ready">{ready.map(skill => {
        const colours = skillColors(skill.id)
        return <li key={skill.id}>
          <button type="button" className="skill-levels-chip" aria-pressed={selected === skill.id}
            onClick={() => setSelected(skill.id)} style={{ color: colours.mark }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            <span style={{ color: colours.ink }}>{tr(skill.label)}</span>
            <span>{tr('Lv {value0}', { value0: skill.level })}</span>
          </button>
        </li>
      })}</ul>
    </div>}
  </section>
}

/** The focused skill: its level and points toward its own next level (the
 * language goal marked), what it covers, what counts, and what to do next. */
function SkillFocus({ skill, languageName, target, nextLevel, onInspect, onPractice, practicing }: {
  skill: SkillLevel; languageName: string; target: number; nextLevel: number
  onInspect: ((id: string) => void) | null; onPractice?: (id: string) => void; practicing: boolean
}) {
  const tr = useI18n()
  const colours = skillColors(skill.id)
  const needed = target - skill.points
  return <>
    <div className="skill-levels-focus-head">
      <span className="skill-levels-dot" aria-hidden="true" style={{ color: colours.mark }} />
      <h3 style={{ color: colours.ink }}>{tr(skill.label)}</h3>
      <span className="skill-levels-level">{tr('Lv {value0}', { value0: skill.level })}</span>
    </div>
    <SkillPips points={skill.points} count={skill.nextThreshold} goal={target <= skill.nextThreshold ? target : null} size="large" colour={colours.mark} />
    <p className="skill-levels-focus-need">{needed > 0
      ? tr('{count} more points for level {value0}', { count: needed, value0: nextLevel })
      : tr('Ready for level {value0}. {value1} more for this skill’s level {value2}.', { value0: nextLevel, value1: skill.nextThreshold - skill.points, value2: skill.level + 1 })}</p>
    <p className="skill-levels-description">{tr(skill.description)}</p>
    <p className="skill-levels-criterion"><strong>{tr('Counts when')}</strong> {tr(skill.criterion)}</p>
    {(onInspect || onPractice) && <div className="skill-levels-actions">
      {onInspect && <button type="button" className="btn primary" onClick={() => onInspect(skill.id)}>{tr('{value0} in {value1}', { value0: tr(skill.label), value1: languageName })}</button>}
      {onPractice && <button type="button" className="btn outline" aria-pressed={practicing} onClick={() => onPractice(skill.id)}>{tr('Use this in a {value0} conversation', { value0: languageName })}</button>}
    </div>}
  </>
}

/** Points as pips, one per point up to `count`; `goal`, when given, outlines the
 * pip the language level needs. Long counts draw a bar instead. */
function SkillPips({ points, count, goal, size, colour }: { points: number; count: number; goal: number | null; size: 'small' | 'large'; colour?: string }) {
  const tr = useI18n()
  const label = tr('{value0} of {value1} points', { value0: points, value1: count })
  if (count > MAX_PIPS) return <progress className="skill-levels-bar" value={Math.min(points, count)} max={count} aria-label={label} style={colour ? { color: colour } : undefined} />
  return <span className="skill-levels-pips" data-size={size} role="img" aria-label={label} style={colour ? { color: colour } : undefined}>
    {Array.from({ length: count }, (_, index) => <span key={index} data-filled={index < points ? 'true' : undefined} data-goal={goal === index + 1 ? 'true' : undefined} />)}
  </span>
}
