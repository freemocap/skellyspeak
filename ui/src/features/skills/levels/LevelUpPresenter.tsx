import { useEffect, useRef } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { SkillRadarGlyph } from '../../../components/learning/SkillRadar'
import { skillColors } from '../../../domain/learning/catalog/skill-domains'
import { languageSkillLevels } from '../../../domain/learning/statistics/skill-levels'
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { skillLevelScope, useSkillLevelEventStore, type LevelPresentation } from '../../../state/learning/skill-level-events'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

const SKILLS_MS = 2400
const SKILLS_ROW_MS = 400
const SKILLS_MAX_MS = 5200
const LANGUAGE_MS = 3800

/** Plays the queued level celebrations one at a time over the current shell.
 * Levels shown elsewhere are always the snapshot's; this layer only celebrates. */
export function LevelUpPresenter({ snapshot }: { snapshot: SkillSnapshot | null }) {
  const showing = useSkillLevelEventStore(state => state.showing)
  const advance = useSkillLevelEventStore(state => state.advance)
  const initialized = useSkillLevelEventStore(state => state.initialized)
  if (!showing || !snapshot || initialized !== skillLevelScope(snapshot)) return null
  const key = showing.kind === 'language' ? showing.event.id : showing.events.map(event => event.id).join(',')
  return <Presentation key={key} snapshot={snapshot} presentation={showing} onDone={advance} />
}

function Presentation({ snapshot, presentation, onDone }: { snapshot: SkillSnapshot; presentation: LevelPresentation; onDone: () => void }) {
  const card = useRef<HTMLElement>(null)
  const rows = presentation.kind === 'skills' ? collapse(presentation.events) : []
  const duration = presentation.kind === 'language' ? LANGUAGE_MS : Math.min(SKILLS_MAX_MS, SKILLS_MS + SKILLS_ROW_MS * (rows.length - 1))
  useEffect(() => {
    let remaining = duration
    let started = 0
    let timer: number | undefined
    let played = false
    const visibility = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        remaining = Math.max(0, remaining - (performance.now() - started))
        timer = undefined
      }
      if (document.visibilityState !== 'visible') return
      if (!played && card.current) {
        playRewardSound(presentation.kind === 'language' ? { kind: 'milestone' } : { kind: 'pop' }, card.current)
        played = true
      }
      started = performance.now()
      timer = window.setTimeout(onDone, remaining)
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [presentation, duration, onDone])
  return presentation.kind === 'language'
    ? <LanguageLevelCard ref={card} snapshot={snapshot} fromLevel={presentation.event.fromLevel} toLevel={presentation.event.toLevel} onDone={onDone} />
    : <SkillLevelsReceipt ref={card} snapshot={snapshot} rows={rows} onDone={onDone} />
}

/** One row per skill: a catch-up run 0→1→…→5 reads as "level 5". */
function collapse(events: { skillId?: string; fromLevel: number; toLevel: number }[]) {
  const rows = new Map<string, { skillId: string; fromLevel: number; toLevel: number }>()
  for (const event of events) {
    if (!event.skillId) throw new Error('A skill level step has no skill')
    const row = rows.get(event.skillId)
    rows.set(event.skillId, row ? { ...row, toLevel: Math.max(row.toLevel, event.toLevel) } : { skillId: event.skillId, fromLevel: event.fromLevel, toLevel: event.toLevel })
  }
  return [...rows.values()]
}

function SkillLevelsReceipt({ ref, snapshot, rows, onDone }: {
  ref: React.Ref<HTMLElement>; snapshot: SkillSnapshot; rows: { skillId: string; fromLevel: number; toLevel: number }[]; onDone: () => void
}) {
  const tr = useI18n()
  const label = (id: string) => {
    const node = snapshot.catalog.find(item => item.id === id)
    if (!node) throw new Error(`Level step names a skill outside the catalog: ${id}`)
    return tr(node.label)
  }
  return <section ref={ref} className="level-up level-up-skills" role="status" aria-live="polite">
    <header><strong>{rows.length === 1 ? tr('Skill level up') : tr('{value0} skills levelled up', { value0: rows.length })}</strong>
      <button type="button" className="level-up-close" aria-label={tr('Dismiss')} onClick={onDone}>×</button></header>
    <ol>{rows.map(row => <li key={row.skillId} style={{ color: skillColors(row.skillId).ink }}>
      <span className="level-up-dot" aria-hidden="true" style={{ background: skillColors(row.skillId).mark }} />
      <span className="level-up-name">{label(row.skillId)}</span>
      <span className="level-up-step">{tr('Lv {value0}', { value0: row.toLevel })}</span>
    </li>)}</ol>
  </section>
}

function LanguageLevelCard({ ref, snapshot, fromLevel, toLevel, onDone }: {
  ref: React.Ref<HTMLElement>; snapshot: SkillSnapshot; fromLevel: number; toLevel: number; onDone: () => void
}) {
  const tr = useI18n()
  const levels = languageSkillLevels(snapshot)
  // Bands cover levels 1 through the next one, so the threshold just reached is known while it is current.
  const reached = toLevel <= levels.bands.length ? levels.bands[toLevel - 1] : null
  return <section ref={ref} className="level-up level-up-language" role="status" aria-live="polite">
    <div className="level-up-radar"><SkillRadarGlyph levels={levels} /></div>
    <div className="level-up-badge" aria-hidden="true">
      <span className="level-up-roll"><span>{tr.number(fromLevel)}</span><span>{tr.number(toLevel)}</span></span>
    </div>
    <strong>{tr('Skill level {value0}', { value0: toLevel })}</strong>
    {reached !== null && <span>{tr('Every skill now has {value0} or more points.', { value0: reached })}</span>}
    <button type="button" className="btn" onClick={onDone}>{tr('Keep going')}</button>
  </section>
}
