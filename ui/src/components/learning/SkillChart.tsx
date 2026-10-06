import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../localization/i18n'
import { useStoredChoice } from '../persistence/useStoredChoice'
import { skillColors, skillShortLabel } from '../../domain/learning/catalog/skill-domains'
import type { LanguageSkillLevels } from '../../domain/learning/statistics/skill-levels'
import { SkillRadar } from './SkillRadar'
import { CHART_LIMIT, MAX_ZOOM, MIN_ZOOM, skillChartExtent, zoomExtent, type SkillChartExtent, type SkillChartScale, type SkillChartType } from './skill-chart-scale'

const CHART_TYPES: readonly SkillChartType[] = ['radial', 'bars']
const CHART_SCALES: readonly SkillChartScale[] = ['normalized', 'scale']
/** Each zoom button press multiplies or divides the zoom by this. */
const ZOOM_STEP = 1.5
/** Ctrl + wheel (and trackpad pinch) zoom by this power of e per wheel pixel. */
const WHEEL_ZOOM_RATE = 0.0015

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

export interface SkillChartView {
  type: SkillChartType
  scale: SkillChartScale
  setType: (type: SkillChartType) => void
  setScale: (scale: SkillChartScale) => void
}

/** The learner's chart type and scale, shared by every skill chart in this browser profile. Radial and normalized until changed. */
export function useSkillChartView(): SkillChartView {
  const [type, setType] = useStoredChoice('skellyspeak_skill_chart_type', CHART_TYPES)
  const [scale, setScale] = useStoredChoice('skellyspeak_skill_chart_scale', CHART_SCALES)
  return { type: type ?? 'radial', scale: scale ?? 'normalized', setType, setScale }
}

/** The language's skills as a radar or as bars in one framed card: a toolbar
 * (chart type and scale), the chart in a fixed square, a zoom row under it
 * (shown to scale, its space kept while normalized so the card never reflows),
 * and `children` (the key and notes) along the bottom. Switching type never moves
 * the rest of the page; the new chart fades in. Switching scale or zoom keeps
 * the chart and glides every mark to its new length. To scale, the zoom buttons
 * and Ctrl + wheel (or a trackpad pinch) over the chart magnify short arms;
 * marks past the edge are clipped there. */
export function SkillChart({ levels, conversation, view, selected, onSelect, children }: {
  levels: LanguageSkillLevels
  conversation: number[] | null
  view: SkillChartView
  selected: string; onSelect: (id: string) => void
  children: ReactNode
}) {
  const tr = useI18n()
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const zoomable = view.scale === 'scale'
  const shown = zoomable ? zoom : MIN_ZOOM
  const extent = zoomExtent(skillChartExtent(levels, conversation, view.scale), shown)
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = stage.current
    if (!element || !zoomable) return
    // Native listener: React's wheel listener is passive and cannot stop the page zooming or scrolling.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoom(current => clampZoom(current * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE)))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [zoomable, view.type])
  return <figure className="skill-chart" data-scale={view.scale}>
    <div className="skill-chart-toolbar">
      <Switch label={tr('Chart type')} value={view.type} onChange={view.setType}
        options={[{ value: 'radial', label: tr('Radial') }, { value: 'bars', label: tr('Bars') }]} />
      <Switch label={tr('Chart scale')} value={view.scale} onChange={view.setScale}
        options={[{ value: 'normalized', label: tr('Normalized') }, { value: 'scale', label: tr('To scale') }]} />
    </div>
    {/* Keyed by chart type, so a change of type replays the chart's entrance. */}
    <div className="skill-chart-stage" key={view.type} ref={stage}>
      {view.type === 'radial'
        ? <SkillRadar levels={levels} extent={extent} selected={selected} onSelect={onSelect} />
        : <SkillBars levels={levels} extent={extent} selected={selected} onSelect={onSelect} />}
    </div>
    {/* The zoom row keeps its place while normalized (hidden and inert), so changing scale never reflows the card. */}
    <div className="skill-chart-zoombar" data-hidden={zoomable ? undefined : 'true'} inert={!zoomable}>
      <span>{tr('Ctrl + scroll over the chart to zoom')}</span>
      <div className="skill-chart-switch" role="group" aria-label={tr('Zoom')}>
        <button type="button" aria-label={tr('Zoom out')} disabled={zoom <= MIN_ZOOM} onClick={() => setZoom(current => clampZoom(current / ZOOM_STEP))}>−</button>
        <button type="button" className="skill-chart-zoom-value" aria-label={tr('Fit the whole chart')} disabled={zoom === MIN_ZOOM} onClick={() => setZoom(MIN_ZOOM)}>
          {tr('{value0}×', { value0: tr.number(zoom, { maximumFractionDigits: 1 }) })}
        </button>
        <button type="button" aria-label={tr('Zoom in')} disabled={zoom >= MAX_ZOOM} onClick={() => setZoom(current => clampZoom(current * ZOOM_STEP))}>+</button>
      </div>
    </div>
    <figcaption className="skill-chart-notes">{children}</figcaption>
  </figure>
}

