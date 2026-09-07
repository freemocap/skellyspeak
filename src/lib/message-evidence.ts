import type { SkillSnapshot } from './skills'
import { domainColors, skillDomain } from './skill-domains'

export interface MessageEvidence { skillId: string; domainId: string; label: string; xp: number; quote: string; rationale: string; id: string; start: number; end: number; color: string; explanation: string }
export function messageEvidence(snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] {
  if (!snapshot || !chatId) return []
  return snapshot.records.filter(record => record.chat_id === chatId && record.message_id === messageId && record.source === source && record.status === 'complete' && record.catalog_version === snapshot.catalog_version && !snapshot.profile.choices.excluded_attempts.includes(record.attempt_id)).flatMap(record => record.assessment!.judgments.flatMap(judgment => {
    const credit = snapshot.profile.credits.find(item => item.attempt_id === record.attempt_id && item.skill_id === judgment.skill_id)
    if (!credit || credit.xp <= 0) return []
    const node = snapshot.catalog.find(item => item.id === judgment.skill_id)
    if (!node) throw new Error(`Missing evidence skill ${judgment.skill_id}`)
    return judgment.quotes.map(quote => {
      const start = source.indexOf(quote)
      if (start < 0 || !quote) throw new Error('Evidence quote does not match the message')
      return { skillId: node.id, domainId: skillDomain(snapshot, node).id, label: node.label, xp: credit.xp, quote, rationale: judgment.rationale, id: `${record.attempt_id}:${node.id}`, start, end: start + quote.length, color: domainColors(skillDomain(snapshot, node).id).ink, explanation: `${node.label} · ${credit.xp} XP for this message\n${judgment.rationale}` }
    })
  }))
}
