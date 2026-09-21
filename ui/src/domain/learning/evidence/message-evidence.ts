import { skillIndex } from '../catalog/skill-index'
import { requireCatalogVersion, type SkillSnapshot } from './skills'
import { domainColors } from '../catalog/skill-domains'

export interface MessageEvidence { evidenceKind?: 'quoted' | 'whole_message'; milestone?: number; skillId: string; domainId: string; label: string; xp: number; quote: string; ambiguous: boolean; rationale: string; id: string; start: number; end: number; color: string; explanation: string }
export function messageEvidence(snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] {
  return projectEvidence(snapshot, chatId, messageId, source, false)
}

/** Reward cards may describe a whole message without inventing a phrase highlight. */
export function messageRewardEvidence(snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] {
  return projectEvidence(snapshot, chatId, messageId, source, true)
}

function projectEvidence(snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string, wholeMessages: boolean): MessageEvidence[] {
  if (!snapshot || !chatId) return []
  const index = skillIndex(snapshot)
  const records = (index.messages.get(JSON.stringify([chatId, messageId])) ?? []).filter(record => record.chat_id === chatId && record.message_id === messageId && record.source === source && record.status === 'complete' && !index.excluded.has(record.attempt_id))
  for (const record of records) requireCatalogVersion(snapshot, record)
  return records.flatMap(record => record.assessment!.judgments.flatMap(judgment => {
    // Whole-message decisions have no model-selected span to highlight.
    if (judgment.evidence_kind === 'whole_message' && !wholeMessages) return []
    const xp = index.credits.get(`${record.attempt_id}:${judgment.skill_id}`)
    if (!xp || xp <= 0) return []
    const node = index.catalog.node(judgment.skill_id)
    if (!node) throw new Error(`Missing evidence skill ${judgment.skill_id}`)
    if (judgment.evidence_kind === 'whole_message') {
      if (record.assessment_adapter !== 'jev_choice' || !source.trim() || judgment.quotes.length) throw new Error('Invalid whole-message reward evidence')
      return [{ evidenceKind: 'whole_message' as const, ambiguous: false, skillId: node.id, domainId: index.catalog.domain(node.id).id, label: node.label, xp, quote: source, rationale: '', id: `${record.attempt_id}:${node.id}`, start: 0, end: source.length, color: domainColors(index.catalog.domain(node.id).id).ink, explanation: `${node.label} · ${xp} XP` }]
    }
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
export function createMessageRewardEvidenceSelector() {
  return createMessageEvidenceSelector(messageRewardEvidence)
}

export function createMessageEvidenceSelector(project = messageEvidence) {
  let previousKey = ''
  let previous: MessageEvidence[] = []
  return (snapshot: SkillSnapshot | null, chatId: string | null, messageId: number, source: string): MessageEvidence[] => {
    const index = snapshot ? skillIndex(snapshot) : null
    const records = index?.messages.get(JSON.stringify([chatId, messageId])) ?? []
    const key = JSON.stringify([snapshot?.target, snapshot?.construct_registry_hash, snapshot?.catalog_version, chatId, messageId, source, records.map(record => [record, index!.excluded.has(record.attempt_id), record.assessment?.judgments.map(judgment => index!.credits.get(`${record.attempt_id}:${judgment.skill_id}`))])])
    if (key !== previousKey) { previousKey = key; previous = project(snapshot, chatId, messageId, source) }
    return previous
  }
}
