import type { SkillSnapshot } from '../evidence/skills'
import { conversationEvidence } from '../evidence/skills'
import type { SkillLevelSummary } from '../../../generated/contracts'

/// Skill levels as the UI reads them. Native owns the policy: points are the
/// eligible credits per skill, each skill has a Fibonacci level, and the language
/// level is the weakest skill's (`profile.levels`). This module only joins that
/// projection with catalog labels and XP, validates it, and derives presentation
/// quantities (radar position, readiness, band fill). It never computes a threshold.

export interface SkillLevel {
  id: string
  label: string
  description: string
  domainId: string
  points: number
  xp: number
  level: number
  /** Points at which this skill reached its current level. */
  currentThreshold: number
  /** Points needed for this skill's next level. */
  nextThreshold: number
  /** Position on the radar's level scale: ring k sits at k, points interpolate inside a band. */
  position: number
}

export interface LanguageSkillLevels {
  skills: SkillLevel[]
  /** The weakest skill's level. */
  level: number
  /** Points every skill needs for the next language level. */
  target: number
  /** Thresholds for levels 1 through the next language level. */
  bands: number[]
  /** Skills already at or past `target`. */
  ready: number
  /** Share of the band from `level` to `level + 1` filled across all skills, 0–1. */
  progress: number
  xp: number
}

/** A band position from native thresholds: `level + (points - current) / (next - current)`. */
export function bandPosition(level: number, points: number, currentThreshold: number, nextThreshold: number): number {
  if (nextThreshold <= currentThreshold) throw new Error(`Level band is empty: ${currentThreshold}–${nextThreshold}`)
  if (points < currentThreshold) throw new Error(`Points ${points} are below the current threshold ${currentThreshold}`)
  return level + Math.min(points - currentThreshold, nextThreshold - currentThreshold) / (nextThreshold - currentThreshold)
}

/** The language scope's levels, joined to the catalog in catalog order. */
export function languageSkillLevels(snapshot: SkillSnapshot): LanguageSkillLevels {
  const summary: SkillLevelSummary | null = snapshot.profile.levels
  if (!summary) throw new Error('This evidence scope has no skill levels; only the language scope does.')
  const nodes = snapshot.catalog.filter(node => node.kind === 'skill')
  if (summary.skills.length !== nodes.length || summary.skills.some((skill, index) => skill.skillId !== nodes[index].id))
    throw new Error('Skill levels do not match the catalog order.')
  if (summary.bands.length !== summary.level + 1 || summary.bands[summary.level] !== summary.nextThreshold)
    throw new Error(`Level bands ${JSON.stringify(summary.bands)} do not end at the next threshold ${summary.nextThreshold}.`)
  const skills = summary.skills.map((progress, index) => {
    const node = nodes[index]
    const xp = snapshot.profile.skills.find(skill => skill.skill_id === node.id)?.xp
    if (xp === undefined) throw new Error(`Missing skill progress: ${node.id}`)
    if (!node.parent) throw new Error(`Skill has no domain: ${node.id}`)
    return {
      id: node.id, label: node.label, description: node.description, domainId: node.parent,
      points: progress.points, xp, level: progress.level,
      currentThreshold: progress.currentThreshold, nextThreshold: progress.nextThreshold,
      position: bandPosition(progress.level, progress.points, progress.currentThreshold, progress.nextThreshold),
    }
  })
  const band = summary.nextThreshold - summary.currentThreshold
  return {
    skills,
    level: summary.level,
    target: summary.nextThreshold,
    bands: summary.bands,
    ready: skills.filter(skill => skill.points >= summary.nextThreshold).length,
    progress: skills.reduce((sum, skill) => sum + Math.min(Math.max(skill.points - summary.currentThreshold, 0), band), 0) / (band * skills.length),
    xp: snapshot.profile.xp,
  }
}

/** The skills holding the language at its level, fewest points first, with the points each still needs. */
export function holdingBack(levels: LanguageSkillLevels): { skill: SkillLevel; needed: number }[] {
  return levels.skills
    .filter(skill => skill.points < levels.target)
    .map(skill => ({ skill, needed: levels.target - skill.points }))
    .sort((left, right) => right.needed - left.needed)
}

export interface ConversationSkillPoints {
  /** Catalog-ordered points earned in one conversation. A conversation has no level. */
  skills: { id: string; points: number }[]
  total: number
}

/** Eligible credits attributed to one conversation, counted per skill. */
export function conversationSkillPoints(snapshot: SkillSnapshot, chatId: string): ConversationSkillPoints {
  const scoped = conversationEvidence(snapshot, chatId)
  const nodes = scoped.catalog.filter(node => node.kind === 'skill')
  const counts = new Map(nodes.map(node => [node.id, 0]))
  const seen = new Set<string>()
  for (const credit of scoped.profile.credits) {
    const count = counts.get(credit.skill_id)
    if (count === undefined) throw new Error(`Credit names a skill outside the catalog: ${credit.skill_id}`)
    const key = `${credit.attempt_id}:${credit.skill_id}`
    if (seen.has(key)) throw new Error(`Duplicate credit for ${key}`)
    seen.add(key)
    counts.set(credit.skill_id, count + 1)
  }
  const skills = nodes.map(node => ({ id: node.id, points: counts.get(node.id)! }))
  return { skills, total: skills.reduce((sum, skill) => sum + skill.points, 0) }
}
