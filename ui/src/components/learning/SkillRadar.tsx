import type { KeyboardEvent } from 'react'
import { useI18n } from '../localization/i18n'
import { skillColors } from '../../domain/learning/catalog/skill-domains'
import type { LanguageSkillLevels, SkillLevel } from '../../domain/learning/statistics/skill-levels'
import { armRadius, GLYPH_FRAME, PANEL_FRAME, polar, ringRadius, taperedArm, type RadarFrame } from './skill-radar-geometry'

/** The skill shape: a colour-wheel fill that grows from white toward the gold ring
 * of the next overall level, each earned level a dark dashed ring behind it, a thin
 * axis per skill in its colour and each skill's name and level beside its axis.
 * Pointing at the chart adds the value lines and ring numbers; pointing at one arm
 * thickens it, puts a white dot on its end and expands its label. Pressing an arm
 * pins it. `conversation`, when given, overlays one conversation's points per skill
 * (catalog order), scaled so its busiest skill reaches the gold ring. */
export function SkillRadar({ levels, pinned, onPin, pointed, onPoint, conversation }: {
  levels: LanguageSkillLevels
  pinned: string | null; onPin: (id: string | null) => void
  pointed: string | null; onPoint: (id: string | null) => void
  conversation: number[] | null
}) {
  const tr = useI18n()
  const frame = PANEL_FRAME
  const count = levels.skills.length
  const tips = levels.skills.map((skill, index) => polar(frame, armRadius(frame, skill.points, levels.level), index, count))
  const centre = frame.view / 2
  const toggle = (id: string) => onPin(pinned === id ? null : id)
  const key = (id: string) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault(); toggle(id)
  }
  const leave = (id: string) => { if (pointed === id) onPoint(null) }
  return <div className="skill-radar" data-pinned={pinned ? 'true' : undefined}>
    <RadarBase frame={frame} levels={levels} detailed />
    <RadarFill frame={frame} levels={levels} tips={tips} />
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`} role="group" aria-label={tr('Skill radar')}>
      <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />
      <circle className="skill-radar-target" cx={centre} cy={centre} r={frame.ring} />
      {conversation && <ConversationOverlay frame={frame} points={conversation} />}
      {levels.skills.map((skill, index) => {
        const tip = tips[index]
        const active = pointed === skill.id || pinned === skill.id
        const reach = polar(frame, frame.ring * 1.6, index - 0.5, count)
        const reachEnd = polar(frame, frame.ring * 1.6, index + 0.5, count)
        return <g key={skill.id} className="skill-radar-arm" data-active={active ? 'true' : undefined} role="button" tabIndex={0}
          aria-pressed={pinned === skill.id} aria-label={tr('{value0}: skill level {value1}, {value2} points', { value0: tr(skill.label), value1: skill.level, value2: skill.points })}
          style={{ color: skillColors(skill.id).mark }}
          onClick={() => toggle(skill.id)} onKeyDown={key(skill.id)}
          onPointerEnter={() => onPoint(skill.id)} onPointerLeave={() => leave(skill.id)}
          onFocus={() => onPoint(skill.id)} onBlur={() => leave(skill.id)}>
          <polygon className="skill-radar-hit" points={`${centre},${centre} ${reach.x},${reach.y} ${reachEnd.x},${reachEnd.y}`} />
          <line className="skill-radar-line" x1={centre} y1={centre} x2={tip.x} y2={tip.y} />
          {active && <>
            <path className="skill-radar-thick" d={taperedArm(frame, tip, 11)} />
            <circle className="skill-radar-tip" cx={tip.x} cy={tip.y} r={5} />
          </>}
        </g>
      })}
      {/* Labels sit above every arm, with the active ones last so their expanded box is never covered. */}
      {levels.skills.map((skill, index) => ({ skill, index, active: pointed === skill.id || pinned === skill.id }))
        .sort((left, right) => Number(left.active) - Number(right.active))
        .map(({ skill, index, active }) => <ArmLabel key={skill.id} frame={frame} skill={skill} index={index} count={count} active={active} />)}
    </svg>
  </div>
}

/** The language radar at badge size: the fill, its edge, the earned rings and the gold ring. */
export function SkillRadarGlyph({ levels }: { levels: LanguageSkillLevels }) {
  const frame = GLYPH_FRAME
  const count = levels.skills.length
  const tips = levels.skills.map((skill, index) => polar(frame, armRadius(frame, skill.points, levels.level), index, count))
  return <span className="skill-radar skill-radar-glyph" aria-hidden="true">
    <RadarBase frame={frame} levels={levels} detailed={false} />
    <RadarFill frame={frame} levels={levels} tips={tips} />
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />
      <circle className="skill-radar-target" cx={frame.view / 2} cy={frame.view / 2} r={frame.ring} />
    </svg>
  </span>
}

/** One conversation's shape at badge size: its points per skill scaled so the
 * busiest skill reaches the edge. No rings: a conversation has no level. */
export function ConversationShapeGlyph({ levels }: { levels: LanguageSkillLevels }) {
  const frame = GLYPH_FRAME
  const count = levels.skills.length
  const most = Math.max(...levels.skills.map(skill => skill.points))
  const tips = levels.skills.map((skill, index) => polar(frame, most === 0 ? 0 : frame.ring * skill.points / most, index, count))
  return <span className="skill-radar skill-radar-glyph" aria-hidden="true">
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      <circle className="skill-radar-disc" cx={frame.view / 2} cy={frame.view / 2} r={frame.ring} />
    </svg>
    {most > 0 && <RadarFill frame={frame} levels={levels} tips={tips} />}
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      {most > 0 && <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />}
    </svg>
  </span>
}

/** Behind the fill: the unfilled disc, a thin axis per skill in its colour, the
 * earned-level rings and, while pointing, the ring numbers. */
function RadarBase({ frame, levels, detailed }: { frame: RadarFrame; levels: LanguageSkillLevels; detailed: boolean }) {
  const tr = useI18n()
  const centre = frame.view / 2
  const count = levels.skills.length
  const earned = Array.from({ length: levels.level }, (_, index) => index + 1)
  return <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`} aria-hidden="true">
    <circle className="skill-radar-disc" cx={centre} cy={centre} r={frame.ring} />
    {detailed && levels.skills.map((skill, index) => {
      const end = polar(frame, frame.ring, index, count)
      return <line key={skill.id} className="skill-radar-axis" x1={centre} y1={centre} x2={end.x} y2={end.y} style={{ stroke: skillColors(skill.id).mark }} />
    })}
    {detailed && <g className="skill-radar-detail">
      {[...earned, levels.level + 1].map(ring => <text key={ring} className="skill-radar-ring-number" x={centre + 5} y={centre - ringRadius(frame, ring, levels.level) - 4}>{tr.number(ring)}</text>)}
    </g>}
    {earned.map(ring => <circle key={ring} className="skill-radar-earned" cx={centre} cy={centre} r={ringRadius(frame, ring, levels.level)} />)}
  </svg>
}

