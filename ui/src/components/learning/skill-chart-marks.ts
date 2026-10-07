import type { useI18n } from '../localization/i18n'
import type { LanguageSkillLevels, SkillLevel } from '../../domain/learning/statistics/skill-levels'
import type { SkillChartMarks } from './skill-chart-scale'

/// The words the radar and the bars share for their marks, so a skill reads
/// the same whichever chart draws it and whosever points fill it.

type Translate = ReturnType<typeof useI18n>

/** Under a skill's name: its level and points, or this conversation's points. */
export function markDetail(tr: Translate, marks: SkillChartMarks, skill: SkillLevel, index: number): string {
  if (marks.of === 'conversation') return tr('{value0} pt', { value0: marks.points[index] })
  return tr('Lv {value0} · {value1}', { value0: skill.level, value1: `${tr.number(skill.points)}/${tr.number(skill.nextThreshold)}` })
}

/** A skill's accessible name on the chart. */
export function markName(tr: Translate, marks: SkillChartMarks, skill: SkillLevel, index: number): string {
  if (marks.of === 'conversation') return tr('{value0}: {value1} points in this conversation', { value0: tr(skill.label), value1: marks.points[index] })
  return tr('{value0}: skill level {value1}, {value2} points', { value0: tr(skill.label), value1: skill.level, value2: skill.points })
}

/** The gold ring's tag: the next level's points, or a normalized conversation's busiest skill. */
export function goalTag(tr: Translate, marks: SkillChartMarks, levels: LanguageSkillLevels): string {
  if (marks.of === 'conversation' && marks.busiest !== null) return tr('Busiest skill · {value0} pt', { value0: tr.number(marks.busiest) })
  return tr('Lv {value0} goal · {value1} pt', { value0: levels.level + 1, value1: tr.number(levels.target) })
}
