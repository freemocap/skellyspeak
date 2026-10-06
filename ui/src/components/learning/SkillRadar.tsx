import { useId } from 'react'
import { useI18n } from '../localization/i18n'
import { skillColors, skillShortLabel } from '../../domain/learning/catalog/skill-domains'
import type { ConversationSkillPoints, LanguageSkillLevels } from '../../domain/learning/statistics/skill-levels'
import { GLYPH_FRAME, LABEL_RADIUS, PANEL_FRAME, labelSide, polar, positionRadius, ringRadius, skillWedges, type RadarFrame } from './skill-radar-geometry'

/** The skill shape. Each skill owns a wedge of the shape in its own colour,
 * fading to white at the centre; the gold ring is the next language level and
 * each earned level is a dashed ring inside it, the current one tagged. Every
 * arm ends in a dot and a button naming the skill with its level and points, so
 * the chart reads without a legend. Pressing a wedge or a name selects that
 * skill (`selected`); the owner shows the selected skill's details. Hover only
 * styles the name under the pointer, so nothing elsewhere moves until a press. `conversation`, when given, overlays one conversation's
 * points per skill (catalog order), scaled so its busiest skill reaches the gold ring. */
export function SkillRadar({ levels, selected, onSelect, conversation }: {
  levels: LanguageSkillLevels
  selected: string; onSelect: (id: string) => void
  conversation: number[] | null
}) {
  const tr = useI18n()
  const frame = PANEL_FRAME
  const count = levels.skills.length
  const tips = levels.skills.map((skill, index) => polar(frame, positionRadius(frame, skill.position, levels.level), index, count))
  const centre = frame.view / 2
  const focus = selected
  const place = (point: { x: number; y: number }) => ({ left: `${point.x / frame.view * 100}%`, top: `${point.y / frame.view * 100}%` })
  const goalTag = polar(frame, frame.ring, -0.5, count)
  const levelTag = polar(frame, ringRadius(frame, levels.level, levels.level), -0.5, count)
  return <div className="skill-radar" data-focus={focus ? 'true' : undefined}>
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`} aria-hidden="true">
      <RadarShape frame={frame} levels={levels} tips={tips} focus={focus} detailed />
      {conversation && <ConversationOverlay frame={frame} points={conversation} />}
      {levels.skills.map((skill, index) => {
        const start = polar(frame, frame.ring * LABEL_RADIUS, index - 0.5, count)
        const end = polar(frame, frame.ring * LABEL_RADIUS, index + 0.5, count)
        return <polygon key={skill.id} className="skill-radar-hit" points={`${centre},${centre} ${start.x},${start.y} ${end.x},${end.y}`}
          onClick={() => onSelect(skill.id)} />
      })}
    </svg>
    <span className="skill-radar-ring-tag" data-goal="true" style={place(goalTag)} aria-hidden="true">{tr('Lv {value0} goal', { value0: levels.level + 1 })}</span>
    {levels.level > 0 && <span className="skill-radar-ring-tag" style={place(levelTag)} aria-hidden="true">{tr('Lv {value0}', { value0: levels.level })}</span>}
    {levels.skills.map((skill, index) => {
      const colours = skillColors(skill.id)
      return <button type="button" key={skill.id} className="skill-radar-label" data-reward-skill={skill.id} data-side={labelSide(index, count)}
        data-active={focus === skill.id ? 'true' : undefined} aria-pressed={selected === skill.id}
        aria-label={tr('{value0}: skill level {value1}, {value2} points', { value0: tr(skill.label), value1: skill.level, value2: skill.points })}
        style={{ ...place(polar(frame, frame.ring * LABEL_RADIUS, index, count)), color: colours.mark }}
        onClick={() => onSelect(skill.id)}>
        <strong style={{ color: colours.ink }}>{tr(skillShortLabel(skill.id))}</strong>
        <span>{tr('Lv {value0} · {value1}', { value0: skill.level, value1: `${tr.number(skill.points)}/${tr.number(skill.nextThreshold)}` })}</span>
      </button>
    })}
  </div>
}

/** The language radar without labels or interaction, sized by its owner: the
 * wedges, their edge, the earned rings and the gold ring. */
export function SkillRadarGlyph({ levels }: { levels: LanguageSkillLevels }) {
  const frame = GLYPH_FRAME
  const count = levels.skills.length
  const tips = levels.skills.map((skill, index) => polar(frame, positionRadius(frame, skill.position, levels.level), index, count))
  return <span className="skill-radar skill-radar-glyph" aria-hidden="true">
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      <RadarShape frame={frame} levels={levels} tips={tips} focus={null} detailed={false} />
    </svg>
  </span>
}

/** One conversation's shape at badge size: its points per skill scaled so the
 * busiest skill reaches the edge. No rings: a conversation has no level. */
export function ConversationShapeGlyph({ points }: { points: ConversationSkillPoints }) {
  const frame = GLYPH_FRAME
  const count = points.skills.length
  const most = Math.max(...points.skills.map(skill => skill.points))
  const tips = points.skills.map((skill, index) => polar(frame, most === 0 ? 0 : frame.ring * skill.points / most, index, count))
  return <span className="skill-radar skill-radar-glyph" aria-hidden="true">
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      <circle className="skill-radar-disc" cx={frame.view / 2} cy={frame.view / 2} r={frame.ring} />
      {most > 0 && <SkillWedges frame={frame} skillIds={points.skills.map(skill => skill.id)} tips={tips} focus={null} />}
      {most > 0 && <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />}
    </svg>
  </span>
}

/** The disc, earned-level rings, skill wedges, gold ring and edge. `detailed`
 * adds the thin axes, the arms and their end dots, and marks the current level's ring. */
function RadarShape({ frame, levels, tips, focus, detailed }: {
  frame: RadarFrame; levels: LanguageSkillLevels; tips: { x: number; y: number }[]; focus: string | null; detailed: boolean
}) {
  const centre = frame.view / 2
  const count = levels.skills.length
  const earned = Array.from({ length: levels.level }, (_, index) => index + 1)
  return <>
    <circle className="skill-radar-disc" cx={centre} cy={centre} r={frame.ring} />
    {detailed && levels.skills.map((skill, index) => {
      const end = polar(frame, frame.ring, index, count)
      return <line key={skill.id} className="skill-radar-axis" x1={centre} y1={centre} x2={end.x} y2={end.y} style={{ stroke: skillColors(skill.id).mark }} />
    })}
    <SkillWedges frame={frame} skillIds={levels.skills.map(skill => skill.id)} tips={tips} focus={focus} />
    {earned.map(ring => <circle key={ring} className="skill-radar-earned" data-current={detailed && ring === levels.level ? 'true' : undefined} cx={centre} cy={centre} r={ringRadius(frame, ring, levels.level)} />)}
    <circle className="skill-radar-target" cx={centre} cy={centre} r={frame.ring} />
    <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />
    {detailed && levels.skills.map((skill, index) => {
      const tip = tips[index]
      const active = focus === skill.id
      return <g key={skill.id} className="skill-radar-arm" data-active={active ? 'true' : undefined} style={{ color: skillColors(skill.id).mark }}>
        <line className="skill-radar-line" x1={centre} y1={centre} x2={tip.x} y2={tip.y} />
        <circle className="skill-radar-tip" cx={tip.x} cy={tip.y} r={active ? 7 : 4.5} />
      </g>
    })}
  </>
}

/** One wedge per skill in its own colour, with a pale centre clipped to the shape. */
function SkillWedges({ frame, skillIds, tips, focus }: { frame: RadarFrame; skillIds: string[]; tips: { x: number; y: number }[]; focus: string | null }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const wedges = skillWedges(frame, tips)
  const centre = frame.view / 2
  return <g className="skill-radar-wedges" data-focus={focus ? 'true' : undefined}>
    <defs>
      <radialGradient id={`${id}-fade`}>
        <stop offset="0%" className="skill-radar-fade-core" />
        <stop offset="45%" className="skill-radar-fade-mid" />
        <stop offset="100%" className="skill-radar-fade-edge" />
      </radialGradient>
      <clipPath id={`${id}-shape`}><polygon points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} /></clipPath>
    </defs>
    {skillIds.map((skillId, index) => <polygon key={skillId} className="skill-radar-wedge" data-active={focus === skillId ? 'true' : undefined} points={wedges[index]} style={{ fill: skillColors(skillId).mark }} />)}
    <circle cx={centre} cy={centre} r={frame.ring * 1.1} fill={`url(#${id}-fade)`} clipPath={`url(#${id}-shape)`} />
  </g>
}

/** One conversation's points per skill as an outline over the language shape, scaled to its busiest skill. */
function ConversationOverlay({ frame, points }: { frame: RadarFrame; points: number[] }) {
  const most = Math.max(...points)
  if (most === 0) return null
  const outline = points.map((value, index) => polar(frame, frame.ring * value / most, index, points.length))
  return <polygon className="skill-radar-conversation" points={outline.map(point => `${point.x},${point.y}`).join(' ')} />
}
