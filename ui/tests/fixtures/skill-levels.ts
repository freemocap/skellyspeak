import type { SkillLevelSummary } from '../../src/generated/contracts'
import type { SkillSnapshot } from '../../src/domain/learning/evidence/skills'

/// Test and preview fixtures only. Native owns the level policy; this mirrors it
/// (Fibonacci thresholds 1, 2, 3, 5, 8, …, language level = weakest skill) so
/// fixtures can carry the summary a native snapshot would.

export function fixtureThreshold(level: number): number {
  if (level === 0) return 0
  let [current, next] = [1, 2]
  for (let step = 1; step < level; step++) [current, next] = [next, current + next]
  return current
}

function fixtureLevel(points: number): number {
  let level = 0
  while (fixtureThreshold(level + 1) <= points) level++
  return level
}

/** The summary native would project for these catalog-ordered points. */
export function fixtureSummary(skillIds: string[], points: number[]): SkillLevelSummary {
  if (skillIds.length !== points.length) throw new Error('One point count per skill')
  const skills = skillIds.map((skillId, index) => {
    const level = fixtureLevel(points[index])
    return { skillId, points: points[index], level, currentThreshold: fixtureThreshold(level), nextThreshold: fixtureThreshold(level + 1) }
  })
  const level = Math.min(...skills.map(skill => skill.level))
  return { policyId: 'fixture', skills, level, currentThreshold: fixtureThreshold(level), nextThreshold: fixtureThreshold(level + 1), bands: Array.from({ length: level + 1 }, (_, index) => fixtureThreshold(index + 1)) }
}

/** Recompute a snapshot's summary from its credits, as native would. */
export function withFixtureLevels(snapshot: SkillSnapshot): SkillSnapshot {
  const ids = snapshot.catalog.filter(node => node.kind === 'skill').map(node => node.id)
  const points = ids.map(id => snapshot.profile.credits.filter(credit => credit.skill_id === id).length)
  return { ...snapshot, profile: { ...snapshot.profile, levels: fixtureSummary(ids, points) } }
}
