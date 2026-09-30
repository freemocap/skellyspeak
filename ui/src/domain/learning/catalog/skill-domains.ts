import type { SkillSnapshot } from '../evidence/skills'
import type { TreeNode } from './skillTree'

const colors: Record<string, { ink: string; bright: string; muted: string }> = {
  people_things: { ink: 'var(--di-descriptions)', bright: 'var(--d-descriptions)', muted: 'var(--dm-descriptions)' },
  time_events: { ink: 'var(--di-situating)', bright: 'var(--d-situating)', muted: 'var(--dm-situating)' },
  wants_choices: { ink: 'var(--di-opinions)', bright: 'var(--d-opinions)', muted: 'var(--dm-opinions)' },
  questions_conversation: { ink: 'var(--di-questions)', bright: 'var(--d-questions)', muted: 'var(--dm-questions)' },
}
export function domainColors(id: string) {
  const palette = colors[id]
  if (!palette) throw new Error(`Unknown skill domain ${id}`)
  return palette
}
/** One jewel tone per catalog skill: `mark` for arms, dots and bars, `ink` for the skill as text. */
const skillPalette: Record<string, { mark: string; ink: string }> = {
  identify_describe: { mark: 'var(--skill-identify-describe)', ink: 'var(--skill-identify-describe-ink)' },
  possession_relationships: { mark: 'var(--skill-possession-relationships)', ink: 'var(--skill-possession-relationships-ink)' },
  quantity: { mark: 'var(--skill-quantity)', ink: 'var(--skill-quantity-ink)' },
  present_situations: { mark: 'var(--skill-present-situations)', ink: 'var(--skill-present-situations-ink)' },
  past_reference: { mark: 'var(--skill-past-reference)', ink: 'var(--skill-past-reference-ink)' },
  future_reference: { mark: 'var(--skill-future-reference)', ink: 'var(--skill-future-reference-ink)' },
  wants_preferences: { mark: 'var(--skill-wants-preferences)', ink: 'var(--skill-wants-preferences-ink)' },
  ability_permission_necessity: { mark: 'var(--skill-ability-permission-necessity)', ink: 'var(--skill-ability-permission-necessity-ink)' },
  affirm_negate: { mark: 'var(--skill-affirm-negate)', ink: 'var(--skill-affirm-negate-ink)' },
  questions_answers: { mark: 'var(--skill-questions-answers)', ink: 'var(--skill-questions-answers-ink)' },
  requests: { mark: 'var(--skill-requests)', ink: 'var(--skill-requests-ink)' },
  reasons_conditions: { mark: 'var(--skill-reasons-conditions)', ink: 'var(--skill-reasons-conditions-ink)' },
}
export function skillColors(id: string) {
  const palette = skillPalette[id]
  if (!palette) throw new Error(`Unknown skill colour ${id}`)
  return palette
}
export function skillDomain(snapshot: SkillSnapshot, node: TreeNode): TreeNode {
  if (node.kind === 'domain') return node
  const parent = snapshot.catalog.find(item => item.id === node.parent)
  if (!parent) throw new Error(`Missing parent for ${node.id}`)
  return skillDomain(snapshot, parent)
}
