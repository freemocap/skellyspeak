import { useId, useState, type PointerEvent } from 'react'
import { useI18n } from '../localization/i18n'
import { skillColors, skillShortLabel } from '../../domain/learning/catalog/skill-domains'
import type { ConversationSkillPoints, LanguageSkillLevels } from '../../domain/learning/statistics/skill-levels'
import { GLYPH_FRAME, LABEL_RADIUS, PANEL_FRAME, labelSide, polar, skillWedges, type RadarFrame } from './skill-radar-geometry'
import { CHART_LIMIT, skillChartExtent, type SkillChartExtent } from './skill-chart-scale'

/** What the pointer is over: a skill (its wedge, arm or name) or a level ring
 * at an angle (radians from the centre), where that ring's tag appears. */
type RadarHover = { kind: 'skill'; id: string } | { kind: 'ring'; level: number; angle: number } | null

/** The skill shape. Each skill owns a wedge of the shape in its own colour,
 * fading to white at the centre; the gold ring is the next language level and
 * each earned level is a dashed ring inside it. Every arm ends in a dot and a
 * button naming the skill with its level and points, so the chart reads
 * without a legend. Pressing a wedge or a name selects that skill (`selected`);
 * the owner shows the selected skill's details. Hovering a wedge, arm or name
 * lights that skill; hovering a ring shows its level and points at the
 * pointer. Hover never changes the selection or moves anything. Lengths come
 * from `extent` (normalized or to scale); arms, rings and the conversation
 * outline glide to new lengths when the extent changes. */