/** The colour wheel, pale at the centre, clipped to a shape. */
function RadarFill({ frame, levels, tips }: { frame: RadarFrame; levels: LanguageSkillLevels; tips: { x: number; y: number }[] }) {
  const count = levels.skills.length
  const stops = levels.skills.map((skill, index) => `${skillColors(skill.id).mark} ${360 * index / count}deg`)
  const wheel = `conic-gradient(from 0deg, ${stops.join(', ')}, ${skillColors(levels.skills[0].id).mark} 360deg)`
  const half = frame.view / 2
  const fade = `radial-gradient(closest-side, var(--skill-radar-core) 0%, var(--skill-radar-mid) ${45 * frame.ring / half}%, transparent ${90 * frame.ring / half}%)`
  const clip = `polygon(${tips.map(tip => `${tip.x / frame.view * 100}% ${tip.y / frame.view * 100}%`).join(', ')})`
  return <div className="skill-radar-fill" style={{ background: `${fade}, ${wheel}`, clipPath: clip }} />
}

/** One conversation's points per skill as an outline over the language shape, scaled to its busiest skill. */
function ConversationOverlay({ frame, points }: { frame: RadarFrame; points: number[] }) {
  const most = Math.max(...points)
  if (most === 0) return null
  const outline = points.map((value, index) => polar(frame, frame.ring * value / most, index, points.length))
  return <polygon className="skill-radar-conversation" points={outline.map(point => `${point.x},${point.y}`).join(' ')} />
}

const LABEL_WIDTH = 96
const LABEL_HEIGHT = 96

/** A skill's name and level beside its axis; the active arm's label grows a line and a background. */
function ArmLabel({ frame, skill, index, count, active }: { frame: RadarFrame; skill: SkillLevel; index: number; count: number; active: boolean }) {
  const tr = useI18n()
  const at = polar(frame, frame.ring * 1.1 + 24, index, count)
  const side = at.x - frame.view / 2
  const rise = at.y - frame.view / 2
  const align = Math.abs(side) < 8 ? 'center' : side > 0 ? 'start' : 'end'
  const vertical = rise < -frame.ring * 0.5 ? 'end' : rise > frame.ring * 0.5 ? 'start' : 'center'
  const x = align === 'center' ? at.x - LABEL_WIDTH / 2 : align === 'start' ? at.x - 6 : at.x - LABEL_WIDTH + 6
  const y = vertical === 'center' ? at.y - LABEL_HEIGHT / 2 : vertical === 'start' ? at.y - 10 : at.y - LABEL_HEIGHT + 10
  return <foreignObject x={x} y={y} width={LABEL_WIDTH} height={LABEL_HEIGHT} className="skill-radar-label-frame">
    <div className="skill-radar-label" data-align={align} data-vertical={vertical} data-active={active ? 'true' : undefined} style={{ color: skillColors(skill.id).ink }}>
      <strong>{tr(skill.label)}</strong>
      <span>{tr('Lv {value0} · {value1}', { value0: skill.level, value1: skill.points })}</span>
      {active && <span>{tr('{value0} more for level {value1}', { value0: skill.nextThreshold - skill.points, value1: skill.level + 1 })}</span>}
    </div>
  </foreignObject>
}
