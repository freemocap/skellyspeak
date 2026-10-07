import type { LanguageSkillLevels } from '../../domain/learning/statistics/skill-levels'

/// Lengths for the skill charts (radar arms and bars) as fractions of the gold
/// goal ring's radius in normalized view. Both chart types read the same
/// extent, so switching chart type, scale or whose points are shown only moves
/// marks, never re-derives data.

/** `normalized`: every earned level is an equal band and the next language level
 * is the gold ring. `scale`: lengths are proportional to points. */
export type SkillChartScale = 'normalized' | 'scale'
export type SkillChartType = 'radial' | 'bars'
/** Whose points fill the chart where a conversation is given: the language's
 * totals, that conversation alone, or the totals with the conversation outlined over them. */
export type SkillChartShown = 'language' | 'conversation' | 'both'
export const CHART_SHOWN: readonly SkillChartShown[] = ['language', 'conversation', 'both']

/** What the filled marks stand for, for names and tags: the language's totals,
 * or one conversation's points per skill. `busiest` is the point count on the
 * gold ring while a conversation is shown alone and normalized, else null. */
export type SkillChartMarks = { of: 'language' } | { of: 'conversation'; points: number[]; busiest: number | null }

/** No mark reaches past this fraction of the gold ring's normalized radius. */
export const CHART_LIMIT = 1.1

export interface SkillChartExtent {
  /** One length per skill, catalog order. */
  skills: number[]
  /** Earned language levels 1 through `level`, one length each. */
  rings: number[]
  /** The next language level. */
  goal: number
  /** One conversation's points per skill, catalog order, or null without one. */
  conversation: number[] | null
}

/** Lengths for `levels` in `scale`, filled as `shown` asks. In normalized view
 * a skill's length is its band position over the next level, clipped at
 * `CHART_LIMIT`, and a conversation is scaled so its busiest skill reaches the
 * gold ring. To scale, one point is the same length for every skill, ring and
 * conversation, and the longest of them fits inside `CHART_LIMIT`. Shown alone,
 * a conversation takes the skills' place, with no earned rings (a conversation
 * has no level) and no outline; shown with the language, it is the outline. */
export function skillChartExtent(levels: LanguageSkillLevels, conversation: number[] | null, scale: SkillChartScale, shown: SkillChartShown = 'both'): SkillChartExtent {
  if (conversation && conversation.length !== levels.skills.length)
    throw new Error(`Conversation points cover ${conversation.length} skills; the chart has ${levels.skills.length}.`)
  if (levels.bands.length !== levels.level + 1)
    throw new Error(`Level bands ${JSON.stringify(levels.bands)} do not cover levels 1 through ${levels.level + 1}.`)
  if (shown === 'conversation' && !conversation) throw new Error('The conversation view was asked for with no conversation.')
  const earned = levels.bands.slice(0, levels.level)
  const alone = shown === 'conversation' ? conversation : null
  const outline = shown === 'both' ? conversation : null
  if (scale === 'normalized') {
    const next = levels.level + 1
    const most = conversation ? Math.max(...conversation) : 0
    const relative = (values: number[]) => values.map(value => most > 0 ? value / most : 0)
    return {
      skills: alone ? relative(alone) : levels.skills.map(skill => Math.min(skill.position / next, CHART_LIMIT)),
      rings: alone ? [] : earned.map((_, index) => (index + 1) / next),
      goal: 1,
      conversation: outline && most > 0 ? relative(outline) : null,
    }
  }
  const largest = Math.max(levels.target, ...levels.skills.map(skill => skill.points / CHART_LIMIT), ...(conversation ?? []).map(value => value / CHART_LIMIT))
  return {
    skills: (alone ?? levels.skills.map(skill => skill.points)).map(points => points / largest),
    rings: alone ? [] : earned.map(threshold => threshold / largest),
    goal: levels.target / largest,
    conversation: outline && Math.max(...outline) > 0 ? outline.map(value => value / largest) : null,
  }
}

/** Zoom bounds for the to-scale view: 1 fits every mark; larger values magnify short arms. */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 12

/** `extent` magnified by `zoom`. Lengths past `CHART_LIMIT` are kept; the chart clips them at its edge. */
export function zoomExtent(extent: SkillChartExtent, zoom: number): SkillChartExtent {
  if (!(zoom >= MIN_ZOOM && zoom <= MAX_ZOOM)) throw new Error(`Chart zoom ${zoom} is outside ${MIN_ZOOM}–${MAX_ZOOM}.`)
  return {
    skills: extent.skills.map(length => length * zoom),
    rings: extent.rings.map(length => length * zoom),
    goal: extent.goal * zoom,
    conversation: extent.conversation?.map(length => length * zoom) ?? null,
  }
}
