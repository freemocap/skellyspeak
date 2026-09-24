import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

export const XP_MILESTONE = 50

/** Splits a skill's current milestone cycle into XP held before this award and XP it added. */
export function milestoneProgress(snapshot: SkillSnapshot, skillId: string, gain: number) {
  const skill = snapshot.profile.skills.find(item => item.skill_id === skillId)
  if (!skill) throw new Error(`Missing XP progress for ${skillId}`)
  const cycleStart = Math.floor(skill.xp / XP_MILESTONE) * XP_MILESTONE
  const earlier = Math.max(0, skill.xp - gain - cycleStart)
  return { total: skill.xp, inCycle: skill.xp - cycleStart, earlier, added: skill.xp - cycleStart - earlier, next: cycleStart + XP_MILESTONE }
}
