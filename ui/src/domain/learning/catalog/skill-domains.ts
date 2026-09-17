import type { SkillSnapshot } from '../evidence/skills'
import type { TreeNode } from './skillTree'

const colors: Record<string, { ink: string; bright: string; muted: string }> = {
  social: { ink: 'var(--di-social)', bright: 'var(--d-social)', muted: 'var(--dm-social)' },
  reference: { ink: 'var(--di-statements)', bright: 'var(--d-statements)', muted: 'var(--dm-statements)' },
  properties: { ink: 'var(--di-descriptions)', bright: 'var(--d-descriptions)', muted: 'var(--dm-descriptions)' },
  events: { ink: 'var(--di-statements)', bright: 'var(--d-statements)', muted: 'var(--dm-statements)' },
  time: { ink: 'var(--di-situating)', bright: 'var(--d-situating)', muted: 'var(--dm-situating)' },
  space: { ink: 'var(--di-situating)', bright: 'var(--d-situating)', muted: 'var(--dm-situating)' },
  operators: { ink: 'var(--di-questions)', bright: 'var(--d-questions)', muted: 'var(--dm-questions)' },
  connections: { ink: 'var(--di-opinions)', bright: 'var(--d-opinions)', muted: 'var(--dm-opinions)' },
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
