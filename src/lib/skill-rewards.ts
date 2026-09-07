import type { SkillSnapshot } from './skills'

export interface SkillReward { id: string; messageId: number; skillId: string; domainId: string; label: string; quote: string; xp: number }

/** Celebrate new completed reviews only, bounded by actual increases in skill XP. */
export function skillRewards(previous: SkillSnapshot, current: SkillSnapshot, chatId: string): SkillReward[] {
  if (previous.target !== current.target || previous.learner_id !== current.learner_id || previous.catalog_version !== current.catalog_version || previous.profile.choices.revision !== current.profile.choices.revision) return []
  const remaining = new Map(current.profile.skills.map(skill => [skill.skill_id, Math.max(0, skill.xp - (previous.profile.skills.find(old => old.skill_id === skill.skill_id)?.xp ?? 0))]))
  const rewards: SkillReward[] = []
  for (const record of current.records) {
    if (record.chat_id !== chatId || record.status !== 'complete' || record.replaces_message_id !== null || record.catalog_version !== current.catalog_version || current.profile.choices.excluded_attempts.includes(record.attempt_id)) continue
    const old = previous.records.find(item => item.attempt_id === record.attempt_id)
    if (old && old.status !== 'pending') continue
    for (const credit of current.profile.credits.filter(item => item.attempt_id === record.attempt_id)) {
      const xp = Math.min(credit.xp, remaining.get(credit.skill_id) ?? 0)
      if (!xp) continue
      const node = current.catalog.find(item => item.id === credit.skill_id)
      const judgment = record.assessment?.judgments.find(item => item.skill_id === credit.skill_id && item.outcome === 'demonstrated')
      if (!node || !judgment?.quotes.length) throw new Error('Credited skill is missing its catalog entry or evidence')
      let domain = node
      while (domain.kind !== 'domain') {
        const parent = current.catalog.find(item => item.id === domain.parent)
        if (!parent) throw new Error(`Missing domain for ${node.id}`)
        domain = parent
      }
      remaining.set(credit.skill_id, (remaining.get(credit.skill_id) ?? 0) - xp)
      rewards.push({ id: `${record.attempt_id}:${credit.skill_id}`, messageId: record.message_id, skillId: node.id, domainId: domain.id, label: node.label, quote: judgment.quotes[0], xp })
    }
  }
  return rewards
}
