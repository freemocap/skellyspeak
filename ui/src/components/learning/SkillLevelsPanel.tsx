import { useState } from 'react'
import { useI18n } from '../localization/i18n'
import { SkillRadar } from './SkillRadar'
import { skillColors } from '../../domain/learning/catalog/skill-domains'
import { holdingBack, languageSkillLevels, type ConversationSkillPoints, type SkillLevel } from '../../domain/learning/statistics/skill-levels'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'

/** Point counts above this draw as a bar instead of one pip per point. */
const MAX_PIPS = 21

/** A language's skill level: the badge and how many skills are ready for the
 * next level, the radar with every arm named, the focused skill's details right
 * under it, then the skills still short of the next level and those already
 * ready. Pointing at a skill focuses it; pressing pins it. The first skill
 * holding the level back starts pinned so its details and actions are always
 * one glance from the chart. `conversation`, when given, is one conversation's
 * evidence, overlaid on the radar as its own shape. */
export function SkillLevelsPanel({ snapshot, conversation, onInspect, onPractice, practiceSkill }: {
  snapshot: SkillSnapshot; conversation: ConversationSkillPoints | null; onInspect: ((id: string) => void) | null
  onPractice?: (id: string) => void; practiceSkill?: string
}) {
  const tr = useI18n()
  const levels = languageSkillLevels(snapshot)
  const behind = holdingBack(levels)
  const ready = levels.skills.filter(skill => skill.points >= levels.target)
  const [pinned, setPinned] = useState<string | null>(behind[0]?.skill.id ?? null)
  const [pointed, setPointed] = useState<string | null>(null)
  const conversationPoints = conversation ? conversation.skills.map(skill => skill.points) : null
  const conversationTotal = conversationPoints?.reduce((sum, value) => sum + value, 0) ?? 0
  const focused = levels.skills.find(skill => skill.id === (pointed ?? pinned))
  const nextLevel = levels.level + 1
  const pick = (id: string) => setPinned(current => current === id ? null : id)
  const point = (id: string) => ({
    onPointerEnter: () => setPointed(id),
    onPointerLeave: () => setPointed(current => current === id ? null : current),
  })
  return <section className="skill-levels" aria-label={tr('Skill levels')}>
    <header className="skill-levels-head">
      <span className="skill-level-badge" aria-hidden="true"><small>{tr('Lv')}</small>{tr.number(levels.level)}</span>
      <div className="skill-levels-summary">
        <div className="skill-levels-title">
          <strong>{tr('Skill level {value0}', { value0: levels.level })}</strong>
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

    <SkillRadar levels={levels} pinned={pinned} onPin={setPinned} pointed={pointed} onPoint={setPointed} conversation={conversationTotal > 0 ? conversationPoints : null} />
    <ul className="skill-levels-key" aria-label={tr('How to read the chart')}>
      <li><svg viewBox="0 0 16 16" aria-hidden="true"><circle className="skill-levels-key-goal" cx="8" cy="8" r="6" /></svg>{tr('Level {value0} goal', { value0: nextLevel })}</li>
      {levels.level > 0 && <li><svg viewBox="0 0 16 16" aria-hidden="true"><circle className="skill-levels-key-reached" cx="8" cy="8" r="6" /></svg>{tr('Levels reached')}</li>}
      <li><svg viewBox="0 0 16 16" aria-hidden="true"><polygon className="skill-levels-key-shape" points="8,2 14,7 11,14 4,13 2,6" /></svg>{tr('Your points')}</li>
    </ul>
    {conversationPoints && <p className="skill-levels-legend">
      <span className="skill-levels-legend-mark" aria-hidden="true" />
      {conversationTotal > 0
        ? tr('This conversation: {value0} skill points, scaled so its busiest skill reaches the gold ring', { value0: conversationTotal })
        : tr('No skill points in this conversation yet')}
    </p>}

    <div className="skill-levels-focus" aria-live="polite" style={focused ? { borderColor: skillColors(focused.id).mark } : undefined}>
      {focused
        ? <SkillFocus skill={focused} target={levels.target} nextLevel={nextLevel}
            onInspect={onInspect} onPractice={onPractice} practicing={practiceSkill === focused.id} />
        : <p className="skill-levels-focus-hint">{tr('Point at a skill on the chart to see what it covers. Press it to keep it here.')}</p>}
    </div>

    {behind.length > 0 && <div className="skill-levels-next">
      <h3>{tr('To reach level {value0}', { value0: nextLevel })}</h3>
      <ul>{behind.map(({ skill, needed }) => {
        const colours = skillColors(skill.id)
        return <li key={skill.id}>
          <button type="button" className="skill-levels-row" aria-pressed={pinned === skill.id} data-active={focused?.id === skill.id ? 'true' : undefined}
            onClick={() => pick(skill.id)} {...point(skill.id)} style={{ color: colours.mark }}>
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
          <button type="button" className="skill-levels-chip" aria-pressed={pinned === skill.id} data-active={focused?.id === skill.id ? 'true' : undefined}
            onClick={() => pick(skill.id)} {...point(skill.id)} style={{ color: colours.mark }}>
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
function SkillFocus({ skill, target, nextLevel, onInspect, onPractice, practicing }: {
  skill: SkillLevel; target: number; nextLevel: number
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
    <p>{tr(skill.description)}</p>
    <p className="skill-levels-criterion"><strong>{tr('Counts when')}</strong> {tr(skill.criterion)}</p>
    {(onInspect || onPractice) && <div className="skill-levels-actions">
      {onInspect && <button type="button" className="btn primary" onClick={() => onInspect(skill.id)}>{tr('More about this skill')}</button>}
      {onPractice && <button type="button" className="btn outline" aria-pressed={practicing} onClick={() => onPractice(skill.id)}>{tr('Use this in a conversation')}</button>}
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
