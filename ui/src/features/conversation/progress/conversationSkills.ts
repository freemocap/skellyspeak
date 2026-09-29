import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { xpReportCredits } from './XpEvidenceReport'

export type ConversationSkill = {
  skill: ReturnType<typeof xpReportCredits>[number]['skill']
  /** Distinct credited messages in this conversation that used the skill. */
  uses: number
  xp: number
  lastAt: number
}

/** Credited skills in one conversation, most used first; ties go to more XP, then recency. */
export function conversationSkills(snapshot: SkillSnapshot, chatId: string): ConversationSkill[] {
  const bySkill = new Map<string, ConversationSkill & { messages: Set<number> }>()
  for (const { credit, record, skill } of xpReportCredits(snapshot)) {
    if (record.chat_id !== chatId) continue
    const entry = bySkill.get(skill.id) ?? { skill, uses: 0, xp: 0, lastAt: 0, messages: new Set<number>() }
    entry.messages.add(record.message_id)
    entry.uses = entry.messages.size
    entry.xp += credit.xp
    entry.lastAt = Math.max(entry.lastAt, record.at_secs)
    bySkill.set(skill.id, entry)
  }
  return [...bySkill.values()]
    .map(({ messages: _messages, ...entry }) => entry)
    .sort((a, b) => b.uses - a.uses || b.xp - a.xp || b.lastAt - a.lastAt)
}
