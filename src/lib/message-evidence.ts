import { skillIndex } from './skill-index'
import type { SkillSnapshot } from './skills'
import { domainColors } from './skill-domains'

export interface MessageEvidence { skillId: string; domainId: string; label: string; xp: number; quote: string; ambiguous: boolean; rationale: string; id: string; start: number; end: number; color: string; explanation: string }
export function messageEvidence(snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] {
  if (!snapshot || !chatId) return []
  const index = skillIndex(snapshot)
  return (index.messages.get(JSON.stringify([chatId, messageId])) ?? []).filter(record => record.chat_id === chatId && record.message_id === messageId && record.source === source && record.status === 'complete' && record.catalog_version === snapshot.catalog_version && !index.excluded.has(record.attempt_id)).flatMap(record => record.assessment!.judgments.flatMap(judgment => {
    const xp = index.credits.get(`${record.attempt_id}:${judgment.skill_id}`)
    if (!xp || xp <= 0) return []
    const node = index.catalog.node(judgment.skill_id)
    if (!node) throw new Error(`Missing evidence skill ${judgment.skill_id}`)
    return [...new Set(judgment.quotes)].flatMap(quote => {
      const starts: number[] = []
      if (quote) for (let index = source.indexOf(quote); index >= 0; index = source.indexOf(quote, index + 1)) starts.push(index)
      if (!starts.length) throw new Error('Evidence quote does not match the message')
      return starts.map(start => ({ ambiguous: starts.length > 1, skillId: node.id, domainId: index.catalog.domain(node.id).id, label: node.label, xp: xp, quote, rationale: judgment.rationale, id: `${record.attempt_id}:${node.id}`, start, end: start + quote.length, color: domainColors(index.catalog.domain(node.id).id).ink, explanation: `${node.label} · ${xp} XP for this message\n${judgment.rationale}` }))
    })
  }))
}

/** Overlapping domains retain their colors without choosing one as the winner. */
export function evidenceStyle(evidence: MessageEvidence[]): { color: string; borderColor: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string; backgroundRepeat?: string } | undefined {
  if (!evidence.length) return undefined
  const colors = [...new Set(evidence.map(item => item.color))]
  if (colors.length === 1) return { color: colors[0], borderColor: colors[0] }
  const stops = colors.map((color, index) => `${color} ${index * 100 / colors.length}% ${(index + 1) * 100 / colors.length}%`)
  return { color: 'inherit', borderColor: 'transparent', backgroundImage: `linear-gradient(to right, ${stops.join(', ')})`, backgroundSize: '100% 3px', backgroundPosition: 'bottom', backgroundRepeat: 'no-repeat' }
}

/** One selector per mounted message reuses ranges across unrelated profile refreshes. */
export function createMessageEvidenceSelector() {
  let previousKey = ''
  let previous: MessageEvidence[] = []
  return (snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] => {
    const index = snapshot ? skillIndex(snapshot) : null
    const records = index?.messages.get(JSON.stringify([chatId, messageId])) ?? []
    const key = JSON.stringify([snapshot?.target, snapshot?.catalog_version, chatId, messageId, source, records.map(record => [record, index!.excluded.has(record.attempt_id), record.assessment?.judgments.map(judgment => index!.credits.get(`${record.attempt_id}:${judgment.skill_id}`))])])
    if (key !== previousKey) { previousKey = key; previous = messageEvidence(snapshot, chatId, messageId, source) }
    return previous
  }
}