/** A small segmented switch: one pressed option at a time. */
function Switch<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void
}) {
  return <div className="skill-chart-switch" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>
}

/** One bar per skill in catalog order, each in its own colour, measured
 * against the earned-level lines and the gold goal line; the goal is tagged
 * above the bars and the current level below them. A bar longer than the track
 * stops at its end, squared off; lines past the end are not drawn. Pressing a bar selects its skill. Bars and lines glide to new lengths when the extent changes. */
export function SkillBars({ levels, extent, selected, onSelect }: {
  levels: LanguageSkillLevels
  extent: SkillChartExtent
  selected: string; onSelect: (id: string) => void
}) {
  const tr = useI18n()
  const along = (length: number) => `${length / CHART_LIMIT * 100}%`
  return <div className="skill-bars" style={{ gridTemplateRows: `var(--space-9) repeat(${levels.skills.length}, minmax(0, 1fr)) var(--space-9)` }}>
    {levels.skills.map((skill, index) => {
      const colours = skillColors(skill.id)
      const conversation = extent.conversation?.[index] ?? null
      return <button type="button" key={skill.id} className="skill-bar" data-reward-skill={skill.id} aria-pressed={selected === skill.id}
        aria-label={tr('{value0}: skill level {value1}, {value2} points', { value0: tr(skill.label), value1: skill.level, value2: skill.points })}
        style={{ gridRow: index + 2, color: colours.mark }} onClick={() => onSelect(skill.id)}>
        <span className="skill-bar-name">
          <strong style={{ color: colours.ink }}>{tr(skillShortLabel(skill.id))}</strong>
          <span>{tr('Lv {value0} · {value1}', { value0: skill.level, value1: `${tr.number(skill.points)}/${tr.number(skill.nextThreshold)}` })}</span>
        </span>
        <span className="skill-bar-track" aria-hidden="true">
          <span className="skill-bar-fill" data-over={extent.skills[index] > CHART_LIMIT ? 'true' : undefined} style={{ width: along(Math.min(extent.skills[index], CHART_LIMIT)) }} />
          {conversation !== null && conversation > 0 && <span className="skill-bar-conversation" style={{ width: along(Math.min(conversation, CHART_LIMIT)) }} />}
        </span>
      </button>
    })}
    <div className="skill-bars-lines" aria-hidden="true">
      {extent.rings.map((length, index) => length <= CHART_LIMIT && <span key={index} className="skill-bars-ring" data-current={index === extent.rings.length - 1 ? 'true' : undefined} style={{ insetInlineStart: along(length) }}>
        {index === extent.rings.length - 1 && <span className="skill-bars-tag">{tr('Lv {value0}', { value0: levels.level })}</span>}
      </span>)}
      {extent.goal <= CHART_LIMIT && <span className="skill-bars-ring" data-goal="true" style={{ insetInlineStart: along(extent.goal) }}>
        <span className="skill-bars-tag">{tr('Lv {value0} goal', { value0: levels.level + 1 })}</span>
      </span>}
    </div>
  </div>
}
