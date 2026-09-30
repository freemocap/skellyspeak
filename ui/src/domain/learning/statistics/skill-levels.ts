import type { SkillSnapshot } from '../evidence/skills'

/// Skill levels: a skill point is one credited message for that skill, each skill
/// earns its own level from its points on a Fibonacci scale, and the language's
/// skill level is the level of its weakest skill. XP is a separate running total;
/// it never sets a level.

/** Points a skill needs to reach `level`: 0, 1, 2, 3, 5, 8, 13… (Fibonacci, first 1 skipped). */
export function levelThreshold(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new Error(`Skill level must be a non-negative integer, got ${level}`)
  if (level === 0) return 0
  let [current, next] = [1, 2]
  for (let step = 1; step < level; step++) [current, next] = [next, current + next]
  return current
}

/** The highest level whose threshold `points` has reached. */
export function levelFor(points: number): number {
  if (!Number.isInteger(points) || points < 0) throw new Error(`Skill points must be a non-negative integer, got ${points}`)
  let level = 0
  while (levelThreshold(level + 1) <= points) level++
  return level
}

/** Position on the radar's level scale: ring k sits at k, points interpolate inside a band. */
export function levelPosition(points: number): number {
  const level = levelFor(points)
  const low = levelThreshold(level)
  return level + (points - low) / (levelThreshold(level + 1) - low)
}

export interface SkillLevel {
  id: string
  label: string
  description: string
  domainId: string
  points: number
  xp: number
  level: number
  /** Points needed for this skill's next level. */
  nextThreshold: number
}

export interface LanguageSkillLevels {
  skills: SkillLevel[]
  /** The weakest skill's level. */
  level: number
  /** Points every skill needs for the next overall level. */
  target: number
  /** Skills already at or past `target`. */
  ready: number
  /** Share of the band from `level` to `level + 1` filled across all skills, 0–1. */
  progress: number
  xp: number
}

/** Count credited messages per skill from awarded credits, in catalog order. */
export function skillLevels(snapshot: SkillSnapshot): LanguageSkillLevels {
  const nodes = snapshot.catalog.filter(node => node.kind === 'skill')
  if (!nodes.length) throw new Error('Skill catalog has no skills')
  const points = new Map(nodes.map(node => [node.id, 0]))
  for (const credit of snapshot.profile.credits) {
    const count = points.get(credit.skill_id)
    if (count === undefined) throw new Error(`Credit names a skill outside the catalog: ${credit.skill_id}`)
    points.set(credit.skill_id, count + 1)
  }
  const skills = nodes.map(node => {
    const progress = snapshot.profile.skills.find(skill => skill.skill_id === node.id)
    if (!progress) throw new Error(`Missing skill progress: ${node.id}`)
    if (!node.parent) throw new Error(`Skill has no domain: ${node.id}`)
    const count = points.get(node.id)!
    const level = levelFor(count)
    return { id: node.id, label: node.label, description: node.description, domainId: node.parent, points: count, xp: progress.xp, level, nextThreshold: levelThreshold(level + 1) }
  })
  const level = Math.min(...skills.map(skill => skill.level))
  const low = levelThreshold(level)
  const target = levelThreshold(level + 1)
  const band = target - low
  return {
    skills,
    level,
    target,
    ready: skills.filter(skill => skill.points >= target).length,
    progress: skills.reduce((sum, skill) => sum + Math.min(Math.max(skill.points - low, 0), band), 0) / (band * skills.length),
    xp: snapshot.profile.xp,
  }
}
