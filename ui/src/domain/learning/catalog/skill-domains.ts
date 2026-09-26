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
export function skillDomain(snapshot: SkillSnapshot, node: TreeNode): TreeNode {
  if (node.kind === 'domain') return node
  const parent = snapshot.catalog.find(item => item.id === node.parent)
  if (!parent) throw new Error(`Missing parent for ${node.id}`)
  return skillDomain(snapshot, parent)
}
