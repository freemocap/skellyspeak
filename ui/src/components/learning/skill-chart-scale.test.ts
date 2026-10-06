import { expect, it } from 'vitest'
import { CHART_LIMIT, MAX_ZOOM, skillChartExtent, zoomExtent } from './skill-chart-scale'
import type { LanguageSkillLevels, SkillLevel } from '../../domain/learning/statistics/skill-levels'

function levelsWith(points: number[], positions: number[]): LanguageSkillLevels {
  const skills = points.map((value, index): SkillLevel => ({
    id: `skill-${index}`, label: '', description: '', criterion: '', domainId: 'domain',
    points: value, xp: value, level: Math.floor(positions[index]), currentThreshold: 0, nextThreshold: 0, position: positions[index],
  }))
  // Level 2: thresholds 1 and 2 earned, 3 is the goal.
  return { skills, level: 2, target: 3, bands: [1, 2, 3], ready: 0, progress: 0, xp: 0 }
}

it('normalizes to level bands with the goal on the ring and clips long arms', () => {
  const extent = skillChartExtent(levelsWith([2, 3, 20], [2, 3, 9]), [1, 4, 2], 'normalized')
  expect(extent.goal).toBe(1)
  expect(extent.rings).toEqual([1 / 3, 2 / 3])
  expect(extent.skills).toEqual([2 / 3, 1, CHART_LIMIT])
  expect(extent.conversation).toEqual([0.25, 1, 0.5])
})

it('draws to scale with one length per point and fits the longest mark', () => {
  const extent = skillChartExtent(levelsWith([2, 3, 22], [2, 3, 9]), [1, 4, 2], 'scale')
  const unit = CHART_LIMIT / 22
  expect(extent.skills[2]).toBeCloseTo(CHART_LIMIT)
  expect(extent.skills[0]).toBeCloseTo(2 * unit)
  expect(extent.rings[0]).toBeCloseTo(unit)
  expect(extent.rings[1]).toBeCloseTo(2 * unit)
  expect(extent.goal).toBeCloseTo(3 * unit)
  expect(extent.conversation![1]).toBeCloseTo(4 * unit)
})

it('keeps the goal on the ring to scale when no skill passes it', () => {
  const extent = skillChartExtent(levelsWith([1, 2, 3], [1, 2, 3]), null, 'scale')
  expect(extent.goal).toBe(1)
  expect(extent.skills).toEqual([1 / 3, 2 / 3, 1])
  expect(extent.conversation).toBeNull()
})

it('refuses conversation points that do not match the skills', () => {
  expect(() => skillChartExtent(levelsWith([1, 2, 3], [1, 2, 3]), [1, 2], 'scale')).toThrow(/cover 2 skills/)
})

it('zooms every length by the same factor and refuses zoom outside its bounds', () => {
  const extent = skillChartExtent(levelsWith([1, 2, 3], [1, 2, 3]), [1, 0, 2], 'scale')
  const zoomed = zoomExtent(extent, 2)
  expect(zoomed.skills).toEqual(extent.skills.map(length => length * 2))
  expect(zoomed.rings).toEqual(extent.rings.map(length => length * 2))
  expect(zoomed.goal).toBe(2)
  expect(zoomed.conversation).toEqual(extent.conversation!.map(length => length * 2))
  expect(() => zoomExtent(extent, 0.5)).toThrow(/outside/)
  expect(() => zoomExtent(extent, MAX_ZOOM + 1)).toThrow(/outside/)
})
