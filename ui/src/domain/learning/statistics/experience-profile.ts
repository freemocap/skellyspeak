import type { SkillSnapshot } from '../evidence/skills'
import { practiceStatistics } from './practice-statistics'

/** Project already-awarded, validated credits; never infer ability from counts. */
export function experienceProfile(snapshot: SkillSnapshot, variety: string | null) {
  practiceStatistics(snapshot)
  const records = new Map(snapshot.records.map(record => [record.attempt_id, record]))
  const skills = snapshot.catalog.filter(node => node.kind === 'skill').map(node => ({
    id: node.id, label: node.label, experience: 0, effort: 0, xp: 0,
  }))
  for (const credit of snapshot.profile.credits) {
    if (variety !== null && (records.get(credit.attempt_id)!.variety ?? '') !== variety) continue
    const skill = skills.find(item => item.id === credit.skill_id)!
    skill.experience += credit.experience ?? credit.event!.experience
    skill.effort += credit.effort ?? credit.event!.effort
    skill.xp += credit.xp
  }
  return {
    skills,
    experience: skills.reduce((sum, skill) => sum + skill.experience, 0),
    effort: skills.reduce((sum, skill) => sum + skill.effort, 0),
    xp: skills.reduce((sum, skill) => sum + skill.xp, 0),
    used: skills.filter(skill => skill.experience > 0).length,
  }
}