export function SkillRadar({ levels, extent, selected, onSelect }: {
  levels: LanguageSkillLevels
  extent: SkillChartExtent
  selected: string; onSelect: (id: string) => void
}) {
  const tr = useI18n()
  const clipId = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const frame = PANEL_FRAME
  const count = levels.skills.length
  const tips = extent.skills.map((length, index) => polar(frame, frame.ring * length, index, count))
  const centre = frame.view / 2
  const place = (point: { x: number; y: number }) => ({ left: `${point.x / frame.view * 100}%`, top: `${point.y / frame.view * 100}%` })
  const [hover, setHover] = useState<RadarHover>(null)
  const hoveredSkill = hover?.kind === 'skill' ? hover.id : null
  // Level k's ring: earned rings are levels 1…level, the gold ring is the next level.
  const rings = [...extent.rings.map((length, index) => ({ level: index + 1, length, points: levels.bands[index] })),
    { level: levels.level + 1, length: extent.goal, points: levels.target }].filter(ring => ring.length <= CHART_LIMIT)
  const hoveredRing = hover?.kind === 'ring' ? rings.find(ring => ring.level === hover.level) ?? null : null
  const ringAngle = (event: PointerEvent<SVGCircleElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    return Math.atan2((event.clientY - box.top) / box.height * frame.view - centre, (event.clientX - box.left) / box.width * frame.view - centre)
  }
  const skillHover = (id: string) => ({ onPointerEnter: () => setHover({ kind: 'skill', id }), onPointerLeave: () => setHover(null) })
  return <div className="skill-radar" data-focus="true">
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`} aria-hidden="true">
      <defs><clipPath id={`${clipId}-edge`}><circle cx={centre} cy={centre} r={frame.ring * CHART_LIMIT + 8} /></clipPath></defs>
      {/* Zoomed to scale, marks can pass the chart's edge; they are clipped just past the arm ends. */}
      <g clipPath={`url(#${clipId}-edge)`}>
        <RadarShape frame={frame} skillIds={levels.skills.map(skill => skill.id)} extent={extent} tips={tips} focus={selected} hovered={hoveredSkill} ring={hoveredRing?.level ?? null} detailed />
        {extent.conversation && <path className="skill-radar-conversation skill-radar-glide"
          style={{ d: shapePath(extent.conversation.map((length, index) => polar(frame, frame.ring * length, index, count))) }} />}
      </g>
      {levels.skills.map((skill, index) => {
        const start = polar(frame, frame.ring * LABEL_RADIUS, index - 0.5, count)
        const end = polar(frame, frame.ring * LABEL_RADIUS, index + 0.5, count)
        return <polygon key={skill.id} className="skill-radar-hit" points={`${centre},${centre} ${start.x},${start.y} ${end.x},${end.y}`}
          onClick={() => onSelect(skill.id)} {...skillHover(skill.id)} />
      })}
      {/* A wide invisible stroke on each ring catches the pointer near it. */}
      {rings.map(ring => <circle key={ring.level} className="skill-radar-ring-hit skill-radar-glide" cx={centre} cy={centre} style={{ r: `${frame.ring * ring.length}px` }}
        onPointerMove={event => setHover({ kind: 'ring', level: ring.level, angle: ringAngle(event) })} onPointerLeave={() => setHover(null)} />)}
    </svg>
    {hover?.kind === 'ring' && hoveredRing && <span className="skill-radar-ring-tag" data-goal={hoveredRing.level > levels.level ? 'true' : undefined} aria-hidden="true"
      style={place({ x: centre + frame.ring * hoveredRing.length * Math.cos(hover.angle), y: centre + frame.ring * hoveredRing.length * Math.sin(hover.angle) })}>
      {hoveredRing.level > levels.level
        ? tr('Lv {value0} goal · {value1} pt', { value0: hoveredRing.level, value1: tr.number(hoveredRing.points) })
        : tr('Lv {value0} · {value1} pt', { value0: hoveredRing.level, value1: tr.number(hoveredRing.points) })}
    </span>}
    {levels.skills.map((skill, index) => {
      const colours = skillColors(skill.id)
      return <button type="button" key={skill.id} className="skill-radar-label" data-reward-skill={skill.id} data-side={labelSide(index, count)}
        data-active={selected === skill.id ? 'true' : undefined} data-hover={hoveredSkill === skill.id ? 'true' : undefined} aria-pressed={selected === skill.id} {...skillHover(skill.id)}
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
 * wedges, their edge, the earned rings and the gold ring, normalized. */
export function SkillRadarGlyph({ levels }: { levels: LanguageSkillLevels }) {
  const frame = GLYPH_FRAME
  const count = levels.skills.length
  const extent = skillChartExtent(levels, null, 'normalized')
  const tips = extent.skills.map((length, index) => polar(frame, frame.ring * length, index, count))
  return <span className="skill-radar skill-radar-glyph" aria-hidden="true">
    <svg className="skill-radar-layer" viewBox={`0 0 ${frame.view} ${frame.view}`}>
      <RadarShape frame={frame} skillIds={levels.skills.map(skill => skill.id)} extent={extent} tips={tips} focus={null} hovered={null} ring={null} detailed={false} />
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
      {most > 0 && <SkillWedges frame={frame} skillIds={points.skills.map(skill => skill.id)} tips={tips} focus={null} hovered={null} />}
      {most > 0 && <polygon className="skill-radar-edge" points={tips.map(tip => `${tip.x},${tip.y}`).join(' ')} />}
    </svg>
  </span>
}

/** A closed outline through `points`, as a CSS `d` value so the outline can transition. */
function shapePath(points: { x: number; y: number }[]): string {
  return `path("M ${points.map(point => `${point.x} ${point.y}`).join(' L ')} Z")`
}

/** The disc inside the gold ring, earned-level rings, skill wedges, gold ring and edge. `detailed`
 * adds the thin axes, the arms and their end dots, and marks the current
 * level's ring. `hovered` lights a skill's wedge and arm; `ring` lights the
 * ring of that level. Lengths are CSS geometry (`d`, `r`, `cx`, `cy`), so a
 * change of extent animates instead of jumping. */
function RadarShape({ frame, skillIds, extent, tips, focus, hovered, ring, detailed }: {
  frame: RadarFrame; skillIds: string[]; extent: SkillChartExtent; tips: { x: number; y: number }[]; focus: string | null; hovered: string | null; ring: number | null; detailed: boolean
}) {
  const centre = frame.view / 2
  const count = skillIds.length
  return <>
    <circle className="skill-radar-disc skill-radar-glide" cx={centre} cy={centre} style={{ r: `${frame.ring * extent.goal}px` }} />
    {detailed && skillIds.map((skillId, index) => {
      const end = polar(frame, frame.ring * CHART_LIMIT, index, count)
      return <line key={skillId} className="skill-radar-axis" x1={centre} y1={centre} x2={end.x} y2={end.y} style={{ stroke: skillColors(skillId).mark }} />
    })}
    <SkillWedges frame={frame} skillIds={skillIds} tips={tips} focus={focus} hovered={hovered} />
    {extent.rings.map((length, index) => <circle key={index} className="skill-radar-earned skill-radar-glide" data-current={detailed && index === extent.rings.length - 1 ? 'true' : undefined}
      data-hover={ring === index + 1 ? 'true' : undefined} cx={centre} cy={centre} style={{ r: `${frame.ring * length}px` }} />)}
    <circle className="skill-radar-target skill-radar-glide" data-hover={ring === extent.rings.length + 1 ? 'true' : undefined} cx={centre} cy={centre} style={{ r: `${frame.ring * extent.goal}px` }} />
    <path className="skill-radar-edge skill-radar-glide" style={{ d: shapePath(tips) }} />
    {detailed && skillIds.map((skillId, index) => {
      const tip = tips[index]
      const active = focus === skillId
      const lit = hovered === skillId
      return <g key={skillId} className="skill-radar-arm" data-active={active ? 'true' : undefined} data-hover={lit ? 'true' : undefined} style={{ color: skillColors(skillId).mark }}>
        <path className="skill-radar-line" style={{ d: `path("M ${centre} ${centre} L ${tip.x} ${tip.y}")` }} />
        <circle className="skill-radar-tip" style={{ cx: `${tip.x}px`, cy: `${tip.y}px`, r: `${active ? 7 : lit ? 6 : 4.5}px` }} />
      </g>
    })}
  </>
}

/** One wedge per skill in its own colour, with a pale centre clipped to the shape. */
function SkillWedges({ frame, skillIds, tips, focus, hovered }: { frame: RadarFrame; skillIds: string[]; tips: { x: number; y: number }[]; focus: string | null; hovered: string | null }) {
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
      <clipPath id={`${id}-shape`}><path className="skill-radar-glide" style={{ d: shapePath(tips) }} /></clipPath>
    </defs>
    {skillIds.map((skillId, index) => <path key={skillId} className="skill-radar-wedge" data-active={focus === skillId ? 'true' : undefined} data-hover={hovered === skillId ? 'true' : undefined}
      style={{ d: shapePath(wedges[index]), fill: skillColors(skillId).mark }} />)}
    <circle cx={centre} cy={centre} r={frame.ring * CHART_LIMIT} fill={`url(#${id}-fade)`} clipPath={`url(#${id}-shape)`} />
  </g>
}
