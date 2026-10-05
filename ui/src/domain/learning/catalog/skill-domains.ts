import type { SkillSnapshot } from '../evidence/skills'
import type { TreeNode } from './skillTree'

const colors: Record<string, { ink: string; bright: string; muted: string }> = {
  coordinating_action: { ink: 'var(--di-social)', bright: 'var(--d-social)', muted: 'var(--dm-social)' },
  feelings_viewpoints: { ink: 'var(--di-opinions)', bright: 'var(--d-opinions)', muted: 'var(--dm-opinions)' },
  information_exchange: { ink: 'var(--di-questions)', bright: 'var(--d-questions)', muted: 'var(--dm-questions)' },
  managing_conversation: { ink: 'var(--di-social)', bright: 'var(--d-social)', muted: 'var(--dm-social)' },
  people_places: { ink: 'var(--di-descriptions)', bright: 'var(--d-descriptions)', muted: 'var(--dm-descriptions)' },
  possibilities_constraints: { ink: 'var(--di-statements)', bright: 'var(--d-statements)', muted: 'var(--dm-statements)' },
  reasons_connections: { ink: 'var(--di-opinions)', bright: 'var(--d-opinions)', muted: 'var(--dm-opinions)' },
  time_events: { ink: 'var(--di-situating)', bright: 'var(--d-situating)', muted: 'var(--dm-situating)' },
}
export function domainColors(id: string) {
  const palette = colors[id]
  if (!palette) throw new Error(`Unknown skill domain ${id}`)
  return palette
}
/** One jewel tone per catalog skill: `mark` for arms, dots and bars, `ink` for the skill as text. */
const skillPalette: Record<string, { mark: string; ink: string }> = {
  coordinating_action: { mark: 'var(--skill-coordinating-action)', ink: 'var(--skill-coordinating-action-ink)' },
  feelings_viewpoints: { mark: 'var(--skill-feelings-viewpoints)', ink: 'var(--skill-feelings-viewpoints-ink)' },
  information_exchange: { mark: 'var(--skill-information-exchange)', ink: 'var(--skill-information-exchange-ink)' },
  managing_conversation: { mark: 'var(--skill-managing-conversation)', ink: 'var(--skill-managing-conversation-ink)' },
  people_places: { mark: 'var(--skill-people-places)', ink: 'var(--skill-people-places-ink)' },
  possibilities_constraints: { mark: 'var(--skill-possibilities-constraints)', ink: 'var(--skill-possibilities-constraints-ink)' },
  reasons_connections: { mark: 'var(--skill-reasons-connections)', ink: 'var(--skill-reasons-connections-ink)' },
  time_events: { mark: 'var(--skill-time-events)', ink: 'var(--skill-time-events-ink)' },
}
export function skillColors(id: string) {
  const palette = skillPalette[id]
  if (!palette) throw new Error(`Unknown skill colour ${id}`)
  return palette
}
/** A one-word name per catalog skill, for labels around the radar where the full name does not fit. */
const skillShortLabels: Record<string, string> = {
  coordinating_action: 'Action',
  feelings_viewpoints: 'Feelings',
  information_exchange: 'Questions',
  managing_conversation: 'Conversation',
  people_places: 'Describing',
  possibilities_constraints: 'Possibility',
  reasons_connections: 'Reasons',
  time_events: 'Time',
}
export function skillShortLabel(id: string): string {
  const label = skillShortLabels[id]
  if (!label) throw new Error(`Unknown skill short label ${id}`)
  return label
}
export function skillDomain(snapshot: SkillSnapshot, node: TreeNode): TreeNode {
  if (node.kind !== 'skill' || !snapshot.catalog.some(item => item.id === node.id && item.kind === 'skill')) throw new Error(`Unknown main skill ${node.id}`)
  return node
}
